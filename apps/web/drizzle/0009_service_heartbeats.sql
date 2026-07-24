CREATE TABLE "service_heartbeats" (
  "service_name" text NOT NULL,
  "instance_id" text NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "service_heartbeats_pk" PRIMARY KEY ("service_name", "instance_id"),
  CONSTRAINT "service_heartbeats_service_name_check"
    CHECK ("service_name" ~ '^[a-z][a-z0-9_-]{1,63}$'),
  CONSTRAINT "service_heartbeats_instance_id_check"
    CHECK (char_length("instance_id") BETWEEN 3 AND 80)
);

CREATE INDEX "service_heartbeats_service_last_seen_idx"
  ON "service_heartbeats" ("service_name", "last_seen_at" DESC);
