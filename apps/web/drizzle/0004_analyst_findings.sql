CREATE TABLE "findings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "case_id" uuid NOT NULL REFERENCES "cases"("id") ON DELETE cascade,
  "observation_id" uuid NOT NULL REFERENCES "source_observations"("id") ON DELETE restrict,
  "status" text NOT NULL DEFAULT 'proposed',
  "analyst_note" text NOT NULL,
  "review_rationale" text,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE restrict,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "reviewed_at" timestamp with time zone,
  CONSTRAINT "findings_status_check" CHECK ("status" IN ('proposed', 'confirmed', 'dismissed')),
  CONSTRAINT "findings_analyst_note_check" CHECK (char_length("analyst_note") BETWEEN 3 AND 500),
  CONSTRAINT "findings_review_state_check" CHECK (
    ("status" = 'proposed' AND "review_rationale" IS NULL AND "reviewed_by" IS NULL AND "reviewed_at" IS NULL)
    OR
    ("status" IN ('confirmed', 'dismissed') AND char_length("review_rationale") BETWEEN 3 AND 500
      AND "reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL)
  ),
  CONSTRAINT "findings_observation_unique" UNIQUE ("observation_id")
);

CREATE INDEX "findings_case_created_idx"
  ON "findings" ("case_id", "created_at" DESC, "id" DESC);
