import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stableStringify } from '../common/stableStringify.js';
import { extractors } from '../extractors/index.js';
import { SOURCES } from '../common/schema.js';
import type { ExtractContext } from '../extractors/types.js';

test('stableStringify sorts keys recursively', () => {
  const input = { z: 1, a: { y: 2, x: 3 }, m: [1, 2, 3] };
  const output = stableStringify(input);
  assert.equal(output, '{\n  "a": {\n    "x": 3,\n    "y": 2\n  },\n  "m": [\n    1,\n    2,\n    3\n  ],\n  "z": 1\n}\n');
});

test('running an extractor twice on the same week is byte-identical', async () => {
  const ctx: ExtractContext = {
    brand: 'nanorevive',
    period: '2026-W33',
    fixtureMode: true,
    env: {},
  };

  for (const source of SOURCES) {
    const first = await extractors[source].run(ctx);
    const second = await extractors[source].run(ctx);
    assert.equal(
      stableStringify(first),
      stableStringify(second),
      `source ${source} should be idempotent`,
    );
  }
});
