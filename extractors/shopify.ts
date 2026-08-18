import { paginate } from '../common/pagination.js';
import { sleep, withRetry } from '../common/rateLimit.js';
import { brandSecret } from '../common/secrets.js';
import { createExtractor, round2 } from './base.js';
import { loadFixture } from './fixture.js';
import type { ExtractContext } from './types.js';

const API_VERSION = '2024-10';

const ORDERS_QUERY = `
  query Orders($cursor: String) {
    orders(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          createdAt
          lineItems(first: 250) {
            edges {
              node {
                sku
                title
                quantity
                variant { id }
              }
            }
          }
          refunds(first: 10) {
            edges {
              node {
                id
                totalRefundedSet { shopMoney { amount } }
              }
            }
          }
        }
      }
    }
  }
`;

const PRODUCTS_QUERY = `
  query Products($cursor: String) {
    products(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          productType
          variants(first: 250) {
            edges {
              node { id sku price }
            }
          }
        }
      }
    }
  }
`;

async function shopifyGraphql(
  store: string,
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<any> {
  const url = `https://${store}/admin/api/${API_VERSION}/graphql.json`;
  const run = () =>
    withRetry(async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query, variables }),
      });
      if (!res.ok) throw new Error(`Shopify HTTP ${res.status}: ${res.statusText}`);
      const json = (await res.json()) as any;
      if (json.errors?.length) {
        throw new Error(`Shopify GraphQL error: ${json.errors[0]?.message ?? 'unknown'}`);
      }

      // Cost-based rate limiting: if the throttle bucket is running low, wait
      // for it to restore before the *next* request (we still return this one).
      const cost = json.extensions?.cost;
      const throttle = cost?.throttleStatus;
      if (throttle?.currentlyAvailable != null && throttle?.maximumAvailable != null) {
        const available = Number(throttle.currentlyAvailable);
        const maximum = Number(throttle.maximumAvailable);
        if (available < maximum * 0.2) {
          const restoreRate = Number(throttle.restoreRate ?? 50);
          const requested = Number(cost?.requestedQueryCost ?? 50);
          const waitMs = Math.ceil((requested / restoreRate) * 1000) + 500;
          await sleep(waitMs);
        }
      }
      return json.data as any;
    });

  return run();
}

async function fetchLive(ctx: ExtractContext): Promise<any> {
  // Per-brand convention first (`SHOPIFY_STORE_NANOREVIVE`), then generic
  // (`SHOPIFY_STORE`) for Option-B repos where the repo itself is brand-scoped.
  const store = brandSecret(ctx.env, 'SHOPIFY_STORE', ctx.brand);
  const token = brandSecret(ctx.env, 'SHOPIFY_TOKEN', ctx.brand);
  if (!store || !token) {
    throw new Error(
      `Shopify extractor: missing SHOPIFY_STORE_${ctx.brand.toUpperCase().replace(/-/g, '_')} / ` +
        `SHOPIFY_TOKEN_${ctx.brand.toUpperCase().replace(/-/g, '_')} (or generic SHOPIFY_STORE / SHOPIFY_TOKEN). ` +
        `Add them to GitHub Environments -> Secrets and re-run; refusing to write an empty file.`,
    );
  }

  const orders = await paginate(async (cursor) => {
    const data = await shopifyGraphql(store, token, ORDERS_QUERY, { cursor });
    const edges = (data?.orders?.edges ?? []) as any[];
    return {
      items: edges.map((e) => e.node),
      hasNextPage: data?.orders?.pageInfo?.hasNextPage ?? false,
      endCursor: data?.orders?.pageInfo?.endCursor ?? null,
    };
  });

  const products = await paginate(async (cursor) => {
    const data = await shopifyGraphql(store, token, PRODUCTS_QUERY, { cursor });
    const edges = (data?.products?.edges ?? []) as any[];
    return {
      items: edges.map((e) => e.node),
      hasNextPage: data?.products?.pageInfo?.hasNextPage ?? false,
      endCursor: data?.products?.pageInfo?.endCursor ?? null,
    };
  });

  const refunds = orders.flatMap((o) =>
    (o?.refunds?.edges ?? []).map((e: any) => ({ node: e.node })),
  );

  return {
    orders: { edges: orders.map((node) => ({ node })) },
    products: { edges: products.map((node) => ({ node })) },
    refunds: { edges: refunds },
  };
}

function normalize(raw: any) {
  const priceBySku = new Map<string, number>();
  const catalog: Array<{ sku: string; title: string; variantId: string; productType: string }> = [];

  for (const edge of raw?.products?.edges ?? []) {
    const product = edge.node;
    const productType = product?.productType ?? 'Uncategorized';
    for (const vEdge of product?.variants?.edges ?? []) {
      const v = vEdge.node;
      if (v?.sku) {
        priceBySku.set(v.sku, Number(v.price ?? 0));
        catalog.push({
          sku: v.sku,
          title: product?.title ?? '',
          variantId: v.id ?? '',
          productType,
        });
      }
    }
  }

  const skuUnits = new Map<string, number>();
  const skuRevenue = new Map<string, number>();
  let orderCount = 0;

  for (const edge of raw?.orders?.edges ?? []) {
    orderCount += 1;
    for (const liEdge of edge.node?.lineItems?.edges ?? []) {
      const li = liEdge.node;
      const sku = li?.sku ?? 'NO-SKU';
      const qty = Number(li?.quantity ?? 0);
      const price = priceBySku.get(sku) ?? 0;
      skuUnits.set(sku, (skuUnits.get(sku) ?? 0) + qty);
      skuRevenue.set(sku, (skuRevenue.get(sku) ?? 0) + round2(qty * price));
    }
  }

  const unitsBySku = [...skuUnits.entries()]
    .map(([sku, units]) => ({ sku, units, revenue: round2(skuRevenue.get(sku) ?? 0) }))
    .sort((a, b) => a.sku.localeCompare(b.sku));

  const totalRevenue = round2([...skuRevenue.values()].reduce((s, v) => s + v, 0));
  const totalUnits = [...skuUnits.values()].reduce((s, v) => s + v, 0);

  let refundCount = 0;
  let refundAmount = 0;
  for (const edge of raw?.refunds?.edges ?? []) {
    refundCount += 1;
    refundAmount += Number(edge.node?.totalRefundedSet?.shopMoney?.amount ?? 0);
  }

  return {
    orders: { count: orderCount, revenue: totalRevenue, units: totalUnits },
    unitsBySku,
    catalog: catalog.sort((a, b) => a.sku.localeCompare(b.sku)),
    refunds: { count: refundCount, amount: round2(refundAmount) },
  };
}

export const shopifyExtractor = createExtractor({
  source: 'shopify',
  redactPii: false,
  fetchRaw: (ctx) => (ctx.fixtureMode ? Promise.resolve(loadFixture('shopify', ctx.period, ctx.brand)) : fetchLive(ctx)),
  normalize,
});
