ALTER TABLE "source_material"
  ADD COLUMN "object_status" text NOT NULL DEFAULT 'retained',
  ADD COLUMN "disposal_requested_at" timestamp with time zone,
  ADD COLUMN "disposed_at" timestamp with time zone,
  ADD COLUMN "disposal_failure_reason" text;

ALTER TABLE "source_material"
  ADD CONSTRAINT "source_material_object_status_check"
    CHECK ("object_status" IN ('retained', 'disposal_pending', 'disposed', 'disposal_failed'));

CREATE INDEX "source_material_object_status_idx"
  ON "source_material" ("object_status", "disposal_requested_at", "id");

CREATE TABLE "source_disposal_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" uuid NOT NULL REFERENCES "source_material"("id") ON DELETE cascade,
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 3,
  "last_error" text,
  "available_at" timestamp with time zone NOT NULL DEFAULT now(),
  "locked_at" timestamp with time zone,
  "locked_by" text,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "source_disposal_jobs_source_unique" UNIQUE ("source_id"),
  CONSTRAINT "source_disposal_jobs_status_check"
    CHECK ("status" IN ('pending', 'processing', 'retry', 'completed', 'failed')),
  CONSTRAINT "source_disposal_jobs_attempts_check"
    CHECK ("attempts" >= 0 AND "max_attempts" BETWEEN 1 AND 10 AND "attempts" <= "max_attempts")
);

CREATE INDEX "source_disposal_jobs_claim_idx"
  ON "source_disposal_jobs" ("status", "available_at", "created_at", "id");
