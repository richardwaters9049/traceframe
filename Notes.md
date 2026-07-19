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
