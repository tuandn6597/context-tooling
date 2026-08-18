import { createHash } from 'node:crypto';

/**
 * PII filter — applied at extraction time, never as a cleanup pass later.
 *
 * Git remembers history, so "write it then scrub it later" is not good enough.
 * This filter:
 *   1. Drops any object key whose name looks like a PII field
 *      (name / email / phone / address).
 *   2. Hashes any remaining *string value* that looks like an email or a phone
 *      number, as defence-in-depth for PII hiding in free-text fields.
 *
 * The result is deterministic (no salt), which keeps extraction idempotent.
 */

const PII_KEY_FRAGMENTS = ['name', 'email', 'phone', 'address'];

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/;

function isPiiKey(key: string): boolean {
  const k = key.toLowerCase();
  return PII_KEY_FRAGMENTS.some((fragment) => k.includes(fragment));
}

function hashValue(value: string): string {
  const digest = createHash('sha256').update(value).digest('hex').slice(0, 16);
  return `sha256:${digest}`;
}

function looksLikePiiValue(value: string): boolean {
  return EMAIL_RE.test(value) || PHONE_RE.test(value);
}

export function redactPii(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactPii);
  }

  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(source)) {
      if (isPiiKey(key)) {
        continue; // drop the field entirely
      }
      out[key] = redactPii(child);
    }
    return out;
  }

  if (typeof value === 'string' && looksLikePiiValue(value)) {
    return hashValue(value);
  }

  return value;
}
