import type { Envelope } from '../common/envelope.js';
import type { SourceName } from '../common/schema.js';

export interface ExtractContext {
  brand: string;
  period: string;
  fixtureMode: boolean;
  env: NodeJS.ProcessEnv;
}

/**
 * Every extractor — live or fixture — implements this one interface, which is
 * what gives us "one code path, three brands, five sources".
 */
export interface Extractor {
  readonly source: SourceName;
  readonly redactPii: boolean;
  run(ctx: ExtractContext): Promise<Envelope>;
}
