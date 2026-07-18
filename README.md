# Traceframe

Traceframe is a secure incident-analysis and case-coordination platform built
with synthetic data. It is an independent portfolio project focused on secure
software engineering, user-centred product development, system design and
production operations.

The initial architecture uses Next.js for the user interface and same-origin
Route Handlers, PostgreSQL for transactional data, MinIO for source material,
and a Python worker for asynchronous processing.

## Services

| Service | Purpose | Host access |
| --- | --- | --- |
| web | Next.js user interface and API | <http://127.0.0.1:3000> |
| worker | Python background processing | Internal only |
| db | PostgreSQL | Internal only |
| minio | S3-compatible object storage | Console: <http://127.0.0.1:9001> |

Only the user-facing web application and the local MinIO administration
console are published to host loopback. The database and worker remain on the
Compose network.

## Start the project

Copy the local environment defaults and start every service:

    cp .env.example .env
    make up

Then open <http://127.0.0.1:3000>. Check the complete system with:

    curl -fsS http://127.0.0.1:3000/api/health
    docker compose ps

Sign in to the local portfolio environment with:

    analyst@traceframe.local
    Traceframe!2026

These development credentials can be changed through the `AUTH_DEMO_*`
environment variables before the database is first created.

The first product workflow is available from the dashboard at
<http://127.0.0.1:3000/dashboard>:

1. open the in-context case drawer and enter neutral case details and a priority;
2. submit them to the same-origin `POST /api/cases` route;
3. persist the case and its first audit event in one database transaction;
4. open the server-rendered case workspace and inspect its audit digest.

Stop the environment without deleting its named data volumes:

    make down

## Local development

The frontend uses Bun:

    cd apps/web
    bun install
    bun dev
    bun test

The Python environment is intentionally local to the worker:

    cd services/worker
    python3 -m venv .venv
    .venv/bin/python -m pip install -r requirements.txt

See [Architecture](docs/ARCHITECTURE.md) for the initial boundaries and
engineering decisions, and [Brand system](docs/BRAND.md) for the logo and
colour tokens.
