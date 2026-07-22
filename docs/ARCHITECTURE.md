# Traceframe architecture

## Runtime boundaries

Traceframe is a standalone synthetic incident-analysis workspace. Next.js owns
the interface and same-origin Route Handlers, PostgreSQL owns transactional
records, ingestion state, and the audit ledger, MinIO preserves original source
material, and Python runs only as a background worker. PostgreSQL and the worker
remain internal to the Compose network.

```text
User browser
    |
    | 127.0.0.1:3000
    v
Next.js web and API ------> PostgreSQL
        |                       ^
        v                       |
      MinIO              Python worker
```

The worker maintains its health heartbeat, removes expired sessions hourly, and
processes durable ingestion jobs. It remains an internal polling process rather
than an HTTP service.

## Evidence ingestion

`POST /api/cases/:id/sources` requires an authenticated analyst or admin and an
explicit same-origin request. It accepts one UTF-8 TXT, LOG, CSV, or JSON file up
to 1 MiB. The handler validates filename, extension, declared media type, byte
length, UTF-8 content, and JSON syntax before assigning an opaque object key.

The original bytes are written to MinIO first. A PostgreSQL transaction then
creates the provenance record and durable job, locks the global audit-chain
head, appends `source.uploaded`, and advances the head. If the database
transaction fails, the new object is removed as a compensating action. A
per-case SHA-256 constraint prevents accidental duplicate attachment.

Workers claim due jobs with `FOR UPDATE SKIP LOCKED`, increment the attempt
count, and record a five-minute lease. Expired leases are recovered on startup.
Before analysis, the worker retrieves the original and verifies its recorded
byte length and SHA-256 digest. It normalises line endings and JSON formatting,
records character, line, and word counts, and derives counted email, URL, and
valid IPv4 observations. Completion updates the normalised content,
observations, source, and job atomically. Failures use bounded exponential
retry delays and become terminal after three attempts without exposing source
content in logs or error text.

The case workspace loads source summaries on demand. While any source is queued
or processing, the client polls the narrow source endpoint every two seconds;
polling stops once all sources reach ready or failed state.

## Case queries and workspace state

The dashboard server component fetches a bounded 20-record summary page using a
`(created_at, id)` cursor and verifies the global audit ledger. It does not load
case audit histories. Selecting a case keeps navigation state inside
`WorkspaceUIProvider` and fetches only that workspace from authenticated
`GET /api/cases/:id`. Additional register pages use the same cursor through
`GET /api/cases`. Only `/` and `/dashboard` are user-facing page routes.

## Audit integrity

The ledger is global. Each case workspace is a filtered view of that ledger and
therefore displays the result of global—not case-local—verification.

`POST /api/cases` validates JSON, inserts the case, locks the singleton `global`
row in `audit_chain_heads` with `SELECT ... FOR UPDATE`, assigns the next
monotonic sequence, writes the linked SHA-256 event, and advances the head in
one transaction. Wall-clock order is not used to choose predecessors.

Server-only verification reads canonical event fields in ledger-sequence order,
checks that sequences are contiguous, checks each `previous_hash`, recalculates
each digest, and returns a typed `verified`, `broken`, or `unavailable` result.
The UI never claims verification without that result.

## Authentication, authorisation, and request security

Passwords are bcrypt hashes produced by PostgreSQL `pgcrypto`. Email addresses
are normalised and protected by a unique index on `lower(email)`. Login creates
a random 256-bit opaque token; only its SHA-256 digest is stored. The raw token
uses an HttpOnly, SameSite cookie with an eight-hour expiry. Session reads also
require an active user, and the worker removes expired records hourly.

Login throttling stores only a keyed hash of normalised account and network
identity, applies bounded delay, and temporarily blocks repeated failures.
State-changing handlers validate `Origin` against the effective request host.
Responses include request IDs and server logs use structured event records
without credentials or session tokens.

Role capabilities are explicit and fail closed: `analyst` and `admin` may read
and create cases and upload sources, `reviewer` may read only, and unknown roles
receive no case access. This is workspace-level authorisation; case ownership or membership must
be designed before cases are shared across separate workspaces.

## Schema lifecycle

The one-shot Compose `migrate` service applies ordered SQL migrations before
seed, web, and worker startup and records filenames in `schema_migrations`.
Existing volumes created before the runner are baselined by detecting their
core tables. Migration failure stops dependent service startup. Applied files
are immutable; upgrades use new forward migrations. Production rollback means
restoring a pre-upgrade backup or applying a reviewed corrective migration.
