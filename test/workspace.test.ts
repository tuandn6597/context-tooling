import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFlags } from '../scripts/workspace.js';

test('parseFlags handles --key=value form', () => {
  const flags = parseFlags([
    '--brand=pawprint-lab',
    '--source=shopify',
    '--period=2026-W34',
    '--out=..',
  ]);
  assert.equal(flags.brand, 'pawprint-lab');
  assert.equal(flags.source, 'shopify');
  assert.equal(flags.period, '2026-W34');
  assert.equal(flags.out, '..');
});

test('parseFlags handles --key value and bare flags', () => {
  const flags = parseFlags(['--brand', 'saunastack', '--fixture']);
  assert.equal(flags.brand, 'saunastack');
  assert.equal(flags.fixture, true);
});

test('parseFlags ignores non-flag args', () => {
  const flags = parseFlags(['extract', '--brand=nanorevive', 'x']);
  assert.equal(flags.brand, 'nanorevive');
  assert.equal(flags.x, undefined);
});
