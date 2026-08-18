import { createExtractor, round2 } from './base.js';
import { loadFixture } from './fixture.js';

/**
 * Aircall is PII-heavy: caller names and phone numbers are dropped/hashed at
 * extraction time by the shared pipeline before normalize.
 */
function normalize(raw: any) {
  const calls = raw?.calls ?? [];
  const totalDurationSeconds = calls.reduce(
    (sum: number, c: any) => sum + Number(c?.durationSeconds ?? 0),
    0,
  );

  const dispositionCounts = new Map<string, number>();
  for (const c of calls) {
    if (c?.disposition) {
      dispositionCounts.set(c.disposition, (dispositionCounts.get(c.disposition) ?? 0) + 1);
    }
  }

  const dispositions = [...dispositionCounts.entries()]
    .map(([disposition, count]) => ({ disposition, count }))
    .sort((a, b) => b.count - a.count || a.disposition.localeCompare(b.disposition));

  return {
    callCount: calls.length,
    totalDurationSeconds,
    avgDurationSeconds: calls.length ? round2(totalDurationSeconds / calls.length) : 0,
    dispositions,
  };
}

export const aircallExtractor = createExtractor({
  source: 'aircall',
  redactPii: true,
  fetchRaw: (ctx) => Promise.resolve(loadFixture('aircall', ctx.period, ctx.brand)),
  normalize,
});
