CREATE TABLE "source_material" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "case_id" uuid NOT NULL REFERENCES "cases"("id") ON DELETE cascade,
  "object_key" text NOT NULL UNIQUE,
  "original_filename" text NOT NULL,
  "media_type" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "sha256" text NOT NULL,
  "uploaded_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "status" text NOT NULL DEFAULT 'queued',
  "failure_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "processed_at" timestamp with time zone,
  CONSTRAINT "source_material_status_check" CHECK ("status" IN ('queued', 'processing', 'ready', 'failed')),
  CONSTRAINT "source_material_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 1048576),
  CONSTRAINT "source_material_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "source_material_case_sha256_unique" UNIQUE ("case_id", "sha256")
);

CREATE INDEX "source_material_case_created_idx"
  ON "source_material" ("case_id", "created_at" DESC, "id" DESC);

ALTER TABLE "ingestion_jobs"
  ADD COLUMN "source_id" uuid REFERENCES "source_material"("id") ON DELETE cascade,
  ADD COLUMN "max_attempts" integer NOT NULL DEFAULT 3,
  ADD COLUMN "available_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "locked_at" timestamp with time zone,
  ADD COLUMN "locked_by" text,
  ADD COLUMN "completed_at" timestamp with time zone;

ALTER TABLE "ingestion_jobs"
  ADD CONSTRAINT "ingestion_jobs_status_check"
    CHECK ("status" IN ('pending', 'processing', 'retry', 'completed', 'failed')),
  ADD CONSTRAINT "ingestion_jobs_attempts_check"
    CHECK ("attempts" >= 0 AND "max_attempts" BETWEEN 1 AND 10 AND "attempts" <= "max_attempts");

CREATE UNIQUE INDEX "ingestion_jobs_source_id_unique"
  ON "ingestion_jobs" ("source_id") WHERE "source_id" IS NOT NULL;

CREATE INDEX "ingestion_jobs_claim_idx"
  ON "ingestion_jobs" ("status", "available_at", "created_at", "id");

CREATE TABLE "normalised_sources" (
  "source_id" uuid PRIMARY KEY REFERENCES "source_material"("id") ON DELETE cascade,
  "normalised_text" text NOT NULL,
  "character_count" integer NOT NULL,
  "line_count" integer NOT NULL,
  "word_count" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "normalised_sources_counts_check"
    CHECK ("character_count" >= 0 AND "line_count" >= 0 AND "word_count" >= 0)
);

CREATE TABLE "source_observations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" uuid NOT NULL REFERENCES "source_material"("id") ON DELETE cascade,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "occurrences" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "source_observations_kind_check" CHECK ("kind" IN ('ipv4', 'url', 'email')),
  CONSTRAINT "source_observations_occurrences_check" CHECK ("occurrences" > 0),
  CONSTRAINT "source_observations_unique" UNIQUE ("source_id", "kind", "value")
);

CREATE INDEX "source_observations_source_idx"
  ON "source_observations" ("source_id", "kind", "created_at", "id");
