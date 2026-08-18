import { makeEnvelope } from '../common/envelope.js';
import { redactPii } from '../common/piiFilter.js';
import type { SourceName } from '../common/schema.js';
import type { ExtractContext, Extractor } from './types.js';

export interface ExtractorSpec {
  source: SourceName;
  redactPii: boolean;
  fetchRaw: (ctx: ExtractContext) => Promise<unknown>;
  normalize: (raw: unknown) => unknown;
}

/**
 * Shared pipeline: fetch raw -> (optionally) redact PII at extraction time ->
 * normalize -> wrap in the common envelope. Keeps all five sources on the same
 * code path and guarantees PII is never written to disk.
 */
export function createExtractor(spec: ExtractorSpec): Extractor {
  return {
    source: spec.source,
    redactPii: spec.redactPii,
    async run(ctx: ExtractContext) {
      let raw = await spec.fetchRaw(ctx);
      if (spec.redactPii) {
        raw = redactPii(raw);
      }
      const data = spec.normalize(raw);
      return makeEnvelope({
        brand: ctx.brand,
        source: spec.source,
        period: ctx.period,
        status: 'ok',
        data,
      });
    },
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
