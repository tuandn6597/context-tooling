import path from 'node:path';
import { SOURCES } from '../common/schema.js';
import { currentIsoWeek, weekDistance } from '../common/week.js';
import { flagString, parseFlags, readLatest } from './workspace.js';

// Reports which sources are stale relative to the current week. Informational:
// staleness is surfaced in INDEX.md / CONTEXT.md rather than treated as a hard
// failure (partial failure is normal by design).
const flags = parseFlags(process.argv.slice(2));
const brand = flagString(flags, 'brand', 'nanorevive');
const outDir = flagString(flags, 'out', path.resolve(process.cwd(), '..', `brand-${brand}`));
const period = flagString(flags, 'period', currentIsoWeek()) || currentIsoWeek();

const latest = readLatest(outDir);
const stale: string[] = [];

for (const source of SOURCES) {
  const latestPeriod = latest[source];
  if (!latestPeriod || weekDistance(period, latestPeriod) > 0) {
    stale.push(source);
  }
}

if (stale.length > 0) {
  process.stdout.write(`stale: ${stale.join(', ')}\n`);
} else {
  process.stdout.write('all sources fresh\n');
}
