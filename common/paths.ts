import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolves to the repo root (the directory that contains package.json),
// independent of the caller's current working directory.
export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const FIXTURES_DIR = path.join(ROOT_DIR, 'fixtures');
export const SCHEMAS_DIR = path.join(ROOT_DIR, 'schemas');
