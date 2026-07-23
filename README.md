# Traceframe

Traceframe is a secure, evidence-led investigation workspace for organising
cases, preserving their context, and maintaining a verifiable history from the
first record to final review.

It is an independent portfolio project built entirely with synthetic data. The
project demonstrates secure full-stack engineering, user-centred interface
design, transactional data integrity, containerised services, and a foundation
for asynchronous evidence processing.

## Current status

Traceframe currently provides a complete first vertical slice:

- An animated, responsive login experience with reduced-motion support.
- PostgreSQL-backed users and opaque server-side sessions.
- A protected investigation workspace served from `/dashboard`.
- Responsive desktop and mobile navigation with collapsible and off-canvas
  sidebar variants.
- Component-driven dashboard, architecture, case creation, and case inspection
  views without putting workspace state into URLs.
- An in-context drawer for creating cases with validated titles, summaries, and
  priorities.
- Audited open and closed case states, with safe closure preconditions and
  read-only preservation until a case is explicitly reopened.
- A cursor-paginated case register and on-demand individual case workspace.
- Validated synthetic TXT, LOG, CSV, and JSON source uploads stored in MinIO.
- Durable PostgreSQL ingestion jobs with safe worker claiming, retries, and
  stale-lease recovery.
- Deterministic UTF-8 normalisation with source integrity verification and
  derived email, URL, IPv4, domain, and embedded SHA-256 observations.
- Live source status, provenance, normalisation counts, and observations inside
  the case workspace.
- Audited original-source disposal with durable worker retries, live retention
  status, and preserved provenance, observations, and findings.
- An on-demand Relationships view that surfaces repeated indicators across
  ready sources using bounded correlation and source-detail limits.
- Reviewable analyst findings that promote individual observations into
  proposed, confirmed, or dismissed decisions with recorded rationale.
- Server-derived case finding totals with responsive status and indicator-type
  filters that remain inside the workspace state.
- Safe CSV and JSON downloads containing reviewed findings only, plus a focused
  printable case summary for review and hand-off.
- Atomic case and audit-event creation backed by a verified, monotonic global
  SHA-256 ledger.
- Login throttling, same-origin mutation checks, request correlation, and
  enforced workspace role capabilities.
- Versioned migrations that run on both fresh and existing Compose volumes.
- Purposeful Motion transitions for login, workspace changes, drawers, sidebar
  behaviour, scrolling, and logout.
- Docker health checks for the web application, PostgreSQL, MinIO, and Python
  worker.

The Python worker publishes a health heartbeat, removes expired sessions, and
processes durable ingestion and original-disposal jobs. The first ingestion slice is
deliberately narrow: UTF-8 text-like files up to 1 MiB are integrity-checked,
normalised, and scanned for email, URL, IPv4, domain, and strictly shaped
SHA-256 observations. Analysts can promote those observations into audited
findings. Binary evidence, large-file streaming, and richer parsers remain
future work.

## Product flow

After signing in, the user stays within one protected workspace:

1. Review open records and investigation health on the dashboard.
2. Open the **New case** drawer without changing the browser URL.
3. Enter neutral case details and choose a priority.
4. Submit the case to the authenticated, same-origin `POST /api/cases` handler.
5. Commit the case and its first audit event together in one database
   transaction.
6. Select the new record to inspect its context and linked audit digest.
7. Open **Sources**, upload a small synthetic text-like file, and follow its
   queued, processing, and ready states without leaving the workspace.
8. Review its SHA-256 provenance, normalisation counts, and derived indicators.
9. Promote a derived observation into a proposed finding, record an analyst
   note, then confirm or dismiss it with a rationale.
10. Download the reviewed decisions as CSV or JSON, or print a concise case
    summary without exposing pending proposals.
11. Open Relationships to inspect indicators repeated across ready sources.
12. Close a resolved case after processing and finding reviews are complete;
    reopen it when further investigation is required.
13. When retention no longer requires an original, request its audited disposal
    while keeping provenance and derived analysis available.
14. Open the architecture view from the same component-driven workspace.

Only `/` and `/dashboard` are user-facing pages. Architecture, case creation,
and individual cases are rendered as components inside the dashboard shell.
Legacy case and architecture URLs redirect safely back to `/dashboard`.

## Technology

| Area | Technology |
| --- | --- |
| Interface | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Components and motion | shadcn-style components, Base UI, Motion |
| Package manager and runtime | Bun |
| Browser API boundary | Same-origin Next.js Route Handlers |
| Validation | Zod |
| Transactional data | PostgreSQL 18, Drizzle ORM, postgres.js |
| Object storage | MinIO |
| Background processing | Python 3.14, psycopg, Pydantic Settings |
| Local orchestration | Docker Compose |
| Online hosting | Render production and portfolio Blueprints |

Next.js owns both the browser interface and its same-origin HTTP boundary.
There is no separate browser-facing Python API and no CORS dependency in the
normal application flow. Python is reserved for durable background processing.

## Service layout

```text
Browser
   |
   | http://127.0.0.1:3000
   v
Next.js web + Route Handlers ---- PostgreSQL
              |                       ^
              v                       |
            MinIO              Python worker
```

| Service | Responsibility | Host access |
| --- | --- | --- |
| `web` | Next.js interface, authentication, and Route Handlers | <http://127.0.0.1:3000> |
| `db` | Users, sessions, cases, jobs, and audit events | Internal only |
| `migrate` | Applies versioned schema migrations before dependent services | One-shot internal service |
| `worker` | Processes durable ingestion and source-disposal jobs and maintains health | Internal only |
| `minio` | S3-compatible source-material storage | Console: <http://127.0.0.1:9001> |
| `seed` | Idempotently creates or updates the local demo user | One-shot internal service |

Published services bind to host loopback. PostgreSQL and the worker remain on
the private Compose network.

## Quick start

### Requirements

- macOS with Docker Desktop and Docker Compose.
- Bun for running frontend checks outside Docker.
- Python 3.14 for developing the worker outside Docker.

Start the complete stack with the Traceframe terminal launcher:

```sh
./run.sh
```

The launcher checks Docker, creates `.env` from `.env.example` when needed,
applies migrations, waits for every long-running service to become healthy, and
prints clickable local links. The web service runs `next dev` inside Docker with
`apps/web` mounted into the container, so saved TypeScript, React, and CSS changes
use Fast Refresh without rebuilding or recreating the container.

For a faster restart using existing development images, run
`./run.sh --no-build`. To exercise the standalone production build instead, run
`./run.sh --production`.

Open <http://127.0.0.1:3000> and sign in with the local synthetic account:

```text
Email:    analyst@traceframe.local
Password: Traceframe!2026
```

The demo identity can be changed through the `AUTH_DEMO_*` values before the
database is first created. These credentials are for local portfolio use only.

Confirm service and application health:

```sh
make status
curl -fsS http://127.0.0.1:3000/api/health
```

Stop the services without deleting their named data volumes:

```sh
make down
```

## Local development

The normal `./run.sh` workflow already provides containerised Fast Refresh. View
the development server output when diagnosing a compilation or reload issue:

```sh
make logs
```

Dependencies and Next.js build output use Docker-managed `web_node_modules` and
`web_next_cache` volumes. This avoids mixing macOS dependencies with the Linux
container. If `package.json` or `bun.lock` changes, restart with `./run.sh` so
the container runs the frozen Bun install before starting the development
server. Docker-based file watching can be slower on macOS than host-native
development, so the override enables polling for reliable change detection.

Create a Python virtual environment before installing worker dependencies:

```sh
cd services/worker
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt -r requirements-dev.txt
```

## Verification

Run the web lint, unit tests, and production build:

```sh
cd apps/web
bun run lint
bun test
bun run build
```

Run the whole-project check from the repository root after the Python
environment has been created:

```sh
make test
```

Run the container-backed API, browser, accessibility, and reflow suite:

```sh
make test-integration
```

The Playwright suite targets Chromium, Firefox, WebKit, and a narrow mobile
viewport. Install its browser runtimes locally if they are not already present:

```sh
cd apps/web
bunx playwright install chromium firefox webkit
```

For integration or container changes, rebuild the environment and wait for all
health checks:

```sh
docker compose up -d --build --wait
docker compose ps
curl -fsS http://127.0.0.1:3000/api/health
```

## API surface

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Validate credentials and create a session |
| `POST` | `/api/auth/logout` | Revoke the current session |
| `GET` | `/api/cases` | Return cases for an authenticated user |
| `POST` | `/api/cases` | Validate and create a case with its first audit event |
| `GET` | `/api/cases/:id` | Load one case workspace and its filtered audit view |
| `PATCH` | `/api/cases/:id` | Close or reopen a case with an atomic audit event |
| `GET` | `/api/cases/:id/sources` | Return source status, provenance, and derived observations |
| `POST` | `/api/cases/:id/sources` | Validate, preserve, audit, and queue a synthetic source |
| `DELETE` | `/api/cases/:id/sources/:sourceId` | Audit and queue permanent disposal of an original object |
| `GET` | `/api/cases/:id/correlations` | Return a bounded view of indicators repeated across ready sources |
| `GET` | `/api/cases/:id/findings` | Return findings with case-level lifecycle and indicator summaries |
| `POST` | `/api/cases/:id/findings` | Promote one derived observation into a proposed finding |
| `PATCH` | `/api/cases/:id/findings/:findingId` | Confirm or dismiss a proposed finding with rationale |
| `GET` | `/api/cases/:id/findings/export?format=csv\|json` | Download reviewed findings in a safe, non-cacheable format |
| `GET` | `/api/health` | Report web and database availability |

## Security and integrity choices

- Passwords are stored as bcrypt hashes using PostgreSQL `pgcrypto`.
- Login creates a random 256-bit opaque token. Only its SHA-256 digest is stored
  in PostgreSQL.
- The raw session token is sent in an HttpOnly, SameSite cookie with an
  eight-hour expiry.
- Protected pages and Route Handlers independently verify the database-backed
  session.
- Untrusted login, case, path, and multipart source input is validated at the
  server boundary. Uploads are restricted to valid UTF-8 TXT, LOG, CSV, or JSON
  files no larger than 1 MiB.
- The audit actor is derived from the authenticated session, never from the
  request body.
- Case creation and its initial audit event commit or roll back together.
- Each source uses an opaque MinIO key; PostgreSQL records its original name,
  media type, byte length, uploader, and SHA-256 digest. The worker verifies
  length and digest again before processing.
- A source record, durable job, and `source.uploaded` audit event are committed
  atomically after object storage succeeds; the object is removed if that
  transaction fails.
- Original disposal is explicit and irreversible. The request, durable disposal
  job, source retention state, and `source.disposal_requested` event commit
  atomically; the worker retries idempotent object deletion while PostgreSQL
  retains provenance and derived analysis.
- Finding proposals and terminal review decisions extend the global ledger in
  the same transaction as their state change. Actor identity comes from the
  server session, and analyst notes are not copied into audit metadata or logs.
- Finding exports require an authenticated read capability and contain only
  confirmed or dismissed findings. Responses are non-cacheable, filenames use
  opaque case IDs, and CSV cells are neutralised against spreadsheet formulas.
- A locked PostgreSQL chain-head row assigns each global audit event a monotonic
  sequence and ensures concurrent writers extend one unambiguous head.
- Server-side verification recalculates every canonical event digest and checks
  every sequence and predecessor link before the UI reports the ledger verified.
- Mutating handlers reject cross-origin requests and all API responses include
  a request ID for correlation.
- Workspace roles are fail-closed: `analyst` and `admin` can read/create cases,
  upload and dispose original sources, and manage findings; `reviewer` is
  read-only; unknown roles receive no case capability.
- User-specific and case-specific dashboard data is dynamically rendered and is
  not cached across sessions.
- Cross-source correlation is read-only, loaded on demand, restricted to ready
  sources in one case, and capped at 50 indicators with 10 source details each.
- Embedded SHA-256 observations require an isolated 64-character hexadecimal
  value and are normalised to lowercase; partial or longer hexadecimal values
  are ignored.
- The project contains synthetic information only.

A live production deployment still requires the Blueprint to be provisioned,
its Render-only secret to be supplied, backups and monitoring to be enabled,
and a formal threat review to be completed. The committed production definition
enables HTTPS-only cookies, private service networking, and external secret
management by default.

## CI/CD and production

GitHub Actions is the required release gate. Pull requests into protected
`main` run linting, unit tests, dependency audits, production image builds, and
the container-backed Playwright suite. Render then deploys only a checked
`main` commit using the repository's `render.yaml` Blueprint.

The production definition includes the public Next.js service, a private Python
worker, managed PostgreSQL, and private disk-backed MinIO. Provisioning creates
paid resources and requires one Render-only `AUTH_DEMO_PASSWORD` secret, so it
is intentionally performed as a reviewed account operation after the files are
merged. See the [deployment runbook](docs/DEPLOYMENT.md) for topology, cost,
first deployment, smoke checks, backups, and rollback.

Traceframe uses protected-main trunk-based development instead of long-lived
development, test, and production branches. Short-lived branches represent
work; GitHub Actions represents test; Render represents production. See the
[branching and release workflow](docs/BRANCHING.md) for the exact practice and
recommended GitHub ruleset.

For a zero-cost portfolio demonstration, `render.portfolio.yaml` defines one Render
Free Web Service backed by Neon Free PostgreSQL and Cloudflare R2. Next.js and
the worker run as separately supervised processes in that one container. This
preserves the complete application flow while accepting cold starts and no
production service guarantee. Follow the [portfolio deployment guide](docs/PORTFOLIO_DEPLOYMENT.md)
and use the paid topology whenever reliability or data recovery matters.

## Repository structure

```text
traceframe/
├── apps/web/              Next.js application, Route Handlers, UI, and tests
├── db/                    Local demo-user seed
├── deploy/render/         Production Docker definitions
├── docs/                  Architecture, brand, and dated debt records
├── services/worker/       Python background-processing service
├── run.sh                 Interactive local project launcher
├── compose.yaml           Container topology and health checks
├── compose.dev.yaml       Bind-mounted web development and Fast Refresh
├── render.yaml            Render production infrastructure definition
├── render.portfolio.yaml  Render portfolio deployment definition
├── Makefile               Common build, test, and lifecycle commands
└── AGENTS.md              Project guidance for coding agents
```

Further detail is available in:

- [Architecture](docs/ARCHITECTURE.md)
- [Branching and releases](docs/BRANCHING.md)
- [Production deployment](docs/DEPLOYMENT.md)
- [Portfolio deployment](docs/PORTFOLIO_DEPLOYMENT.md)
- [Brand system](docs/BRAND.md)
- [Technical debt review — 19/07/2026](docs/tech_debt/19-07-2026.md)
- [Technical debt resolution — 20/07/2026](docs/tech_debt/20-07-2026.md)
- [Agent guide](AGENTS.md)

## Database upgrades

`docker compose up` runs the one-shot `migrate` service before seed, web, and
worker startup. Applied filenames are recorded in `schema_migrations`; reruns
are idempotent, and existing pre-runner volumes are safely baselined before new
migrations are applied. Never edit an applied migration—add a new forward
migration. Before a production upgrade, take a PostgreSQL backup. Rollback is a
restore from that backup or a reviewed forward corrective migration; destructive
automatic down-migrations are intentionally not provided.

## Next milestones

- Add larger-file streaming and carefully bounded binary-format parsers.
- Add a carefully bounded user-agent observation type.
- Add reviewed-finding bundles with provenance manifests for controlled hand-off.
- Introduce production operations for dead-letter jobs, metrics, alerting, and
  storage/database backup testing.
