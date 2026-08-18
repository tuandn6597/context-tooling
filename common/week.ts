/**
 * ISO-8601 week helpers. Weeks are the unit of the warehouse: every data file
 * is named `<source>/<period>.json` where period looks like "2026-W33".
 */

export function toIsoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // ISO: Monday=1 .. Sunday=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // move to Thursday of this week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function currentIsoWeek(date = new Date()): string {
  return toIsoWeek(date);
}

/** Compare two ISO weeks as numbers of weeks apart (positive = b is after a). */
export function weekDistance(a: string, b: string): number {
  const [ay, aw] = parseWeek(a);
  const [by, bw] = parseWeek(b);
  return by * 52 + bw - (ay * 52 + aw);
}

function parseWeek(week: string): [number, number] {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(week);
  if (!match) throw new Error(`Invalid ISO week: ${week}`);
  return [Number(match[1]), Number(match[2])];
}
