# context-tooling

Shared extractors, JSON Schemas, and the reusable GitHub Actions workflow that
refresh the per-brand context repos every 7 days.

This is the plumbing layer: extract -> validate -> normalize -> commit. No
dashboard, no DB, no LLM calls.

## Layout

```
common/          stableStringify, PII filter, envelope, pagination, rate limit
extractors/      one module per source, all behind a single Extractor interface
schemas/v1/      JSON Schema per source (versioned)
scripts/         extract, generateContext, generateIndex, validateSchema, checkStaleness
test/            idempotency, PII filter, schema validation (node:test)
.github/workflows/refresh.yml            reusable workflow (workflow_call)
.github/workflows/refresh-all-brands.yml matrix orchestrator (dispatches every brand repo)
```

## Run locally (fixture mode, no live keys)

```bash
npm ci
npm test

npm run extract -- --brand nanorevive --source all --period 2026-W33 --out ../brand-nanorevive --fixture
npm run generate:context -- --brand nanorevive --period 2026-W33 --out ../brand-nanorevive
npm run generate:index  -- --brand nanorevive --period 2026-W33 --out ../brand-nanorevive
```

## Live mode

Drop `--fixture` (or set `FIXTURE_MODE=0`) and provide the required secrets.
Shopify is mandatory-live; Reddit is the second live source. Converge,
Richpanel, and Aircall are stubbed and always read deterministic mock data
(generated per `brand + source + period` in `extractors/mockData.ts`).

## Scheduled refresh

`refresh-all-brands.yml` is the single scheduled entry point. It holds a real
matrix over brands and dispatches each brand repo's `refresh-context` workflow:

- Add a brand: add one `include` entry to the matrix + create the brand repo.
  No job copy-paste.
- Brand repos must live under the same owner/org as `context-tooling`.
- Requires a `BRAND_DISPATCH_TOKEN` secret here (PAT or GitHub App with
  `workflow` scope on all brand repos). Brand repos stay dispatch-only so a week
  isn't refreshed twice; they can still be run manually per brand. A failed
  dispatch doesn't block other brands but fails that matrix job (run turns red).

## Non-negotiables enforced here

- **No PII in the repo** — `common/piiFilter.ts` drops/hashes at extraction time.
- **Idempotent diffs** — `common/stableStringify.ts` sorts keys; no run timestamps
  in payloads (those live only in `RUNS.md`).
- **Partial failure is normal** — each source fails independently in the workflow.
- **Secrets** — read from the environment only; a missing secret fails loudly.
