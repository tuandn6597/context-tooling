import { requireSecret } from '../common/secrets.js';
import { createExtractor } from './base.js';
import { loadFixture } from './fixture.js';
import type { ExtractContext } from './types.js';

/**
 * Reddit is a voice-of-customer source. We store *rollups + links only*,
 * never full comment bodies: Reddit's ToS restricts bulk archiving of user
 * content. The raw fixture already reflects this shape.
 */

const KEYWORDS = ['nanorevive', 'nanorevive serum', 'retinol serum', 'night cream'];

async function getAccessToken(env: NodeJS.ProcessEnv): Promise<string> {
  const clientId = requireSecret(env, 'REDDIT_CLIENT_ID');
  const clientSecret = requireSecret(env, 'REDDIT_CLIENT_SECRET');
  const username = requireSecret(env, 'REDDIT_USERNAME');
  const password = requireSecret(env, 'REDDIT_PASSWORD');

  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'context-warehouse/0.1 (voice-of-customer rollup)',
    },
    body: new URLSearchParams({ grant_type: 'password', username, password }).toString(),
  });

  if (!res.ok) throw new Error(`Reddit OAuth failed: HTTP ${res.status}`);
  const json = (await res.json()) as any;
  return json.access_token as string;
}

async function searchKeyword(token: string, keyword: string): Promise<any[]> {
  const res = await fetch(
    `https://oauth.reddit.com/search?q=${encodeURIComponent(keyword)}&sort=new&limit=100&t=week`,
    {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'context-warehouse/0.1' },
    },
  );
  if (!res.ok) throw new Error(`Reddit search failed: HTTP ${res.status}`);
  const json = (await res.json()) as any;
  return (json?.data?.children ?? []) as any[];
}

async function fetchLive(ctx: ExtractContext): Promise<any> {
  const token = await getAccessToken(ctx.env);
  const keywordList = KEYWORDS; // brand keywords can be extended per brand later
  const searches = [];
  for (const keyword of keywordList) {
    // Respect Reddit's strict rate limit: sleep between keyword searches.
    const children = await searchKeyword(token, keyword);
    searches.push({ keyword, children });
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { searches };
}

function normalize(raw: any) {
  const seen = new Map<
    string,
    { id: string; subreddit: string; title: string; url: string; createdUtc: number; score: number }
  >();
  const byKeyword: Array<{ keyword: string; mentions: number }> = [];

  for (const search of raw?.searches ?? []) {
    const children = search?.children ?? [];
    byKeyword.push({ keyword: search?.keyword ?? '', mentions: children.length });
    for (const child of children) {
      if (child?.id && !seen.has(child.id)) {
        seen.set(child.id, {
          id: child.id,
          subreddit: child.subreddit ?? '',
          title: child.title ?? '',
          url: child.url ?? '',
          createdUtc: child.createdUtc ?? 0,
          score: child.score ?? 0,
        });
      }
    }
  }

  const posts = [...seen.values()].sort((a, b) => a.id.localeCompare(b.id));
  return { mentions: { total: posts.length }, byKeyword, posts };
}

export const redditExtractor = createExtractor({
  source: 'reddit',
  redactPii: false,
  fetchRaw: (ctx) => (ctx.fixtureMode ? Promise.resolve(loadFixture('reddit', ctx.period, ctx.brand)) : fetchLive(ctx)),
  normalize,
});
