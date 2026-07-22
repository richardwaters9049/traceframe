#!/bin/sh
set -eu

if [ -n "${DATABASE_URL:-}" ]; then
  run_psql() {
    psql "$DATABASE_URL" "$@"
  }
else
  : "${PGHOST:?PGHOST is required when DATABASE_URL is not set}"
  : "${PGDATABASE:?PGDATABASE is required when DATABASE_URL is not set}"
  : "${PGUSER:?PGUSER is required when DATABASE_URL is not set}"
  run_psql() {
    psql "$@"
  }
fi

run_psql --set=ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SELECT pg_advisory_xact_lock(2041142736);
CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamp with time zone NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (version)
SELECT '0000_natural_wong.sql'
WHERE to_regclass('public.audit_events') IS NOT NULL
  AND to_regclass('public.cases') IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO schema_migrations (version)
SELECT '0001_deep_ender_wiggin.sql'
WHERE to_regclass('public.users') IS NOT NULL
  AND to_regclass('public.sessions') IS NOT NULL
ON CONFLICT DO NOTHING;
COMMIT;
SQL

for migration in /migrations/*.sql; do
  version=$(basename "$migration")
  run_psql --set=ON_ERROR_STOP=1 --set=version="$version" <<SQL
BEGIN;
SELECT pg_advisory_xact_lock(2041142736);
SELECT EXISTS (
  SELECT 1 FROM schema_migrations WHERE version = :'version'
) AS already_applied \gset
\if :already_applied
\echo migration=:version status=already_applied
\else
\i '$migration'
INSERT INTO schema_migrations (version) VALUES (:'version');
\echo migration=:version status=applied
\endif
COMMIT;
SQL
done
