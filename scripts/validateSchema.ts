import path from 'node:path';
import { SOURCES, validateData } from '../common/schema.js';
import { flagString, listPeriods, parseFlags, readEnvelope } from './workspace.js';

// Validates every committed data file against its JSON Schema. Also usable as
// a drift check: run it after extraction and it fails if any source is invalid.
const flags = parseFlags(process.argv.slice(2));
const brand = flagString(flags, 'brand', 'nanorevive');
const outDir = flagString(flags, 'out', path.resolve(process.cwd(), '..', `brand-${brand}`));

let failures = 0;

for (const source of SOURCES) {
  for (const period of listPeriods(outDir, source)) {
    const envelope = readEnvelope(outDir, source, period);
    if (!envelope) continue;
    const errors = validateData(source, envelope.data);
    if (errors.length > 0) {
      failures += 1;
      process.stderr.write(`${source}/${period}: ${errors.join('; ')}\n`);
    }
  }
}

if (failures > 0) {
  process.stderr.write(`validateSchema: ${failures} file(s) failed validation.\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`validateSchema: all files for ${brand} are valid.\n`);
}
