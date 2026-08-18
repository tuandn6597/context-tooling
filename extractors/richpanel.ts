import { createExtractor } from './base.js';
import { loadFixture } from './fixture.js';

/**
 * Richpanel is PII-heavy (customer names, emails, phone numbers). The shared
 * pipeline runs `redactPii` on the raw payload *before* normalize, so the PII
 * never reaches disk. The fixture deliberately contains PII so the test proves
 * the filter works.
 */
function normalize(raw: any) {
  const tickets = raw?.tickets ?? [];
  const tagCounts = new Map<string, number>();
  const themeCounts = new Map<string, number>();

  for (const t of tickets) {
    for (const tag of t?.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    if (t?.theme) {
      themeCounts.set(t.theme, (themeCounts.get(t.theme) ?? 0) + 1);
    }
  }

  const topTags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  const topThemes = [...themeCounts.entries()]
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme));

  return { ticketVolume: tickets.length, topTags, topThemes };
}

export const richpanelExtractor = createExtractor({
  source: 'richpanel',
  redactPii: true,
  fetchRaw: (ctx) => Promise.resolve(loadFixture('richpanel', ctx.period, ctx.brand)),
  normalize,
});
