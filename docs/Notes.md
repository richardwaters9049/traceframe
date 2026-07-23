# Traceframe development notes

## 19/07/2026

Today we refined and documented the first Traceframe vertical slice:

- Removed the additional login-page animation that made the landing experience
  feel too busy, keeping the page focused and restrained.
- Added a project-wide `AGENTS.md` covering architecture, security, UI rules,
  development commands, verification, and Git expectations.
- Rewrote `README.md` to describe the product as it works now, including its
  authentication, component-driven workspace, case workflow, audit design,
  Docker services, current limitations, and next milestones.
- Reviewed the web application, database layer, audit chain, authentication,
  worker, Docker configuration, tests, and documentation for technical debt.
- Confirmed that ESLint, all 6 current unit tests, the Next.js production build,
  and Python source compilation pass.

The project is in a stable position for debt reduction before source ingestion
and asynchronous processing are implemented.

## 22/07/2026

Completed the first evidence-ingestion workflow: validated synthetic sources
are stored in MinIO, queued through PostgreSQL, processed safely by the Python
worker, and presented in the case workspace with provenance, derived email, URL,
and IPv4 observations, and linked audit events. Documentation and automated
coverage were updated, with web, worker, cross-browser, reflow, and dependency
checks passing. Derived observations can now be promoted into audited analyst
findings and confirmed or dismissed with a recorded rationale.
Case-level finding totals and responsive lifecycle and indicator filters now
make those decisions easier to review. Reviewed findings can now be exported as
safe CSV or JSON, with a focused printable case summary for hand-off. Domain
observations and a bounded, on-demand Relationships view now reveal repeated
indicators across ready sources without exposing their content. Strictly
validated embedded SHA-256 values now participate in the same finding and
correlation workflow.
Added the production delivery foundation: gated GitHub CI, Render infrastructure
for web, worker, PostgreSQL, and private MinIO, concurrent-safe migrations, and a
protected-main branching and operations runbook.

## 23/07/2026

Added a portfolio deployment profile using one supervised Render web
container, Neon PostgreSQL, and Cloudflare R2 while retaining the separate paid
production architecture.
Added audited case closing and reopening, with safe completion checks and
read-only enforcement for closed investigations.
Added audited original-source disposal with durable retries and preserved
provenance, observations, findings, and retention status.
Added verified reviewed-finding ZIP bundles with hashed provenance manifests for
controlled hand-off without source content.
Added bounded user-agent observations across ingestion, findings, exports, and
cross-source relationships.
