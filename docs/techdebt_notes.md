# Traceframe technical-debt notes

## 19/07/2026

### Review summary

The first vertical slice is stable: linting passes, all 6 existing unit tests
pass, the production web build succeeds, and the Python source compiles. The
main debt is concentrated around audit-integrity verification, query scaling,
security hardening, accessibility, test depth, and maintainability.

No immediate release-blocking defect was found for the current local,
single-user synthetic demo. The high-priority items below should be addressed
before adding ingestion because new event types, jobs, sources, and users will
make them more expensive to correct later.

Priority meanings:

- **P1:** Resolve before the next major product vertical slice.
- **P2:** Resolve as part of the next few implementation cycles.
- **P3:** Safe cleanup that improves maintainability and developer experience.

## P1 — Audit integrity is asserted but not verified

### Current debt

`dashboard-workspace.tsx` displays **Chain verified**, but the application only
creates hashes; it does not recalculate stored events or verify every
`previous_hash` link. The UI therefore makes a stronger claim than the code can
currently prove.

The chain head is selected in `lib/cases/repository.ts` by ordering events using
`created_at` and `id`. Because `created_at` comes from the application clock,
clock skew between future web instances could cause a later write to sort before
an earlier write and allow the wrong predecessor to be selected. The advisory
transaction lock serialises writers but does not make timestamps monotonic.

The ledger is global, while the case workspace loads only events belonging to
one case. A case event can therefore point to an event from another case, so the
case screen cannot independently demonstrate the complete chain.

### Resolution

1. Add a monotonic ledger sequence or a single-row chain-head table.
2. Lock the chain-head row with `SELECT ... FOR UPDATE`, append the event, and
   update the head in the same transaction.
3. Add a server-only verification function that loads the required canonical
   fields, recalculates each digest, checks predecessor links, and returns a
   typed verification result.
4. Decide and document whether the ledger is global or scoped per case. If it is
   global, verify the global chain and show the case event as a filtered view of
   that verified ledger.
5. Replace **Chain verified** with a neutral state until verification has run;
   then display verified, broken, or unavailable states accurately.
6. Add tests for valid chains, modified metadata, missing predecessors,
   reordered events, concurrent writes, and clock skew.

## P1 — Dashboard loading performs an N+1 query pattern

### Current debt

`app/dashboard/page.tsx` loads the case list and then calls `getCaseWorkspace`
for every case. Each workspace call performs two more queries. Rendering `N`
cases therefore performs `1 + (2 × N)` queries and serialises every case's audit
events into the client component tree even when no case has been selected.

The register also has no pagination, so database work, server-rendered payload
size, hydration data, and animation work will grow continuously with the number
of cases.

### Resolution

1. Render only a paginated case summary list on the dashboard.
2. Load one selected case workspace on demand through an authenticated
   same-origin Route Handler or a focused Server Action/component boundary.
3. Add cursor-based pagination using `(created_at, id)` rather than an unbounded
   list or large offsets.
4. Return only the fields needed by each view.
5. Add query-count and response-size integration tests with a realistic case
   volume.

## P1 — Authentication needs abuse and identity hardening

### Current debt

The login endpoint has no rate limiting or progressive delay. Email uniqueness
is case-sensitive in PostgreSQL while authentication compares `lower(email)`,
so direct database writes could create ambiguous accounts that differ only by
letter case. Mutating endpoints rely on SameSite cookies and JSON requests but
do not explicitly validate the request origin.

The application currently exposes all cases to every authenticated user and
stores a role without enforcing permissions. That is acceptable only while the
product remains an explicitly single-user demo.

### Resolution

1. Add login throttling keyed by a privacy-conscious combination of account and
   network identity, with bounded progressive delays and generic failures.
2. Enforce case-insensitive email uniqueness with `citext` or a unique index on
   `lower(email)`, then normalise existing records in a migration.
3. Validate `Origin`/`Host` on state-changing Route Handlers or add a CSRF token
   strategy before broadening deployment.
4. Define the authorisation model before adding users: case ownership,
   membership, or explicit workspace roles.
5. Add authentication integration tests covering expired, revoked, malformed,
   inactive-user, throttled, and cross-origin requests.

## P2 — Database indexes and constraints are incomplete

### Current debt

Queries order and filter on columns that do not yet have supporting indexes,
including case creation time, audit object identity, audit ordering, session
expiry, and future ingestion-job status. Priority and status values are guarded
by TypeScript validation but not by database constraints.

Expired sessions are deleted only when a new session is created, so inactive
installations can retain expired rows indefinitely.

### Resolution

Add migrations for indexes based on actual query shapes, initially:

- `cases (created_at DESC, id DESC)`
- `audit_events (object_type, object_id, created_at DESC, id DESC)`
- `sessions (expires_at)` and, if needed, `sessions (user_id)`
- `ingestion_jobs (status, created_at, id)` before job claiming is implemented

Add database `CHECK` constraints for known case statuses and priorities. Create
a scheduled cleanup path or worker maintenance task for expired sessions, then
confirm improvements with `EXPLAIN (ANALYZE, BUFFERS)` against representative
data.

## P2 — Database migrations only run reliably on a fresh volume

### Current debt

Migration SQL is mounted into PostgreSQL's `docker-entrypoint-initdb.d`, which
runs only while a new database volume is initialised. A developer with an
existing volume will not automatically receive later schema changes.

### Resolution

Add a dedicated migration service or startup job that runs versioned Drizzle
migrations before the seed and web services start. Make it idempotent, fail the
Compose startup when migration fails, and document upgrade and rollback
procedures. Test both a fresh database and an upgrade from the previous schema.

## P2 — Dialog and drawer accessibility is incomplete

### Current debt

The new-case drawer identifies itself as a modal and supports Escape, but it
does not trap focus, mark background content inert, or reliably restore focus to
the opener. The mobile sidebar has similar behaviour without dialog semantics.
The case workspace also renders **Sources** and **Relationships** as enabled tab
buttons even though they have no actions.

### Resolution

1. Use the existing Base UI primitives, or implement the complete accessible
   dialog pattern: labelled dialog, initial focus, focus trap, inert background,
   Escape handling, and focus restoration.
2. Give the mobile drawer appropriate dialog/navigation semantics.
3. Mark unfinished tabs as disabled with an explanation, or remove them until
   their panels exist.
4. Add automated axe checks and keyboard-only browser tests for login, sidebar,
   case drawer, case selection, and logout.

## P2 — Layout density depends on a global CSS zoom workaround

### Current debt

`.workspace-canvas` applies `zoom: 0.78` and a transform fallback to reproduce
the desired compact desktop composition. CSS zoom and scaled fallbacks can
affect fixed positioning, sticky elements, focus outlines, pointer coordinates,
text rendering, and browser accessibility zoom in different ways.

### Resolution

Preserve the current visual density while gradually replacing global scaling
with explicit spacing, type, sidebar-width, and container-size tokens. Validate
the result at 100%, 125%, and 200% browser zoom, across Safari, Chromium, and
Firefox, before removing the fallback. Treat WCAG reflow at 400% as a final
acceptance check.

## P2 — UI components are large and repeat design values

### Current debt

`login-screen.tsx` and `workspace-frame.tsx` are approximately 300 lines each
and combine animation, networking, timers, responsive layout, modal behaviour,
and navigation. This raises regression risk. Brand colours and motion settings
are repeated through many arbitrary Tailwind values even though global theme
variables exist.

### Resolution

Extract components by responsibility, for example:

- Login intro, signal graphic, credential form, and entry transition.
- Desktop sidebar, mobile sidebar, profile control, scroll navigator, and
  goodbye overlay.
- Shared motion variants and duration/easing tokens.
- Traceframe surface, text, border, and state tokens exposed through Tailwind.

Keep visually intentional one-off values local, but replace repeated colours
and timings with named tokens. Add focused component tests before refactoring so
behaviour remains stable.

## P2 — Client request handling is optimistic about failure modes

### Current debt

Logout does not check `response.ok`; a server-side logout failure can still show
**Session secured** and navigate away. Login and case creation assume an expected
JSON response, and requests have no cancellation or timeout strategy. Errors are
logged with unstructured `console.error` calls and have no request correlation.

### Resolution

Create a small typed same-origin request helper that safely handles JSON and
non-JSON errors, checks status codes, supports abort signals, and returns a
consistent result. Only show successful logout language after session revocation
succeeds; otherwise present a recoverable error. Introduce structured server
logging with request IDs before adding background jobs.

## P2 — Test coverage is narrow and there is no CI workflow

### Current debt

The 6 unit tests cover Zod contracts and deterministic hash creation. There are
no repository tests, Route Handler tests, database transaction/concurrency
tests, component tests, end-to-end browser tests, accessibility tests, worker
tests, or automated CI checks. A successful build therefore leaves the most
important behaviours unverified.

### Resolution

Add coverage in this order:

1. PostgreSQL integration tests for authentication, session expiry, atomic case
   creation, audit chaining, and concurrent writers.
2. Route Handler tests for authentication, validation, status codes, and safe
   error responses.
3. Browser tests for login, responsive navigation, drawer focus, case creation,
   component-only navigation, logout, and reduced motion.
4. Python tests for settings, database readiness, job claiming, retries, and
   idempotency as worker functionality is added.
5. A GitHub Actions workflow that runs lint, unit/integration tests, the
   production build, Python checks, and dependency scanning.

Use coverage reports to find untested risk, but do not optimise for a percentage
instead of meaningful behavioural assertions.

## P3 — Documentation and generated scaffold cleanup

### Current debt

The root README is current, but `apps/web/README.md` is still the generic
`create-next-app` document and recommends npm, Yarn, and pnpm despite Bun being
the required package manager. `docs/ARCHITECTURE.md` is still titled **Initial
architecture** and describes worker behaviour in the future tense. Unused
starter SVG assets remain under `apps/web/public`.

### Resolution

- Replace the nested README with concise web-app-specific commands or point it
  to the root README.
- Update the architecture document when ingestion design is agreed.
- Remove confirmed-unused starter assets after checking all references.
- Keep technical-debt items linked to commits or issues as they are resolved.

## P3 — Local tooling can be more reproducible

### Current debt

`make test` assumes `services/worker/.venv` already exists, and there is no
single bootstrap command that verifies Bun, Python, Docker, environment files,
and dependencies. Python quality checks currently stop at bytecode compilation.

### Resolution

Add explicit `bootstrap`, `test-web`, `test-worker`, and `test-integration`
targets. Add a Python formatter/linter and test runner with locked versions.
Keep environment creation explicit, but provide clear failure messages and
version checks.

## Planned work that is not yet technical debt

MinIO uploads, ingestion-job claiming, evidence normalisation, provenance, and
derived observations are documented next milestones rather than unfinished
repairs to shipped behaviour. They become technical debt only if their current
placeholder schema or configuration constrains the chosen implementation.

Before implementing them, resolve the P1 audit, query-loading, and identity
decisions so the new pipeline builds on stable boundaries.

## Recommended resolution order

1. Make audit verification truthful and structurally reliable.
2. Replace eager workspace loading with paginated summaries and on-demand case
   retrieval.
3. Harden login, email identity, request origin checks, and authorisation rules.
4. Establish repeatable migrations, indexes, constraints, and session cleanup.
5. Add database/API integration tests and CI.
6. Complete drawer accessibility and remove misleading inactive controls.
7. Refactor oversized UI components and replace global zoom incrementally.
8. Clean stale documentation, assets, and developer tooling.

Re-run this review after the P1 work and before beginning source ingestion.
