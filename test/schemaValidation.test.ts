import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SOURCES, validateData } from '../common/schema.js';
import { extractors } from '../extractors/index.js';
import type { ExtractContext } from '../extractors/types.js';

const ctx: ExtractContext = {
  brand: 'nanorevive',
  period: '2026-W33',
  fixtureMode: true,
  env: {},
};

for (const source of SOURCES) {
  test(`${source} output validates against its v1 schema`, async () => {
    const envelope = await extractors[source].run(ctx);
    const errors = validateData(source, envelope.data);
    assert.deepEqual(errors, [], `schema errors for ${source}: ${errors.join('; ')}`);
  });
}
