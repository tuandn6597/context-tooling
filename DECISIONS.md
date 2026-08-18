# DECISIONS.md

Multi-brand context warehouse — one page on the choices that matter.

## 1. Access model: Option B (repo per brand + shared `context-tooling`)

GitHub does **not** do folder-level read permission — the repo is the security
boundary. The stated requirement ("different brands, different people, same
shared context") is therefore **not directly buildable**, so I picked a lane.

**Option B:** one repo per brand (`brand-nanorevive`, `brand-pawprint-lab`,
`brand-saunastack`) plus a shared `context-tooling` repo consumed as a reusable
workflow (`workflow_call`). Why:

- It is the **only** option where an *outside collaborator* (who cannot join a
  team) gets access to exactly one brand: invite them to the single brand repo
  with `Read`/`Write` as needed. Options A (monorepo) and C (mirror repos) both
  leak all brands to a collaborator granted repo access.
- Agents get a **read-only path**: a fine-grained PAT or GitHub App with
  `contents:read` scoped to the minimum set of brand repos they need. Rotation
  answer: PATs get a short expiry (e.g. 30 days) and are issued per agent; a
  GitHub App with installation tokens is preferred because tokens are short-lived
  and revocable per installation.
- `context-tooling` is versioned and tagged (`@v1`, `@main`); brand repos pin to a
  tag so a breaking extractor change doesn't silently hit all brands.

**Cost of adding brand #4:** add one `include` entry to the matrix in
`refresh-all-brands.yml`, then create the brand repo from a template — just 3
config files (a ~15-line dispatch-only `refresh-context.yml` caller, `.gitignore`,
`README.md`). Grant collaborators and add the repo to the `BRAND_DISPATCH_TOKEN`
scope. No new job code — the reusable workflow is the single code path. 2-3
minutes, zero copy-paste of pipeline logic.

**Cost of onboarding a contractor who may only see one brand:** invite them to
that one repo only. They read `INDEX.md` -> `CONTEXT.md` -> `data/`. They can
run `npm run extract` from `context-tooling` if given a read-only checkout of
the tooling repo, or just read the generated artifacts. No cross-brand leakage.

## 1.5 Matrix over brands (hybrid: Option B + orchestrator)

The requirement says *"Matrix over brands. One code path, three brands — if
adding brand #4 means copy-pasting a job, that's a fail."* Option B alone has no
literal matrix, so we added an **orchestrator** in `context-tooling`:

- `.github/workflows/refresh-all-brands.yml` holds a real
  `strategy.matrix.include` over the three brands and is the **single scheduled
  entry point** (`0 22 * * 0` UTC = Monday 05:00 Vietnam).
- Each matrix job dispatches `workflow_dispatch` to that brand's own repo
  (`brand-nanorevive`, ...) via `gh api`, so the reusable workflow still runs in
  the brand repo with that repo's own secrets. Access control stays Option B.
- **Adding brand #4** = one new `include` entry in the matrix + create the brand
  repo. No job copy-paste. The reusable `refresh.yml` stays the one code path.
- The brand repo's `refresh-context.yml` is kept **dispatch-only** (no schedule)
  so a week isn't refreshed twice; manual per-brand runs still work.
- Cost: one `BRAND_DISPATCH_TOKEN` secret (PAT or GitHub App with `workflow`
  scope on all brand repos) in `context-tooling`. A missing/unreachable brand
  repo is `continue-on-error` so it never blocks the other brands, but a gate
  step then fails that matrix job so the run turns red instead of hiding it.

## 2. Schema versioning

- Schemas live in `/schemas/v1/*.schema.json`; the envelope carries
  `schemaVersion: "v1"`.
- **Never mutate a published schema in place.** A breaking change (new required
  field, removed field, changed type) ships as `/schemas/v2/...` alongside `v1`,
  and the extractor bumps the envelope's `schemaVersion`.
- Additive, backward-compatible changes (new optional field) stay on `v1`.
- Every extract run validates `data` against its schema and **fails loudly** on
  mismatch (this doubles as the drift check). `validateSchema` re-checks all
  committed files.

## 3. What I'd do differently with 3 weeks instead of 6 hours

- Wire **Converge and Richpanel live** (not just stubs) with real pagination and
  rate-limit handling.
- Add a **GitHub App** (not a fine-grained PAT) for agent read-only access, with
  per-repo installation and token rotation automation.
- Add a **retention job** that prunes `data/<source>/<older weeks>.json` beyond a
  sliding window and rewrites `latest.json`; plus a projected-size check in CI.
- Property-based / golden-file tests for `stableStringify` and every extractor's
  normalize, and a `context-pack` command that assembles one LLM-sized file per
  brand + date range.
- Move the weekly trigger off GitHub Actions `schedule` (best-effort; runs can
  fire 15-60 min late or be skipped during high load) to an external cron
  (Cloud Scheduler / EventBridge) that calls `workflow_dispatch`, so 05:00
  Monday is actually 05:00 Monday — and alert when the expected run never landed.
- Add failure notifications (Slack / email / webhook) when a source run fails or
  a brand goes stale, so a broken night doesn't go unnoticed until someone reads
  `INDEX.md`.

## 4. Deliberately out of scope (and why)

- **Dashboards, database, web UI, LLM calls** — per the brief, this is plumbing.
- **Full Reddit comment archiving** — Reddit ToS restricts bulk archiving; we
  store rollups + links only.
- **Live Richpanel/Aircall/Converge** — stubbed with `FIXTURE_MODE=1`; the
  modules, schemas, and workflow jobs are real, only the network call is a fixture.
- **Folder-level read permissions** — impossible on GitHub; solved by Option B.
- **Retention enforcement automation** — the policy is documented (see README);
  the pruning job is a stretch item.

## Projected repo size after 2 years

Each weekly file is a rollup, roughly 1–5 KB. Five sources × ~3 KB ≈ **15 KB/week**.
Over 2 years (~104 weeks) that is **~1.5 MB per brand** before any retention.
With a 26-week retention window it is **~400 KB per brand**, comfortably bounded.
`RUNS.md` grows ~200 bytes/run; negligible.
