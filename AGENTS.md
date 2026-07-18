# Traceframe agent guide

This file is the project-wide source of truth for coding agents working on
Traceframe. Read it before making changes. Instructions in a more deeply nested
`AGENTS.md` also apply to files under that directory; for the Next.js app, read
`apps/web/AGENTS.md` before editing framework code.

## Product intent

Traceframe is an independent portfolio project designed to demonstrate secure,
evidence-led software engineering. It is a fictional incident-analysis and case
coordination workspace built only with synthetic data.

The surrounding repositories in `cyber-work` may be inspected for inspiration,
but they are not dependencies and Traceframe should not copy their layouts,
branding, code, or product identity. The result should feel specific to this
project and the role it supports.

## Technology and service boundaries

- Frontend and browser-facing server: Next.js 16, React 19, TypeScript,
  Tailwind CSS 4, shadcn-style components, and Motion/Framer Motion APIs.
- JavaScript package manager and runtime: Bun. Do not introduce npm, pnpm, or
  Yarn lockfiles.
- Browser API boundary: same-origin Next.js Route Handlers under `app/api`.
  Do not add FastAPI, Spring Boot, or a second browser-facing API service.
- Database: PostgreSQL with Drizzle ORM.
- Object storage: MinIO for original source material.
- Background processing: Python worker. It is not an HTTP server.
- Local orchestration: Docker Compose. The web app, worker, database, and MinIO
  must continue to run as containers.

Next.js owns the UI and its same-origin HTTP boundary, so normal browser flows
do not require CORS. Authentication, authorisation, validation, and safe data
handling are still mandatory at every server boundary.

## Application structure

The only user-facing page routes are:

- `/` for login and landing content.
- `/dashboard` for the authenticated application shell.

Architecture, case creation, case lists, and individual case workspaces are
components rendered inside the dashboard shell. Do not create page routes for
`/architecture`, `/cases`, `/cases/new`, or `/cases/[id]`. Do not encode drawer,
modal, tab, selected-case, or active-workspace state in the URL or query string.
Manage those states in `WorkspaceUIProvider` and open them through component
actions. Existing legacy redirects may remain for safe navigation.

Prefer Server Components. Add `"use client"` only where browser interaction,
local state, or animation requires it, and keep client boundaries focused.

## Security invariants

- Use synthetic data only. Never add real personal, investigative, or sensitive
  information to fixtures, screenshots, seeds, tests, or commits.
- Treat all request data as untrusted and validate it at the Route Handler.
- Derive identity and audit actors from the authenticated server-side session;
  never accept them from browser payloads.
- Keep the opaque session token in an HttpOnly, SameSite cookie and store only
  its SHA-256 digest in PostgreSQL.
- Preserve the atomic case-and-first-audit-event transaction and linked audit
  digest. Do not weaken its advisory-lock concurrency protection.
- Do not cache user-specific or case-specific data across sessions.
- Keep PostgreSQL and the Python worker internal to the Compose network. Bind
  local published ports to loopback.
- Do not expose secrets or local credentials in logs, client bundles, URLs, or
  new committed files. The documented demo credentials are local-only fixtures.

## UI and interaction rules

Follow `docs/BRAND.md` and reuse the existing tokens and Traceframe mark. The
design direction is sleek, modern, restrained, and distinctive—not dense,
generic, or decorative for its own sake.

- Maintain a clear hierarchy: page title, section title, body text, then
  metadata. Supporting text must remain comfortably readable against the dark
  surfaces; avoid small, low-contrast grey copy.
- Keep positive letter spacing where established. Do not compress labels or
  metadata until readability suffers.
- Use responsive Tailwind grid and flex layouts. Avoid unused dead space, text
  overflow, horizontal scrolling, clipped controls, and browser-zoom-dependent
  sizing.
- Preserve the compact desktop composition at 100% browser zoom. Achieve this
  through responsive sizing and layout rather than asking users to zoom out.
- The desktop sidebar must remain full-height and sticky. Its expanded state
  must fit the full profile name and logout control. Its collapsed state must
  keep navigation icons vertically stable.
- On narrower screens, provide an obvious control that opens a full-height
  off-canvas sidebar; do not simply remove navigation.
- Interactive controls must use `cursor-pointer`; disabled controls use
  `cursor-not-allowed`. Controls need discernible hover, focus, and pressed
  states.
- Use drawers, sidebars, fades, and slides to reveal secondary information
  without overwhelming the main view.
- Motion should clarify state changes. Keep transitions smooth and playful but
  restrained, honour `prefers-reduced-motion`, and prevent animation-driven
  layout shifts.
- Login may use its initial landing animation. Logout must show only the goodbye
  sequence before returning to login; do not replay the landing animation.
- Loading labels must not resize their controls or push surrounding content.
- When a page has content below the viewport, retain the smooth scroll control
  that points down, changes direction at the bottom, and returns to the top.
- Dashboard metric cards keep their three direct elements—icon, main value or
  title, and supporting text—distributed evenly. Preserve the optical text
  alignment that compensates for rounded card corners.

When changing layout or motion, inspect both desktop and narrow viewports at
100% browser zoom. Verify opening/closing the sidebar, drawers, case selection,
login, and logout rather than judging only a static screenshot.

## Development workflow

This project is developed on macOS. Use `python3` explicitly on the host. Create
a virtual environment before installing Python dependencies:

```sh
cd services/worker
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

Frontend commands use Bun:

```sh
cd apps/web
bun install
bun dev
bun run lint
bun test
bun run build
```

Whole-project commands run from the repository root:

```sh
cp .env.example .env
make up
make status
make test
make down
```

Do not delete Compose volumes unless the user explicitly requests a data reset.
Do not overwrite unrelated or uncommitted user changes.

## Completion checks

Run checks proportional to the change. For ordinary application changes, the
expected baseline is:

```sh
cd apps/web
bun run lint
bun test
bun run build
```

For worker changes, also run:

```sh
services/worker/.venv/bin/python -m compileall -q services/worker/src
```

For service, environment, database, or integration changes, rebuild Compose and
confirm health:

```sh
docker compose up -d --build --wait
docker compose ps
curl -fsS http://127.0.0.1:3000/api/health
```

Report what changed and which checks actually ran. Do not claim visual or
runtime verification that was not performed.

## Documentation and Git

- Update `docs/ARCHITECTURE.md` when boundaries, data flow, authentication, or
  security decisions change.
- Update `docs/BRAND.md` when tokens, typography, identity, or interaction rules
  change.
- Keep `README.md` accurate for setup, services, and the main workflow.
- Do not commit, push, create branches, or open pull requests unless the user
  explicitly asks for that Git operation.
