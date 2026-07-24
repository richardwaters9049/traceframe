# Security and integrity

Traceframe is a fictional incident-analysis workspace built only with synthetic
data. Its security boundaries are designed to demonstrate evidence-led software
engineering; they are not a substitute for a formal threat review before a real
production deployment.

## Authentication and access control

- Passwords are stored as bcrypt hashes using PostgreSQL `pgcrypto`.
- Login creates a random 256-bit opaque token. Only its SHA-256 digest is stored
  in PostgreSQL.
- The raw session token is sent in an HttpOnly, SameSite cookie with an
  eight-hour expiry.
- Protected pages and Route Handlers independently verify the database-backed
  session.
- The audit actor is derived from the authenticated session, never from the
  request body.
- Workspace roles are fail-closed: `analyst` and `admin` can read and create
  cases, upload and dispose original sources, and manage findings; `reviewer` is
  read-only; unknown roles receive no case capability.
- User-specific and case-specific data is dynamically rendered and is not
  cached across sessions.

## Request and evidence handling

- Untrusted login, case, path, and multipart source input is validated at the
  server boundary. Uploads are restricted to valid UTF-8 TXT, LOG, CSV, or JSON
  files no larger than 1 MiB.
- Mutating handlers reject cross-origin requests and all API responses include
  a request ID for correlation.
- Each source uses an opaque MinIO key. PostgreSQL records its original name,
  media type, byte length, uploader, and SHA-256 digest; the worker verifies
  length and digest again before processing.
- A source record, durable job, and `source.uploaded` audit event are committed
  atomically after object storage succeeds. The object is removed if that
  transaction fails.
- Original disposal is explicit and irreversible. The request, durable disposal
  job, source retention state, and `source.disposal_requested` event commit
  atomically. The worker retries idempotent object deletion while PostgreSQL
  retains provenance and derived analysis.
- Ingestion recovery accepts only a terminal failed job in an open case whose
  original is retained. It resets the existing job and source state while
  appending `source.ingestion_retried` atomically; active, repeated, closed-case,
  and missing-original attempts fail closed.

## Audit ledger and findings

- Case creation and its initial audit event commit or roll back together.
- A locked PostgreSQL chain-head row assigns each global audit event a monotonic
  sequence and ensures concurrent writers extend one unambiguous head.
- Server-side verification recalculates every canonical event digest and checks
  every sequence and predecessor link before the UI reports the ledger verified.
- Finding proposals and terminal review decisions extend the global ledger in
  the same transaction as their state change. Actor identity comes from the
  server session, and analyst notes are not copied into audit metadata or logs.
- Finding exports require an authenticated read capability and contain only
  confirmed or dismissed findings. Responses are non-cacheable, filenames use
  opaque case IDs, and CSV cells are neutralised against spreadsheet formulas.
- Hand-off bundles additionally require a verified global audit ledger. Their
  manifest hashes each included report and records only referenced source
  provenance; original and normalised source content are excluded.

## Bounded analysis and operations

- Cross-source correlation is read-only, loaded on demand, restricted to ready
  sources in one case, and capped at 50 indicators with 10 source details each.
- Embedded SHA-256 observations require an isolated 64-character hexadecimal
  value and are normalised to lowercase; partial or longer hexadecimal values
  are ignored.
- User-agent observations are accepted only from explicit `User-Agent:` header
  lines. Horizontal whitespace is normalised, invalid or over-512-character
  values are ignored, and each source is capped at 50 distinct values.
- Operational status is authenticated and non-cacheable. It exposes only coarse
  service states, database-timestamped worker freshness, and aggregate job
  counts—never infrastructure addresses, source details, or credentials.

## Production readiness

A live production deployment still requires the Blueprint to be provisioned,
its Render-only secret to be supplied, backups and monitoring to be enabled,
and a formal threat review to be completed. The committed production definition
enables HTTPS-only cookies, private service networking, and external secret
management by default.

See the [architecture](ARCHITECTURE.md) and
[production deployment runbook](DEPLOYMENT.md) for the surrounding system and
operational controls.
