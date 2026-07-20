CREATE TABLE IF NOT EXISTS "audit_chain_heads" (
  "ledger" text PRIMARY KEY NOT NULL,
  "last_sequence" bigint DEFAULT 0 NOT NULL,
  "last_event_hash" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN IF NOT EXISTS "ledger_sequence" bigint;
--> statement-breakpoint
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS sequence
  FROM audit_events
)
UPDATE audit_events SET ledger_sequence = ordered.sequence
FROM ordered WHERE audit_events.id = ordered.id AND audit_events.ledger_sequence IS NULL;
--> statement-breakpoint
ALTER TABLE "audit_events" ALTER COLUMN "ledger_sequence" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "audit_events_ledger_sequence_unique" ON "audit_events" ("ledger_sequence");
CREATE INDEX IF NOT EXISTS "audit_events_object_order_idx" ON "audit_events" ("object_type", "object_id", "ledger_sequence" DESC);
CREATE INDEX IF NOT EXISTS "cases_created_at_id_idx" ON "cases" ("created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" ("expires_at");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "ingestion_jobs_status_created_at_id_idx" ON "ingestion_jobs" ("status", "created_at", "id");
--> statement-breakpoint
INSERT INTO audit_chain_heads (ledger, last_sequence, last_event_hash)
SELECT 'global', COALESCE(max(ledger_sequence), 0),
  (SELECT event_hash FROM audit_events ORDER BY ledger_sequence DESC LIMIT 1)
FROM audit_events
ON CONFLICT (ledger) DO UPDATE SET
  last_sequence = EXCLUDED.last_sequence,
  last_event_hash = EXCLUDED.last_event_hash,
  updated_at = now();
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_unique";
DO $$
BEGIN
  IF EXISTS (SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Cannot normalise users.email: case-insensitive duplicates exist';
  END IF;
END $$;
UPDATE users SET email = lower(email) WHERE email <> lower(email);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_unique" ON "users" (lower("email"));
ALTER TABLE "cases" DROP CONSTRAINT IF EXISTS "cases_status_check";
ALTER TABLE "cases" ADD CONSTRAINT "cases_status_check" CHECK (status IN ('open', 'closed'));
ALTER TABLE "cases" DROP CONSTRAINT IF EXISTS "cases_priority_check";
ALTER TABLE "cases" ADD CONSTRAINT "cases_priority_check" CHECK (priority IN ('standard', 'high', 'critical'));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "login_throttle" (
  "identity_hash" text PRIMARY KEY NOT NULL,
  "failures" integer DEFAULT 0 NOT NULL,
  "window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "blocked_until" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "login_throttle_updated_at_idx" ON "login_throttle" ("updated_at");
