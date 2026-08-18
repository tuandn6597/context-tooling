import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redactPii } from '../common/piiFilter.js';
import { generateMock } from '../extractors/mockData.js';

test('redactPii drops PII-named keys', () => {
  const input = {
    customerName: 'Jane Doe',
    email: 'jane.doe@example.com',
    phoneNumber: '+1 555-0100',
    address: '123 Main St',
    safe: 'keep me',
  };
  const output = redactPii(input) as Record<string, unknown>;
  assert.deepEqual(Object.keys(output).sort(), ['safe']);
  assert.equal(output.safe, 'keep me');
});

test('redactPii hashes stray email/phone values in non-PII fields', () => {
  const input = { note: 'contact jane.doe@example.com or +1 555-0100' };
  const output = redactPii(input) as Record<string, unknown>;
  const note = output.note as string;
  assert.ok(!note.includes('jane.doe@example.com'));
  assert.ok(!note.includes('555-0100'));
});

test('richpanel and aircall mock data are PII-free after filtering', () => {
  for (const source of ['richpanel', 'aircall'] as const) {
    const raw = generateMock(source, 'nanorevive', '2026-W33');
    const serialized = JSON.stringify(redactPii(raw));

    assert.ok(!serialized.includes('@example.com'), `${source} must not contain emails`);
    assert.ok(!serialized.includes('+1 555'), `${source} must not contain phone numbers`);
  }
});

test('richpanel/aircall mock contain PII before filtering (proves the test is meaningful)', () => {
  const raw = JSON.stringify(generateMock('richpanel', 'nanorevive', '2026-W33'));
  assert.ok(raw.includes('@example.com'));
});
