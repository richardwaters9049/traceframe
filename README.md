# Traceframe

Traceframe is a secure, evidence-led investigation workspace for organising
cases, preserving their context, and maintaining a verifiable history from the
first record to final review.

It is an independent portfolio project built entirely with synthetic data. The
project demonstrates secure full-stack engineering, user-centred interface
design, transactional data integrity, containerised services, and a foundation
for asynchronous evidence processing.

## Contents

| Guide | Description |
| --- | --- |
| [Quick start](#quick-start) | Run Traceframe locally with Docker |
| [Local development](#local-development) | Fast Refresh and host-side tooling |
| [Verification](#verification) | Lint, test, build, and integration commands |
| [Architecture](docs/ARCHITECTURE.md) | System boundaries and data flow |
| [Security and integrity](docs/SECURITY_AND_INTEGRITY.md) | Authentication, authorisation, evidence handling, and audit guarantees |
| [CI/CD and production](docs/CI_CD_AND_PRODUCTION.md) | Release gates, production topology, and deployment guides |
| [Brand system](docs/BRAND.md) | Visual identity and interaction rules |

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
9. If ingestion reaches a terminal failure, inspect its sanitised attempt state
   and explicitly requeue the retained original.
10. Promote a derived observation into a proposed finding, record an analyst
   note, then confirm or dismiss it with a rationale.
11. Download reviewed decisions as CSV or JSON, create a verified ZIP hand-off
    bundle with source provenance, or print a concise case summary.
12. Open Relationships to inspect indicators repeated across ready sources.
13. Close a resolved case after processing and finding reviews are complete;
    reopen it when further investigation is required.
14. When retention no longer requires an original, request its audited disposal
    while keeping provenance and derived analysis available.
15. Open the architecture view to inspect live service health and aggregate
    evidence-pipeline state from the same component-driven workspace.

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

- Git.
- Docker with Docker Compose:
  - Docker Desktop on macOS or Windows.
  - Docker Engine with the Compose plugin on Linux.

Clone the repository, enter its directory, and start the complete development
environment with one command:

```sh
git clone https://github.com/richardwaters9049/traceframe.git
cd traceframe
docker compose -f compose.yaml -f compose.dev.yaml up -d --build --wait
```

This command is the same in macOS Terminal, Windows PowerShell, and Linux
shells. Docker builds the application, applies database migrations, seeds the
synthetic demo account, starts every service, and waits for health checks. No
host installation of Bun or Python is required.

Open <http://127.0.0.1:3000> and sign in with the local synthetic account:

```text
Email:    analyst@traceframe.local
Password: Traceframe!2026
```

The demo identity can be changed through the `AUTH_DEMO_*` values in a local
`.env` file before the database is first created. These credentials are for
local portfolio use only.

Stop the services without deleting their named data volumes:

```sh
docker compose -f compose.yaml -f compose.dev.yaml down
```

## Local development

The quick-start command runs Next.js in development mode with containerised Fast
Refresh. Saved TypeScript, React, and CSS changes update without rebuilding the
image. View logs with:

```sh
docker compose -f compose.yaml -f compose.dev.yaml logs --follow
```

Dependencies and Next.js build output use Docker-managed `web_node_modules` and
`web_next_cache` volumes. This keeps host dependencies separate from the Linux
container. If `package.json` or `bun.lock` changes, rerun the quick-start command
so the container performs a frozen Bun install before starting the development
server.

On macOS and Linux, `./run.sh` remains available as an optional interactive
launcher with clickable links and `--no-build` and `--production` modes.

Bun and Python are needed on the host only when running checks or developing
outside the containers. To work on the Python worker outside Docker, create its
virtual environment before installing dependencies:

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
| `POST` | `/api/cases/:id/sources/:sourceId/retry` | Audit and requeue a terminal ingestion failure |
| `GET` | `/api/cases/:id/correlations` | Return a bounded view of indicators repeated across ready sources |
| `GET` | `/api/cases/:id/findings` | Return findings with case-level lifecycle and indicator summaries |
| `POST` | `/api/cases/:id/findings` | Promote one derived observation into a proposed finding |
| `PATCH` | `/api/cases/:id/findings/:findingId` | Confirm or dismiss a proposed finding with rationale |
| `GET` | `/api/cases/:id/findings/export?format=csv\|json\|bundle` | Download reviewed findings or a verified provenance bundle |
| `GET` | `/api/operations/status` | Return authenticated, content-minimised service and pipeline health |
| `GET` | `/api/health` | Report web and database availability |

## Notes

- Startup runs the one-shot migration service before the seed, web, and worker
  services. Applied migrations are immutable; database changes use a new forward
  migration.
- Named Docker volumes preserve local PostgreSQL and MinIO data when the
  environment is stopped.
- The project uses synthetic information only.

## Next milestones

- Add larger-file streaming and carefully bounded binary-format parsers.
- Extend the authenticated operations view with hosted metrics and alerting,
  then exercise storage and database backup restoration.
