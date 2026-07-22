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
make those decisions easier to review.
