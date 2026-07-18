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
- A case register and individual case workspace with audit history.
- Atomic case and audit-event creation backed by a linked SHA-256 digest chain.
- Purposeful Motion transitions for login, workspace changes, drawers, sidebar
  behaviour, scrolling, and logout.
- Docker health checks for the web application, PostgreSQL, MinIO, and Python
  worker.

The Python worker currently establishes its database connection and publishes a
health heartbeat. The ingestion job schema and MinIO service are in place, but
source upload, object processing, and derived observations are planned work and
are not yet exposed through the product interface.

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
.venv/bin/python -m pip install -r requirements.txt
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
- A PostgreSQL advisory transaction lock serialises audit writers so each event
  extends one unambiguous hash-chain head.
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
├── docs/                  Architecture and brand decisions
├── services/worker/       Python background-processing service
├── compose.yaml           Container topology and health checks
├── Makefile               Common build, test, and lifecycle commands
└── AGENTS.md              Project guidance for coding agents
```

Further detail is available in:

- [Architecture](docs/ARCHITECTURE.md)
- [Brand system](docs/BRAND.md)
- [Agent guide](AGENTS.md)

## Next milestones

- Upload synthetic source material to MinIO from a case workspace.
- Create durable ingestion jobs in PostgreSQL.
- Let the Python worker claim, process, retry, and complete those jobs safely.
- Preserve provenance between source objects and derived observations.
- Expand audit verification and surface chain-integrity failures.
- Add broader accessibility, browser, integration, and security testing.
