# CI/CD and production

## Release gate

GitHub Actions is the required release gate. Pull requests into protected
`main` run linting, unit tests, dependency audits, production image builds, and
the container-backed Playwright suite. Render deploys only a checked `main`
commit using the repository's `render.yaml` Blueprint.

Traceframe uses protected-main trunk-based development instead of long-lived
development, test, and production branches. Short-lived branches represent
work, GitHub Actions represents test, and Render represents production. See the
[branching and release workflow](BRANCHING.md) for the exact practice and
recommended GitHub ruleset.

## Production topology

The production definition includes the public Next.js service, a private Python
worker, managed PostgreSQL, and private disk-backed MinIO. Provisioning creates
paid resources and requires one Render-only `AUTH_DEMO_PASSWORD` secret, so it
is intentionally performed as a reviewed account operation after the files are
merged.

See the [deployment runbook](DEPLOYMENT.md) for topology, cost, first
deployment, smoke checks, backups, and rollback.

## Portfolio deployment

For a zero-cost portfolio demonstration, `render.portfolio.yaml` defines one
Render Free Web Service backed by Neon Free PostgreSQL and Cloudflare R2.
Next.js and the worker run as separately supervised processes in that one
container. This preserves the complete application flow while accepting cold
starts and no production service guarantee.

Follow the [portfolio deployment guide](PORTFOLIO_DEPLOYMENT.md) and use the
paid topology whenever reliability or data recovery matters.
