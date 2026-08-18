import type { SourceName } from '../common/schema.js';
import type { Extractor } from './types.js';
import { shopifyExtractor } from './shopify.js';
import { redditExtractor } from './reddit.js';
import { convergeExtractor } from './converge.js';
import { richpanelExtractor } from './richpanel.js';
import { aircallExtractor } from './aircall.js';

export const extractors: Record<SourceName, Extractor> = {
  shopify: shopifyExtractor,
  reddit: redditExtractor,
  converge: convergeExtractor,
  richpanel: richpanelExtractor,
  aircall: aircallExtractor,
};

export function getExtractor(source: string): Extractor {
  const ex = extractors[source as SourceName];
  if (!ex) throw new Error(`Unknown source "${source}". Expected one of: ${Object.keys(extractors).join(', ')}`);
  return ex;
}
