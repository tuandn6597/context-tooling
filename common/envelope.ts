/**
 * The shared envelope every source data file uses.
 *
 * Deliberately contains NO runtime timestamp: `period` is the *data* period
 * (an ISO week such as "2026-W33") and never changes between re-runs of the
 * same week. Run timestamps live only in RUNS.md, so re-running is idempotent
 * and git history stays a clean audit log rather than noise.
 */

export type SourceStatus = 'ok' | 'partial' | 'failed' | 'stale';

export interface Envelope {
  schemaVersion: string;
  brand: string;
  source: string;
  period: string;
  status: SourceStatus;
  data: unknown;
}

export function makeEnvelope(input: {
  brand: string;
  source: string;
  period: string;
  status: SourceStatus;
  data: unknown;
  schemaVersion?: string;
}): Envelope {
  return {
    schemaVersion: input.schemaVersion ?? 'v1',
    brand: input.brand,
    source: input.source,
    period: input.period,
    status: input.status,
    data: input.data,
  };
}
