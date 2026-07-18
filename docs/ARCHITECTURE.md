# Initial architecture

## Context

Traceframe is a fictional incident-analysis workspace. It processes synthetic
reports and must preserve their provenance, separate observations from
hypotheses, restrict access, and provide a useful audit trail.

The project is standalone. Other projects in the surrounding workspace are
inspiration for engineering practices only and are not runtime dependencies.

## Containers

    User browser
        |
        | 127.0.0.1:3000
        v
    Next.js web and API ------> PostgreSQL
        |                          ^
        v                          |
    MinIO object storage <---- Python worker

Next.js owns both the browser interface and same-origin Route Handlers. This
avoids a separate browser-facing API origin and therefore avoids CORS in the
normal deployment. Authentication, authorisation and input validation remain
mandatory at every server boundary.

The Python process is a worker rather than an HTTP service. It will claim
durable jobs from PostgreSQL and perform deterministic ingestion and
normalisation work. PostgreSQL is the initial job queue so the first vertical
slice does not require Redis.

## Case creation and audit integrity

`POST /api/cases` validates untrusted JSON with Zod before opening a database
transaction. The transaction creates the case, acquires a PostgreSQL advisory
lock, reads the previous audit digest, and writes a linked SHA-256 event. The
case and audit event therefore commit or roll back as one unit, while the lock
prevents concurrent writers from creating competing chain heads.

The audit actor is derived from the authenticated server-side user and is never
accepted from the case-creation request body.

## Authentication and sessions

Local credentials are stored as bcrypt hashes in PostgreSQL using `pgcrypto`.
Successful login creates a random 256-bit opaque token; only its SHA-256 digest
is stored in the `sessions` table. The raw token is sent in an HttpOnly,
SameSite cookie with an eight-hour expiry. Server-rendered pages and Route
Handlers both perform a secure database-backed session check before accessing
case data. Production deployments must set `AUTH_COOKIE_SECURE=true` behind
HTTPS.

## Initial decisions

- Use Server Components by default and isolate animation and interaction in
  small Client Components.
- Do not cache case-specific or user-specific information across sessions.
- Keep original source material in object storage and derived records in
  PostgreSQL.
- Preserve provenance for all derived observations.
- Use synthetic data only.
- Publish local development ports on loopback, not all host interfaces.
