import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("analyst"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  uniqueIndex("users_email_lower_unique").on(sql`lower(${table.email})`),
]);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("sessions_expires_at_idx").on(table.expiresAt),
  index("sessions_user_id_idx").on(table.userId),
]);

export const cases = pgTable("cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("standard"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("cases_created_at_id_idx").on(table.createdAt.desc(), table.id.desc()),
  check("cases_status_check", sql`${table.status} IN ('open', 'closed')`),
  check("cases_priority_check", sql`${table.priority} IN ('standard', 'high', 'critical')`),
]);

export const sourceMaterial = pgTable("source_material", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull().unique(),
  originalFilename: text("original_filename").notNull(),
  mediaType: text("media_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  sha256: text("sha256").notNull(),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("queued"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (table) => [index("source_material_case_created_idx").on(table.caseId, table.createdAt.desc(), table.id.desc())]);

export const ingestionJobs = pgTable("ingestion_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id").references(() => cases.id, { onDelete: "cascade" }),
  sourceKey: text("source_key").notNull().unique(),
  sourceId: uuid("source_id").references(() => sourceMaterial.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lastError: text("last_error"),
  availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lockedBy: text("locked_by"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("ingestion_jobs_status_created_at_id_idx").on(table.status, table.createdAt, table.id)]);

export const normalisedSources = pgTable("normalised_sources", {
  sourceId: uuid("source_id").primaryKey().references(() => sourceMaterial.id, { onDelete: "cascade" }),
  normalisedText: text("normalised_text").notNull(),
  characterCount: integer("character_count").notNull(),
  lineCount: integer("line_count").notNull(),
  wordCount: integer("word_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sourceObservations = pgTable("source_observations", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").notNull().references(() => sourceMaterial.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  value: text("value").notNull(),
  occurrences: integer("occurrences").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("source_observations_source_idx").on(table.sourceId, table.kind, table.createdAt, table.id)]);

export const findings = pgTable("findings", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  observationId: uuid("observation_id").notNull().references(() => sourceObservations.id, { onDelete: "restrict" }).unique(),
  status: text("status").notNull().default("proposed"),
  analystNote: text("analyst_note").notNull(),
  reviewRationale: text("review_rationale"),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
}, (table) => [index("findings_case_created_idx").on(table.caseId, table.createdAt.desc(), table.id.desc())]);

export const auditChainHeads = pgTable("audit_chain_heads", {
  ledger: text("ledger").primaryKey(),
  lastSequence: bigint("last_sequence", { mode: "number" }).notNull().default(0),
  lastEventHash: text("last_event_hash"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  objectType: text("object_type").notNull(),
  objectId: text("object_id").notNull(),
  reason: text("reason"),
  metadata: jsonb("metadata").notNull().default({}),
  previousHash: text("previous_hash"),
  eventHash: text("event_hash").notNull(),
  ledgerSequence: bigint("ledger_sequence", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  uniqueIndex("audit_events_ledger_sequence_unique").on(table.ledgerSequence),
  index("audit_events_object_order_idx").on(
    table.objectType,
    table.objectId,
    table.ledgerSequence.desc(),
  ),
]);

export const loginThrottle = pgTable("login_throttle", {
  identityHash: text("identity_hash").primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).defaultNow().notNull(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("login_throttle_updated_at_idx").on(table.updatedAt)]);
