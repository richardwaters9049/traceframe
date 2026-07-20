# Traceframe web application

This directory contains the Next.js interface and same-origin Route Handlers.
Project architecture, setup, security decisions, and the demo workflow are in
the [root README](../../README.md).

Use Bun from this directory:

```sh
bun install --frozen-lockfile
bun dev
bun run lint
bun test
bun run build
```

Browser and accessibility checks require the Compose stack and Playwright's
Chromium runtime:

```sh
bunx playwright install chromium
bun run test:e2e
```

Do not use npm, pnpm, or Yarn or add their lockfiles.
