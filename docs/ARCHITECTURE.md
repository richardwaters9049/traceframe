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
processes durable ingestion and source-disposal jobs. It remains an internal
polling process rather than an HTTP service.

## Production topology

Render runs the same service boundaries in production. The Next.js service is
public behind Render HTTPS; the Python worker and MinIO are private services;
PostgreSQL is managed and has no public allow-list. MinIO uses a persistent disk
for this synthetic portfolio workload. It is a single-instance availability
trade-off, not a design for irreplaceable evidence.

GitHub Actions verifies pull requests and `main`. Render's Blueprint waits for
those checks before deploying a commit. Both application images can execute the
migration runner during pre-deploy; a PostgreSQL transaction-level advisory lock
serialises them, and each migration is checked again while the lock is held.
This preserves ordered, once-only application even when deployments overlap.

## Free demonstration topology

`render.portfolio.yaml` provides a separate portfolio topology: one Render Free
Web Service runs the Next.js server and Python worker as independently
supervised processes, Neon provides PostgreSQL, and Cloudflare R2 provides the
same S3-compatible object boundary as MinIO. The supervisor applies migrations
with Neon's direct connection, seeds the synthetic demo identity, then starts
both long-running processes. If either exits, the container exits.

This profile changes physical placement, not browser or data boundaries. Python
does not expose an HTTP server, Next.js remains the only browser-facing API, and
the worker still claims durable PostgreSQL jobs. Co-location is strictly a
portfolio-hosting compromise: the worker sleeps with the web service, external
datastore traffic crosses provider networks, and the profile has no production
recovery or availability guarantee.

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
or processing, or an original is awaiting disposal, the client polls the narrow
source endpoint every two seconds. Polling stops once all ingestion and disposal
work reaches a terminal state.

## Source retention and disposal

Original objects are retained by default with no automatic expiry. An analyst
or admin may request permanent disposal through the same-origin
`DELETE /api/cases/:id/sources/:sourceId` boundary after ingestion reaches a
terminal state. The open case and source rows are locked before the disposal
job, `disposal_pending` state, and `source.disposal_requested` audit event are
committed atomically. Closed cases reject disposal requests.

The worker claims disposal jobs with the same bounded lease-and-retry pattern as
ingestion. Object deletion is idempotent: if storage deletion succeeds but the
database update is interrupted, a retry safely reconciles PostgreSQL to
`disposed`. Terminal storage failures become `disposal_failed` and can be
explicitly retried. Disposal removes only the original object; the source
record, SHA-256 digest, normalised analysis, observations, findings, and audit
history remain as provenance.

## Analyst findings

Machine-derived observations remain immutable provenance records. An analyst or
admin can promote one observation into one finding with a required note. The
finding begins as `proposed` and may transition once to `confirmed` or
`dismissed`; either terminal decision requires a review rationale. Reviewers can
read findings but cannot create or decide them.

Proposal and review Route Handlers validate path and JSON input, require an
authenticated same-origin mutation, and derive both the database user and audit
actor from the server session. Each finding state change and its
`finding.proposed`, `finding.confirmed`, or `finding.dismissed` event are written
in one transaction while holding the global audit-chain head lock. Analyst notes
and review rationale stay in the finding record rather than logs or immutable
audit metadata.

Finding collection responses include totals by lifecycle state and indicator
kind, derived from the same authoritative records returned by the repository.
The case workspace uses those server-derived totals for compact summary cards,
then filters the already bounded case collection in component state. Filter
choices are intentionally not encoded in routes or query strings and do not
trigger additional database requests.

Reviewed findings have two deliberately bounded hand-off paths. An authenticated
read-only Route Handler returns CSV or JSON containing only `confirmed` and
`dismissed` findings; proposed decisions never enter an export. Responses use
opaque case identifiers in filenames, disable caching, and neutralise CSV cells
that spreadsheet software could interpret as formulas.

The case workspace also renders a print-only summary from the already loaded
case and finding collection. The printed report includes case context, review
counts, and terminal finding decisions, while ordinary navigation, controls,
pending proposals, and source content remain outside the print layout.

## Cross-source relationships

The worker derives normalised domain and embedded SHA-256 observations alongside
email, URL, and IPv4 values. SHA-256 extraction accepts only isolated, exact
64-character hexadecimal values and normalises their casing. Relationships are
computed only when requested and only within one case: an indicator qualifies
when it appears in at least two ready sources. The query returns at most 50
correlations and at most 10 source details per correlation, ordered
deterministically by prevalence and occurrence count.

`GET /api/cases/:id/correlations` requires the same authenticated read
capability as the case workspace, disables response caching, and returns no
normalised source content. The Relationships tab calls it only when opened, so
ordinary case loading remains bounded to the established workspace payload.

## Case queries and workspace state

The dashboard server component fetches a bounded 20-record summary page using a
`(created_at, id)` cursor and verifies the global audit ledger. It does not load
case audit histories. Selecting a case keeps navigation state inside
`WorkspaceUIProvider` and fetches only that workspace from authenticated
`GET /api/cases/:id`. Additional register pages use the same cursor through
`GET /api/cases`. Only `/` and `/dashboard` are user-facing page routes.

## Case lifecycle

Analysts and admins can transition a case between `open` and `closed` through
the same-origin `PATCH /api/cases/:id` boundary. The transaction locks the case
row, rejects duplicate transitions, blocks closure while ingestion or source
disposal is active or a finding remains proposed, updates the case, and appends
`case.closed` or `case.reopened` to the global audit ledger atomically.

Source upload, finding proposal, and finding review transactions also lock the
case row before writing. This makes a closed case read-only at the database
boundary and prevents a concurrent request from slipping through while closure
is being committed. Reads, reviewed-finding exports, relationships, and the
verified audit view remain available for preserved closed cases.

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

Role capabilities are explicit and fail closed: `analyst` and `admin` may read,
create, close, and reopen cases, upload and dispose original sources, and manage
findings; `reviewer` may read only, and unknown roles receive no case access.
This is workspace-level authorisation; case ownership or membership must be
designed before cases are shared across separate workspaces.

## Schema lifecycle

The one-shot Compose `migrate` service applies ordered SQL migrations before
seed, web, and worker startup and records filenames in `schema_migrations`.
Existing volumes created before the runner are baselined by detecting their
core tables. Migration failure stops dependent service startup. Applied files
are immutable; upgrades use new forward migrations. Production rollback means
restoring a pre-upgrade backup or applying a reviewed corrective migration.
In production the same runner accepts Render's `DATABASE_URL` and executes as a
pre-deploy command. The hosted database should be backed up before risky schema
work, and schema changes should follow expand/migrate/contract compatibility.
