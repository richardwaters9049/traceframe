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
- A cursor-paginated case register and on-demand individual case workspace.
- Atomic case and audit-event creation backed by a verified, monotonic global
  SHA-256 ledger.
- Login throttling, same-origin mutation checks, request correlation, and
  enforced workspace role capabilities.
- Versioned migrations that run on both fresh and existing Compose volumes.
- Purposeful Motion transitions for login, workspace changes, drawers, sidebar
  behaviour, scrolling, and logout.
- Docker health checks for the web application, PostgreSQL, MinIO, and Python
  worker.

The Python worker currently establishes its database connection, publishes a
health heartbeat, and performs scheduled expired-session cleanup. The ingestion
job schema and MinIO service are in place, but source upload, object processing,
and derived observations are planned work and are not yet exposed through the
product interface.

## Product flow

After signing in, the user stays within one protected workspace:

1. Review open records and investigation health on the dashboard.
2. Open the **New case** drawer without changing the browser URL.
3. Enter neutral case details and choose a priority.
4. Submit the case to the authenticated, same-origin `POST /api/cases` handler.
5. Commit the case and its first audit event together in one database
   transaction.
6. Select the new record to inspect its context and linked audit digest.
7. Open the architecture view from the same component-driven workspace.

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
| `worker` | Background-processing runtime and health heartbeat | Internal only |
| `minio` | S3-compatible source-material storage | Console: <http://127.0.0.1:9001> |
| `seed` | Idempotently creates or updates the local demo user | One-shot internal service |

Published services bind to host loopback. PostgreSQL and the worker remain on
the private Compose network.

## Quick start

### Requirements

- macOS with Docker Desktop and Docker Compose.
- Bun for running frontend checks outside Docker.
- Python 3.14 for developing the worker outside Docker.

Copy the local environment defaults and start the complete stack:

```sh
cp .env.example .env
make up
```

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

Install and run the web application with Bun:

```sh
cd apps/web
bun install
bun dev
```

The containerised database must be reachable for authentication, dashboard
rendering, and case operations. The simplest development setup is to start the
Compose stack first and then run the frontend checks locally.

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
| `GET` | `/api/health` | Report web and database availability |

## Security and integrity choices

- Passwords are stored as bcrypt hashes using PostgreSQL `pgcrypto`.
- Login creates a random 256-bit opaque token. Only its SHA-256 digest is stored
  in PostgreSQL.
- The raw session token is sent in an HttpOnly, SameSite cookie with an
  eight-hour expiry.
- Protected pages and Route Handlers independently verify the database-backed
  session.
- Zod validates untrusted login and case payloads at the server boundary.
- The audit actor is derived from the authenticated session, never from the
  request body.
- Case creation and its initial audit event commit or roll back together.
- A locked PostgreSQL chain-head row assigns each global audit event a monotonic
  sequence and ensures concurrent writers extend one unambiguous head.
- Server-side verification recalculates every canonical event digest and checks
  every sequence and predecessor link before the UI reports the ledger verified.
- Mutating handlers reject cross-origin requests and all API responses include
  a request ID for correlation.
- Workspace roles are fail-closed: `analyst` and `admin` can read/create cases;
  `reviewer` is read-only; unknown roles receive no case capability.
- User-specific and case-specific dashboard data is dynamically rendered and is
  not cached across sessions.
- The project contains synthetic information only.

Production deployment would additionally require HTTPS with
`AUTH_COOKIE_SECURE=true`, external secret management, deployment-specific
network controls, monitoring, backups, and a formal threat review.

## Repository structure

```text
traceframe/
├── apps/web/              Next.js application, Route Handlers, UI, and tests
├── db/                    Local demo-user seed
├── docs/                  Architecture, brand, and dated debt records
├── services/worker/       Python background-processing service
├── compose.yaml           Container topology and health checks
├── Makefile               Common build, test, and lifecycle commands
└── AGENTS.md              Project guidance for coding agents
```

Further detail is available in:

- [Architecture](docs/ARCHITECTURE.md)
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

- Upload synthetic source material to MinIO from a case workspace.
- Create durable ingestion jobs in PostgreSQL.
- Let the Python worker claim, process, retry, and complete those jobs safely.
- Preserve provenance between source objects and derived observations.
- Surface source provenance and derived observations in the case workspace.
