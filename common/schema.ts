import fs from 'node:fs';
import path from 'node:path';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { SCHEMAS_DIR } from './paths.js';

export type SourceName = 'shopify' | 'reddit' | 'converge' | 'richpanel' | 'aircall';

export const SOURCES: SourceName[] = ['shopify', 'reddit', 'converge', 'richpanel', 'aircall'];

let ajv: Ajv | undefined;
const validators = new Map<string, ValidateFunction>();

export function getAjv(): Ajv {
  if (!ajv) {
    ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
  }
  return ajv;
}

function loadSchema(source: SourceName): Record<string, unknown> {
  const file = path.join(SCHEMAS_DIR, 'v1', `${source}.schema.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

export function getValidator(source: SourceName): ValidateFunction {
  const cached = validators.get(source);
  if (cached) return cached;
  const validator = getAjv().compile(loadSchema(source));
  validators.set(source, validator);
  return validator;
}

export function validateData(source: SourceName, data: unknown): string[] {
  const validator = getValidator(source);
  if (validator(data)) return [];
  return (validator.errors ?? []).map(
    (e) => `${e.instancePath || '/'} ${e.message ?? 'invalid'}`,
  );
}
