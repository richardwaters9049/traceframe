# Traceframe agent guide

This file is the project-wide source of truth for coding agents working on
Traceframe. Read it before making changes. Instructions in a more deeply nested
`AGENTS.md` also apply to files under that directory; for the Next.js app, read
`apps/web/AGENTS.md` before editing framework code.

## Product intent

Traceframe is an independent portfolio project designed to demonstrate secure,
evidence-led software engineering. It is a fictional incident-analysis and case
coordination workspace built only with synthetic data.

The surrounding repositories in `cyber-work` may be inspected for inspiration,
but they are not dependencies and Traceframe should not copy their layouts,
branding, code, or product identity. The result should feel specific to this
project and the role it supports.

## Technology and service boundaries

- Frontend and browser-facing server: Next.js 16, React 19, TypeScript,
  Tailwind CSS 4, shadcn-style components, Base UI, and Motion APIs.
- JavaScript package manager and runtime: Bun. Do not introduce npm, pnpm, or
  Yarn lockfiles.
- Browser API boundary: same-origin Next.js Route Handlers under `app/api`.
  Do not add FastAPI, Spring Boot, or a second browser-facing API service.
- Database: PostgreSQL with Drizzle ORM.
- Object storage: MinIO for original source material.
- Background processing: Python worker. It is not an HTTP server; it maintains
  readiness/health state, removes expired sessions, processes source ingestion,
  and reconciles original-source disposal.
- Local orchestration: Docker Compose. The web app, worker, database, and MinIO
  must continue to run as containers. The one-shot `migrate` service must finish
  successfully before seed, web, and worker startup.
- Production orchestration: Render Blueprint. Only the Next.js service is
  public; the worker and MinIO remain private, and managed PostgreSQL has no
  public allow-list. Do not add secrets to `render.yaml` or committed files.
- Portfolio orchestration: `render.portfolio.yaml` runs Next.js and the Python worker
  as separately supervised processes in one Render Free Web Service, with Neon
  PostgreSQL and Cloudflare R2. This is the only approved co-location exception;
  Python remains non-HTTP and the paid production profile stays separated.

Next.js owns the UI and its same-origin HTTP boundary, so normal browser flows
do not require CORS. Authentication, authorisation, validation, and safe data
handling are still mandatory at every server boundary.

## Application structure

The only user-facing page routes are:

- `/` for login and landing content.
- `/dashboard` for the authenticated application shell.

Architecture, case creation, case lists, and individual case workspaces are
components rendered inside the dashboard shell. Do not create page routes for
`/architecture`, `/cases`, `/cases/new`, or `/cases/[id]`. Do not encode drawer,
modal, tab, selected-case, or active-workspace state in the URL or query string.
Manage those states in `WorkspaceUIProvider` and open them through component
actions. Existing legacy redirects may remain for safe navigation.

Prefer Server Components. Add `"use client"` only where browser interaction,
local state, or animation requires it, and keep client boundaries focused.

## Current product state

The completed application slice includes authentication, a responsive protected
workspace, a paginated case register, on-demand case workspaces, case creation,
a globally verified audit ledger, an audited open/closed case lifecycle, a
narrow end-to-end evidence-ingestion workflow, and reviewable analyst findings.
Keep these current boundaries intact:

- The dashboard fetches a bounded 20-record summary page; it must not eagerly
  load every case workspace or audit history.
- `GET /api/cases` uses opaque `(created_at, id)` cursor pagination and caps a
  page at 50 records.
- `GET /api/cases/:id` loads one selected workspace on demand.
- `POST /api/cases` creates the case and its first global audit event atomically.
- `PATCH /api/cases/:id` locks the case, enforces closure preconditions, updates
  its lifecycle state, and appends the corresponding global audit event atomically.
- Closed cases remain readable but reject source uploads, finding proposals,
  and finding reviews until an authorised user reopens them.
- The global audit verifier reports typed `verified`, `broken`, or `unavailable`
  states. A case audit view is only a filtered view of that global ledger.
- `POST /api/cases/:id/sources` accepts one validated UTF-8 TXT, LOG, CSV, or
  JSON source up to 1 MiB and creates its provenance, job, and global audit event.
- The Python worker claims jobs with `FOR UPDATE SKIP LOCKED`, verifies source
  integrity, normalises text, retries safely, and derives counted email, URL,
  IPv4, domain, embedded SHA-256, and bounded user-agent observations.
- Terminal ingestion failures expose only sanitised failure state and bounded
  attempt counts. An analyst or admin may requeue a failed source only while
  its case is open and its original remains retained; the job reset, source
  transition, and `source.ingestion_retried` audit event commit atomically.
- The case workspace shows processing status, SHA-256 provenance, normalisation
  counts, and derived observations without exposing original content.
- Original source objects are retained by default. An authenticated analyst or
  admin may queue disposal only after ingestion is terminal and while the case
  is open. The worker retries idempotent deletion; provenance, normalised
  analysis, observations, findings, and audit history remain after disposal.
- One derived observation may be promoted into one finding. Findings begin as
  `proposed` and may transition once to `confirmed` or `dismissed` with a
  required rationale.
- Finding proposals and decisions update the finding and append their global
  audit event atomically. Notes and rationale stay out of logs and audit metadata.
- Case finding summaries are derived server-side from the returned finding
  collection. Status and indicator filters remain local workspace state and do
  not use routes, query strings, or extra database requests.
- Reviewed-finding exports contain terminal `confirmed` and `dismissed` records
  only. CSV, JSON, and ZIP downloads are authenticated, non-cacheable, and named
  with the opaque case ID; the case workspace also provides a print-only summary.
- ZIP hand-off bundles require at least one reviewed finding and a verified
  global ledger. They contain reviewed JSON/CSV, a hand-off note, and a manifest
  with hashed report files and referenced-source provenance. Never include
  original objects or normalised source text.
- Cross-source relationships load on demand and include only indicators found
  in at least two ready sources within the selected case. Preserve the limits
  of 50 correlations and 10 displayed source records per correlation.
- SHA-256 observations represent isolated 64-character hexadecimal values found
  in normalised source text. Keep strict boundaries and lowercase normalisation;
  do not classify partial or longer hexadecimal strings as hashes.
- User-agent observations come only from explicit, case-insensitive
  `User-Agent:` header lines. Collapse horizontal whitespace, reject empty,
  control-character, and over-512-character values, and retain at most 50
  distinct user agents per source.
- Production infrastructure is defined in `render.yaml`. GitHub Actions is the
  release gate and Render deploys checked `main` commits. Provisioned runtime
  state, backups, alerts, and restore drills must not be claimed from the
  infrastructure definition alone.
- The zero-cost portfolio profile is defined separately in `render.portfolio.yaml`.
  Preserve its fail-together process supervision, direct migration connection,
  pooled runtime connection, private bucket credentials, and explicit demo-only
  limitations. Never silently replace the paid production topology with it.

The ingestion slice is intentionally bounded. Large-file streaming, binary
parsers, further observation types, automatic time-based retention, and
production operations dashboards and alerting are planned product work. Do not describe
those features as implemented, and do not treat their absence as unresolved
debt from the 19/07/2026 review.

## Security invariants

- Use synthetic data only. Never add real personal, investigative, or sensitive
  information to fixtures, screenshots, seeds, tests, or commits.
- Treat all request data as untrusted and validate it at the Route Handler.
- Derive identity and audit actors from the authenticated server-side session;
  never accept them from browser payloads.
- Keep the opaque session token in an HttpOnly, SameSite cookie and store only
  its SHA-256 digest in PostgreSQL.
- Preserve database-backed login throttling, generic authentication failures,
  normalised email lookup, and uniqueness on `lower(email)`.
- Require explicit same-origin validation on every state-changing Route Handler.
- Enforce role capabilities at the server boundary: `analyst` and `admin` may
  read/create/close/reopen cases, upload, retry and dispose original sources,
  and manage findings;
  `reviewer` is read-only, and unknown roles fail closed.
- Preserve case-row locking across lifecycle transitions, source uploads,
  source-disposal requests, finding proposals, and finding reviews so closed
  cases cannot accept concurrent writes.
- Keep source disposal durable and idempotent. Never delete provenance or
  derived analysis with the original object, and never report disposal complete
  until the worker has reconciled object storage and PostgreSQL.
- Keep ingestion recovery restricted to terminal failed jobs with retained
  originals in open cases. Reset the existing single job rather than creating
  duplicates, clear only sanitised failure state, and append the retry audit
  event in the same transaction.
- Keep finding exports restricted to terminal reviewed records. Preserve
  non-cacheable responses, opaque filenames, and spreadsheet-formula
  neutralisation for CSV values.
- Keep ZIP bundle creation gated on verified ledger integrity. Preserve manifest
  hashes and the explicit exclusion of original and normalised source content.
- Keep correlation queries case-scoped, read-only, non-cacheable, limited to
  ready sources, and bounded by the documented result and source-detail caps.
- Preserve the atomic case-and-first-audit-event transaction. The transaction
  must lock the singleton `audit_chain_heads` row with `SELECT ... FOR UPDATE`,
  assign the next monotonic `ledger_sequence`, append the event, and advance the
  head. Do not reintroduce timestamp-derived ordering or weaken this row lock.
- Keep audit hashing and verification server-only. Recalculate canonical event
  digests and check sequence/predecessor continuity before reporting a verified
  ledger.
- Do not cache user-specific or case-specific data across sessions.
- Keep PostgreSQL and the Python worker internal to the Compose network. Bind
  local published ports to loopback.
- Do not expose secrets or local credentials in logs, client bundles, URLs, or
  new committed files. The documented demo credentials are local-only fixtures.
- Keep structured request IDs on API responses and server logs. Never log raw
  session tokens, passwords, throttle identities, or source material.

## UI and interaction rules

Follow `docs/BRAND.md` and reuse the existing tokens and Traceframe mark. The
design direction is sleek, modern, restrained, and distinctive—not dense,
generic, or decorative for its own sake.

- Maintain a clear hierarchy: page title, section title, body text, then
  metadata. Supporting text must remain comfortably readable against the dark
  surfaces; avoid small, low-contrast grey copy.
- Keep positive letter spacing where established. Do not compress labels or
  metadata until readability suffers.
- Use responsive Tailwind grid and flex layouts. Avoid unused dead space, text
  overflow, horizontal scrolling, clipped controls, and browser-zoom-dependent
  sizing.
- Preserve the compact desktop composition at 100% browser zoom. Achieve this
  through responsive sizing and layout rather than asking users to zoom out.
- The desktop sidebar must remain full-height and sticky. Its expanded state
  must fit the full profile name and logout control. Its collapsed state must
  keep navigation icons vertically stable.
- On narrower screens, provide an obvious control that opens a full-height
  off-canvas sidebar; do not simply remove navigation.
- Interactive controls must use `cursor-pointer`; disabled controls use
  `cursor-not-allowed`. Controls need discernible hover, focus, and pressed
  states.
- Use drawers, sidebars, fades, and slides to reveal secondary information
  without overwhelming the main view.
- Motion should clarify state changes. Keep transitions smooth and playful but
  restrained, honour `prefers-reduced-motion`, and prevent animation-driven
  layout shifts.
- Login may use its initial landing animation. Logout must show only the goodbye
  sequence before returning to login; do not replay the landing animation.
- Loading labels must not resize their controls or push surrounding content.
- When a page has content below the viewport, retain the smooth scroll control
  that points down, changes direction at the bottom, and returns to the top.
- Dashboard metric cards keep their three direct elements—icon, main value or
  title, and supporting text—distributed evenly. Preserve the optical text
  alignment that compensates for rounded card corners.

When changing layout or motion, inspect both desktop and narrow viewports at
100% browser zoom. Verify opening/closing the sidebar, drawers, lifecycle
confirmation, case selection, login, and logout rather than judging only a
static screenshot.

## Development workflow

This project is developed on macOS. Use `python3` explicitly on the host. Create
a virtual environment before installing Python dependencies:

```sh
cd services/worker
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt -r requirements-dev.txt
```

Frontend commands use Bun:

```sh
cd apps/web
bun install
bun dev
bun run lint
bun test
bun run build
```

Whole-project commands run from the repository root:

```sh
make bootstrap
./run.sh
make status
make test
make test-integration
make down
```

`make bootstrap` checks Bun, Python, and Docker, creates `.env` if needed,
installs frozen Bun dependencies, and prepares the worker virtual environment.
`./run.sh` is the primary interactive launcher: it checks Docker, creates the
local `.env` when absent, applies migrations, waits for health, and prints
clickable application links. By default it combines `compose.yaml` with
`compose.dev.yaml`, bind-mounts `apps/web`, and runs Next.js development mode for
Fast Refresh without container recreation. Use `./run.sh --no-build` only when
existing development images are current. Use `./run.sh --production` when a
production-style standalone image is specifically required.
`make test` runs the web and worker checks. `make test-integration` rebuilds the
Compose environment and runs the Playwright API, browser, accessibility, and
reflow suite across Chromium, Firefox, WebKit, and a narrow mobile project.

Schema changes use immutable, ordered SQL files under `apps/web/drizzle`. Do not
edit an applied migration. Add a new forward migration and keep
`scripts/run-migrations.sh` compatible with fresh and existing volumes. Rollback
is a pre-upgrade PostgreSQL restore or a reviewed corrective forward migration,
not an automatic destructive down-migration.

Use the protected-main workflow in `docs/BRANCHING.md`: short-lived branches,
pull-request CI, squash merges, and Render production deployment from `main`.
Do not create long-lived `development`, `test`, or `production` branches unless
the release model has a documented need for a separate persistent environment.
Changes to GitHub rulesets or paid Render resources require explicit user
approval because they alter external project state.

Keep host source and container dependencies separate in the development stack:
`apps/web` is bind-mounted, while `/app/node_modules` and `/app/.next` use named
Docker volumes. Do not mount host `node_modules` into the container. A dependency
or lockfile change requires rerunning `./run.sh`; ordinary TypeScript, React, and
CSS edits must update through Fast Refresh without rebuilding the web image.

Do not delete Compose volumes unless the user explicitly requests a data reset.
Do not overwrite unrelated or uncommitted user changes.

## Completion checks

Run checks proportional to the change. For ordinary application changes, the
expected baseline is:

```sh
cd apps/web
bun run lint
bun test
bun run build
```

For worker changes, run:

```sh
services/worker/.venv/bin/python -m ruff check services/worker/src services/worker/tests
services/worker/.venv/bin/python -m pytest -q services/worker/tests
services/worker/.venv/bin/python -m compileall -q services/worker/src
```

For service, environment, database, or integration changes, rebuild Compose and
confirm health:

```sh
docker compose up -d --build --wait
docker compose ps
curl -fsS http://127.0.0.1:3000/api/health
cd apps/web && bun run test:e2e
```

When changing layout, modal behaviour, navigation, or motion, run the relevant
Playwright projects and also inspect desktop and narrow layouts visually at 100%
browser zoom. Preserve the tested no-horizontal-overflow behaviour at viewport
equivalents of 100%, 125%, 200%, and 400% zoom.

Report what changed and which checks actually ran. Do not claim visual or
runtime verification that was not performed.

## Documentation and Git

- Update `docs/ARCHITECTURE.md` when boundaries, data flow, authentication, or
  security decisions change.
- Update `docs/BRAND.md` when tokens, typography, identity, or interaction rules
  change.
- Keep `README.md` accurate for setup, services, and the main workflow.
- Keep `docs/DEPLOYMENT.md` and `docs/BRANCHING.md` accurate when production
  topology, release gates, rollback, or branch policy changes.
- Keep `docs/PORTFOLIO_DEPLOYMENT.md` accurate when the Render, Neon, R2, startup, or
  free-tier requirements change.
- Preserve dated technical-debt history under `docs/tech_debt`. Add a new dated
  record for a future review rather than rewriting the 19/07/2026 assessment or
  20/07/2026 resolution report.
- Do not commit, push, create branches, or open pull requests unless the user
  explicitly asks for that Git operation.
