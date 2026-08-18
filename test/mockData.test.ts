import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redactPii } from '../common/piiFilter.js';
import { stableStringify } from '../common/stableStringify.js';
import { SOURCES, validateData } from '../common/schema.js';
import { extractors } from '../extractors/index.js';
import { generateMock } from '../extractors/mockData.js';

test('generated mock is deterministic for the same week', () => {
  const a = generateMock('shopify', 'nanorevive', '2026-W34');
  const b = generateMock('shopify', 'nanorevive', '2026-W34');
  assert.equal(stableStringify(a), stableStringify(b));
});

test('generated mock differs across weeks', () => {
  const a = generateMock('shopify', 'nanorevive', '2026-W34');
  const b = generateMock('shopify', 'nanorevive', '2026-W35');
  assert.notEqual(stableStringify(a), stableStringify(b));
});

test('generated richpanel/aircall mock contains fake PII, and redactPii removes it', () => {
  const richpanelRaw = generateMock('richpanel', 'nanorevive', '2026-W34');
  const richpanelStr = JSON.stringify(richpanelRaw);
  assert.ok(richpanelStr.includes('@example.com'), 'richpanel generated mock should contain fake email');
  assert.ok(richpanelStr.includes('+1 555'), 'richpanel generated mock should contain fake phone');

  const aircallRaw = generateMock('aircall', 'nanorevive', '2026-W34');
  const aircallStr = JSON.stringify(aircallRaw);
  assert.ok(aircallStr.includes('+1 555'), 'aircall generated mock should contain fake phone');

  const filteredRichpanel = JSON.stringify(redactPii(richpanelRaw));
  assert.ok(!filteredRichpanel.includes('@example.com'), 'richpanel must be email-free after redact');
  assert.ok(!filteredRichpanel.includes('+1 555'), 'richpanel must be phone-free after redact');

  const filteredAircall = JSON.stringify(redactPii(aircallRaw));
  assert.ok(!filteredAircall.includes('+1 555'), 'aircall must be phone-free after redact');
});

test('full extractor pipeline works for a week with no static fixture', async () => {
  for (const source of SOURCES) {
    const envelope = await extractors[source].run({
      brand: 'nanorevive',
      period: '2026-W34',
      fixtureMode: true,
      env: {},
    });
    const errors = validateData(source, envelope.data);
    assert.deepEqual(errors, [], `${source} generated W34 should validate: ${errors.join('; ')}`);
  }
});
