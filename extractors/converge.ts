import { createExtractor, round2 } from './base.js';
import { loadFixture } from './fixture.js';

/**
 * Converge is stubbed for the trial (FIXTURE_MODE). The schema forces an
 * explicit `attributionModel` so a reader always knows which number they're
 * looking at — blended ROAS here, not last-click.
 */
function normalize(raw: any) {
  const adSpend = Number(raw?.adSpend ?? 0);
  const attributedRevenue = Number(raw?.attributedRevenue ?? 0);
  const blendedRoas = adSpend > 0 ? round2(attributedRevenue / adSpend) : 0;

  const byChannel = (raw?.channels ?? [])
    .map((c: any) => {
      const spend = Number(c?.spend ?? 0);
      const revenue = Number(c?.attributedRevenue ?? 0);
      return {
        channel: c?.channel ?? '',
        spend: round2(spend),
        attributedRevenue: round2(revenue),
        roas: spend > 0 ? round2(revenue / spend) : 0,
      };
    })
    .sort((a: any, b: any) => a.channel.localeCompare(b.channel));

  return {
    attributionModel: raw?.attributionModel ?? 'blended',
    currency: raw?.currency ?? 'USD',
    adSpend: round2(adSpend),
    attributedRevenue: round2(attributedRevenue),
    blendedRoas,
    byChannel,
  };
}

export const convergeExtractor = createExtractor({
  source: 'converge',
  redactPii: false,
  fetchRaw: (ctx) => Promise.resolve(loadFixture('converge', ctx.period, ctx.brand)),
  normalize,
});
