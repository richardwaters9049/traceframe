#!/bin/sh
set -eu

: "${AUTH_DEMO_EMAIL:?AUTH_DEMO_EMAIL is required}"
: "${AUTH_DEMO_NAME:?AUTH_DEMO_NAME is required}"
: "${AUTH_DEMO_PASSWORD:?AUTH_DEMO_PASSWORD is required}"

if [ -n "${DATABASE_URL:-}" ]; then
  psql "$DATABASE_URL" --file=/seed/seed-demo-user.sql
else
  : "${PGHOST:?PGHOST is required when DATABASE_URL is not set}"
  : "${PGDATABASE:?PGDATABASE is required when DATABASE_URL is not set}"
  : "${PGUSER:?PGUSER is required when DATABASE_URL is not set}"
  psql --file=/seed/seed-demo-user.sql
fi
