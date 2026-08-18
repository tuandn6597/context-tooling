import { hashSeed, round2, seededRandom } from '../common/random.js';
import type { SourceName } from '../common/schema.js';

/**
 * Deterministic mock-data generator.
 *
 * When no hand-crafted fixture exists for a given (source, period), we generate
 * one seeded by `brand + source + period`. Same week -> byte-identical; different
 * week -> different numbers. The generated payloads have the same *shape* as the
 * static fixtures, so the existing `normalize()` functions consume them unchanged.
 *
 * Richpanel/Aircall mock data deliberately contains fake PII so the PII filter
 * still has something to remove in generated weeks too.
 */

interface BrandMeta {
  prefix: string;
  label: string;
  keywords: string[];
  productType: string;
}

const BRANDS: Record<string, BrandMeta> = {
  nanorevive: {
    prefix: 'NR',
    label: 'NanoRevive',
    keywords: ['nanorevive', 'retinol serum', 'night cream'],
    productType: 'Skincare',
  },
  'pawprint-lab': {
    prefix: 'PP',
    label: 'Pawprint Lab',
    keywords: ['pawprint lab', 'dog supplement', 'pet health'],
    productType: 'Pet care',
  },
  saunastack: {
    prefix: 'SS',
    label: 'SaunaStack',
    keywords: ['saunastack', 'home sauna', 'infrared sauna'],
    productType: 'Wellness',
  },
};

const SUBREDDITS = ['SkincareAddiction', '30PlusSkinCare', 'HomeImprovement', 'Pets', 'Wellness'];
const DISPOSITIONS = ['resolved', 'follow-up', 'voicemail', 'escalated'];
const THEMES = ['delivery delay', 'refund', 'usage question', 'product quality', 'billing'];
const TAGS = ['shipping', 'refund', 'product', 'billing', 'account'];
const SUBJECTS = ['Where is my order', 'Refund request', 'How do I use this', 'Wrong item received', 'Cancel my order'];
const NAMES = ['Jane Doe', 'John Smith', 'Maria Garcia', 'Lee Chen', 'Alex Kim', 'Sam Rivera', 'Pat Nguyen'];
const EMAILS = [
  'jane.doe@example.com',
  'john.smith@example.com',
  'maria.garcia@example.com',
  'lee.chen@example.com',
  'alex.kim@example.com',
  'sam.rivera@example.com',
  'pat.nguyen@example.com',
];

function brandMeta(brand: string): BrandMeta {
  return (
    BRANDS[brand] ?? {
      prefix: brand.slice(0, 2).toUpperCase(),
      label: brand.charAt(0).toUpperCase() + brand.slice(1),
      keywords: [brand],
      productType: 'General',
    }
  );
}

export function generateMock(source: SourceName, brand: string, period: string): unknown {
  const rnd = seededRandom(hashSeed(brand, source, period));
  switch (source) {
    case 'shopify':
      return genShopify(brandMeta(brand), rnd);
    case 'reddit':
      return genReddit(brandMeta(brand), period, rnd);
    case 'converge':
      return genConverge(rnd);
    case 'richpanel':
      return genRichpanel(period, rnd);
    case 'aircall':
      return genAircall(period, rnd);
  }
}

function genShopify(meta: BrandMeta, rnd: ReturnType<typeof seededRandom>) {
  const products = [
    { sku: `${meta.prefix}-100`, title: `${meta.label} Serum`, price: rnd.float(25, 45), productType: meta.productType },
    { sku: `${meta.prefix}-200`, title: `${meta.label} Night Cream`, price: rnd.float(30, 55), productType: meta.productType },
    { sku: `${meta.prefix}-300`, title: `${meta.label} Starter Kit`, price: rnd.float(60, 90), productType: meta.productType },
  ];

  const productsEdges = products.map((p, i) => ({
    node: {
      id: `gid://shopify/Product/${8000 + i}`,
      title: p.title,
      productType: p.productType,
      variants: {
        edges: [
          {
            node: {
              id: `gid://shopify/ProductVariant/${p.sku}`,
              sku: p.sku,
              price: String(round2(p.price)),
            },
          },
        ],
      },
    },
  }));

  const orderCount = rnd.int(3, 8);
  const orders = [];
  for (let oi = 0; oi < orderCount; oi++) {
    const lineItems = [];
    const liCount = rnd.int(1, 3);
    for (let li = 0; li < liCount; li++) {
      const p = products[rnd.int(0, products.length - 1)]!;
      lineItems.push({
        node: {
          sku: p.sku,
          title: p.title,
          quantity: rnd.int(1, 3),
          variant: { id: `gid://shopify/ProductVariant/${p.sku}` },
        },
      });
    }
    orders.push({
      node: {
        id: `gid://shopify/Order/${1000 + oi}`,
        lineItems: { edges: lineItems },
      },
    });
  }

  const refundCount = rnd.int(0, 2);
  const refunds = [];
  for (let ri = 0; ri < refundCount; ri++) {
    refunds.push({
      node: {
        id: `gid://shopify/Refund/${5000 + ri}`,
        totalRefundedSet: { shopMoney: { amount: String(round2(rnd.float(10, 40))) } },
      },
    });
  }

  return {
    orders: { edges: orders },
    products: { edges: productsEdges },
    refunds: { edges: refunds },
  };
}

function genReddit(meta: BrandMeta, period: string, rnd: ReturnType<typeof seededRandom>) {
  const searches = meta.keywords.map((keyword) => {
    const children = [];
    const count = rnd.int(1, 4);
    for (let i = 0; i < count; i++) {
      const subreddit = SUBREDDITS[rnd.int(0, SUBREDDITS.length - 1)]!;
      const id = `t3_${hashSeed(keyword, String(i), period).toString(16)}`;
      children.push({
        id,
        subreddit,
        title: `${keyword} — experience (${period})`,
        url: `https://www.reddit.com/r/${subreddit}/comments/${id}/`,
        createdUtc: rnd.int(1754000000, 1754400000),
        score: rnd.int(1, 50),
      });
    }
    return { keyword, children };
  });

  return { searches };
}

function genConverge(rnd: ReturnType<typeof seededRandom>) {
  const channels = ['Meta', 'Google', 'TikTok'].map((channel) => ({
    channel,
    spend: round2(rnd.float(1000, 3000)),
    attributedRevenue: round2(rnd.float(3000, 9000)),
  }));
  const adSpend = round2(channels.reduce((s, c) => s + c.spend, 0));
  const attributedRevenue = round2(channels.reduce((s, c) => s + c.attributedRevenue, 0));
  return { attributionModel: 'blended', currency: 'USD', adSpend, attributedRevenue, channels };
}

function genRichpanel(period: string, rnd: ReturnType<typeof seededRandom>) {
  const count = rnd.int(3, 8);
  const tickets = [];
  for (let i = 0; i < count; i++) {
    const name = NAMES[rnd.int(0, NAMES.length - 1)]!;
    const email = EMAILS[rnd.int(0, EMAILS.length - 1)]!;
    const tagCount = rnd.int(1, 2);
    const tags = Array.from({ length: tagCount }, () => TAGS[rnd.int(0, TAGS.length - 1)]!);
    tickets.push({
      id: `T-${hashSeed(period, String(i)).toString(16).slice(0, 6)}`,
      customerName: name,
      email,
      phone: `+1 555-${String(rnd.int(100, 999)).padStart(4, '0')}`,
      subject: SUBJECTS[rnd.int(0, SUBJECTS.length - 1)]!,
      tags,
      theme: THEMES[rnd.int(0, THEMES.length - 1)]!,
      createdAt: period,
    });
  }
  return { tickets };
}

function genAircall(period: string, rnd: ReturnType<typeof seededRandom>) {
  const count = rnd.int(2, 7);
  const calls = [];
  for (let i = 0; i < count; i++) {
    calls.push({
      id: `C-${hashSeed(period, String(i)).toString(16).slice(0, 6)}`,
      callerName: NAMES[rnd.int(0, NAMES.length - 1)]!,
      phoneNumber: `+1 555-${String(rnd.int(100, 999)).padStart(4, '0')}`,
      durationSeconds: rnd.int(90, 600),
      disposition: DISPOSITIONS[rnd.int(0, DISPOSITIONS.length - 1)]!,
      createdAt: period,
    });
  }
  return { calls };
}
