import fs from 'node:fs';
import path from 'node:path';
import { SOURCES, validateData } from '../common/schema.js';
import { stableStringify } from '../common/stableStringify.js';
import { currentIsoWeek } from '../common/week.js';
import { getExtractor } from '../extractors/index.js';
import type { SourceName } from '../common/schema.js';
import { dataDir, flagString, parseFlags, readLatest, writeLatest } from './workspace.js';

const STUB_SOURCES: SourceName[] = ['converge', 'richpanel', 'aircall'];

const flags = parseFlags(process.argv.slice(2));
const brand = flagString(flags, 'brand', 'nanorevive');
const period = flagString(flags, 'period', currentIsoWeek()) || currentIsoWeek();
const outDir = flagString(flags, 'out', path.resolve(process.cwd(), '..', `brand-${brand}`));
const sourceArg = flagString(flags, 'source', 'all');

const envFixture = process.env.FIXTURE_MODE === '1' || process.env.FIXTURE_MODE === 'true';
const cliFixture = flags.fixture === true;
const fixtureMode = envFixture || cliFixture;

const sources: SourceName[] =
  sourceArg === 'all' ? [...SOURCES] : (sourceArg.split(',').map((s) => s.trim()) as SourceName[]);

interface RunResult {
  source: string;
  status: 'ok' | 'failed';
  error?: string;
}

const results: RunResult[] = [];

for (const source of sources) {
  try {
    const extractor = getExtractor(source);
    const isStub = STUB_SOURCES.includes(source);
    const envelope = await extractor.run({
      brand,
      period,
      fixtureMode: fixtureMode || isStub,
      env: process.env,
    });

    const errors = validateData(source, envelope.data);
    if (errors.length > 0) {
      throw new Error(`Schema validation failed: ${errors.join('; ')}`);
    }

    const file = path.join(dataDir(outDir), source, `${period}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, stableStringify(envelope));
    results.push({ source, status: 'ok' });
  } catch (error) {
    results.push({ source, status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

// Update the per-source "latest period" pointer only for sources that succeeded.
const latest = readLatest(outDir);
for (const result of results) {
  if (result.status === 'ok') latest[result.source] = period;
}
if (results.some((r) => r.status === 'ok')) {
  writeLatest(outDir, latest);
}

const summary = { brand, period, results };
process.stdout.write(`${JSON.stringify(summary)}\n`);

const failed = results.filter((r) => r.status === 'failed');
if (failed.length > 0) {
  process.stderr.write(`extract: ${failed.length} source(s) failed: ${failed.map((f) => f.source).join(', ')}\n`);
  process.exitCode = 1;
}
