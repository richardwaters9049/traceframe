#!/bin/sh
set -eu

: "${PGHOST:?PGHOST is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"

psql --set=ON_ERROR_STOP=1 <<'SQL'
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
SQL

for migration in /migrations/*.sql; do
  version=$(basename "$migration")
  applied=$(psql --tuples-only --no-align --set=ON_ERROR_STOP=1 \
    --command="SELECT count(*) FROM schema_migrations WHERE version = '$version'")
  if [ "$applied" = "1" ]; then
    echo "migration=$version status=already_applied"
    continue
  fi

  psql --set=ON_ERROR_STOP=1 --set=version="$version" <<SQL
BEGIN;
\i '$migration'
INSERT INTO schema_migrations (version) VALUES (:'version');
COMMIT;
SQL
  echo "migration=$version status=applied"
done
