import fs from 'node:fs';
import path from 'node:path';
import { SOURCES } from '../common/schema.js';
import { currentIsoWeek, weekDistance } from '../common/week.js';
import { flagString, parseFlags, readEnvelope, readLatest } from './workspace.js';

const flags = parseFlags(process.argv.slice(2));
const brand = flagString(flags, 'brand', 'nanorevive');
const period = flagString(flags, 'period', currentIsoWeek()) || currentIsoWeek();
const outDir = flagString(flags, 'out', path.resolve(process.cwd(), '..', `brand-${brand}`));

const latest = readLatest(outDir);

const indexLines: string[] = [];
indexLines.push(`# ${capitalize(brand)} — context index`);
indexLines.push('');
indexLines.push('Start here if you are an agent or human looking for this brand\u2019s context.');
indexLines.push(`Current reporting week: **${period}**.`);
indexLines.push('');
indexLines.push('## Where the data lives');
indexLines.push('');
indexLines.push('| Source | Latest period | Fresh? | Data file |');
indexLines.push('|---|---|---|---|');
for (const source of SOURCES) {
  const latestPeriod = latest[source] ?? '(none)';
  const fresh = latestPeriod !== '(none)' && weekDistance(period, latestPeriod) <= 0;
  const file = latestPeriod === '(none)' ? '—' : `\`data/${source}/${latestPeriod}.json\``;
  indexLines.push(`| ${source} | ${latestPeriod} | ${fresh ? 'yes' : 'no'} | ${file} |`);
}
indexLines.push('');
indexLines.push('## Reading order for an agent');
indexLines.push('');
indexLines.push('1. `CONTEXT.md` — human/agent-readable summary of the latest week.');
indexLines.push('2. `data/<source>/<period>.json` — schema-validated raw rollups.');
indexLines.push('3. `RUNS.md` — append-only log of when each source last succeeded or failed.');
indexLines.push('');
indexLines.push('## Notes');
indexLines.push('');
indexLines.push('- Sources marked "no" are stale: `CONTEXT.md` will show their last known period.');
indexLines.push('- No PII is stored anywhere in this repo (filtered at extraction time).');
indexLines.push('');

fs.writeFileSync(path.join(outDir, 'INDEX.md'), indexLines.join('\n'));

// Append-only run log: the single place that records a run timestamp.
const statusBySource = SOURCES.map((source) => {
  const present = readEnvelope(outDir, source, period) !== null;
  return `${source}=${present ? 'ok' : 'stale'}`;
}).join(' ');

const runEntry = `- ${new Date().toISOString()} | period=${period} | ${statusBySource}\n`;
const runsFile = path.join(outDir, 'RUNS.md');
if (!fs.existsSync(runsFile)) {
  fs.writeFileSync(runsFile, `# Run log\n\n> Append-only. Run timestamps live here, never in data payloads.\n\n${runEntry}`);
} else {
  fs.appendFileSync(runsFile, runEntry);
}

process.stdout.write(`Wrote ${path.join(outDir, 'INDEX.md')} and appended to ${path.join(outDir, 'RUNS.md')}\n`);

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
