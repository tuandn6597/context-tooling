import fs from 'node:fs';
import path from 'node:path';
import type { Envelope } from '../common/envelope.js';
import { stableStringify } from '../common/stableStringify.js';

export type Flags = Record<string, string | true>;

export function parseFlags(argv: string[]): Flags {
  const out: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

export function flagString(flags: Flags, key: string, fallback: string): string {
  const v = flags[key];
  return typeof v === 'string' ? v : fallback;
}

export function dataDir(outDir: string): string {
  return path.join(outDir, 'data');
}

export function latestPath(outDir: string): string {
  return path.join(dataDir(outDir), 'latest.json');
}

export function readLatest(outDir: string): Record<string, string> {
  const file = latestPath(outDir);
  if (!fs.existsSync(file)) return {};
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key !== 'schemaVersion' && typeof value === 'string') out[key] = value;
  }
  return out;
}

export function writeLatest(outDir: string, latest: Record<string, string>): void {
  const file = latestPath(outDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload: Record<string, unknown> = { schemaVersion: 'v1', ...latest };
  fs.writeFileSync(file, stableStringify(payload));
}

export function readEnvelope(outDir: string, source: string, period: string): Envelope | null {
  const file = path.join(dataDir(outDir), source, `${period}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Envelope;
}

export function listPeriods(outDir: string, source: string): string[] {
  const dir = path.join(dataDir(outDir), source);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}
