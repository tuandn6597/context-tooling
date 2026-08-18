/**
 * Generic cursor-pagination helper.
 *
 * Shopify's Admin GraphQL returns `pageInfo { hasNextPage, endCursor }`.
 * A source-specific `fetchPage` hands back the items plus the cursor state, and
 * this helper keeps walking pages until `hasNextPage` is false.
 */

export interface Page<T> {
  items: T[];
  hasNextPage: boolean;
  endCursor: string | null;
}

export async function paginate<T>(
  fetchPage: (cursor: string | null) => Promise<Page<T>>,
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;

  do {
    const page = await fetchPage(cursor);
    all.push(...page.items);
    cursor = page.hasNextPage ? page.endCursor : null;
  } while (cursor !== null);

  return all;
}
