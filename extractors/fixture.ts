import fs from 'node:fs';
import path from 'node:path';
import { FIXTURES_DIR } from '../common/paths.js';
import type { SourceName } from '../common/schema.js';
import { generateMock } from './mockData.js';

/**
 * Returns mock raw data for a source + period.
 *
 * If a hand-crafted fixture exists at `fixtures/<source>/<period>.json`, use it.
 * Otherwise, generate a deterministic mock payload seeded by (brand, source,
 * period) so mock mode works for any week with no manual fixture creation.
 */
export function loadFixture(source: SourceName, period: string, brand: string): unknown {
  const file = path.join(FIXTURES_DIR, source, `${period}.json`);
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  }
  return generateMock(source, brand, period);
}
