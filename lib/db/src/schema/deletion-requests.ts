import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deletionCategoryValues = [
  "profile",
  "observations",
  "transcripts",
  "consent_records",
  "recordings",
] as const;
export type DeletionCategory = (typeof deletionCategoryValues)[number];
export const deletionCategoryProgressStatusValues = [
  "pending",
  "processing",
  "complete",
  "retained",
  "failed",
] as const;
export type DeletionCategoryProgressStatus =
  (typeof deletionCategoryProgressStatusValues)[number];
export type DeletionCategoryProgress = {
  category: DeletionCategory;
  status: DeletionCategoryProgressStatus;
  failureReason: string | null;
};

export const deletionRequestsTable = pgTable(
  "deletion_requests",
  {
    id: serial("id").primaryKey(),
    childId: integer("child_id").notNull(),
    requesterUserId: text("requester_user_id").notNull(),
    requesterName: text("requester_name").notNull(),
    requesterRole: text("requester_role").notNull(),
    categories: text("categories").array().notNull(),
    reason: text("reason").notNull().default(""),
    status: text("status").notNull().default("pending"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id"),
    reviewedByName: text("reviewed_by_name"),
    reviewedByRole: text("reviewed_by_role"),
    reviewNote: text("review_note"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processedCategories: text("processed_categories").array().notNull().default([]),
    retainedCategories: text("retained_categories").array().notNull().default([]),
    retentionNote: text("retention_note").notNull().default(""),
    categoryProgress: jsonb("category_progress")
      .$type<DeletionCategoryProgress[]>()
      .notNull()
      .default([]),
    lastFailureReason: text("last_failure_reason"),
    processingAttempts: integer("processing_attempts").notNull().default(0),
    processingLeaseId: text("processing_lease_id"),
    processingLeaseExpiresAt: timestamp("processing_lease_expires_at", { withTimezone: true }),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    automaticRetriesExhaustedAt: timestamp("automatic_retries_exhausted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("deletion_requests_child_id_idx").on(table.childId),
    index("deletion_requests_requester_user_id_idx").on(table.requesterUserId),
    index("deletion_requests_status_idx").on(table.status),
  ],
);

export const deletionRequestAuditEventsTable = pgTable(
  "deletion_request_audit_events",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => deletionRequestsTable.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    actorName: text("actor_name").notNull(),
    actorRole: text("actor_role").notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("deletion_request_audit_events_request_id_idx").on(table.requestId),
  ],
);

/**
 * Serializes destructive work for one child across deletion requests and API
 * workers. This remains independent of the profile so retained request audits
 * can outlive a profile archive.
 */
export const deletionChildProcessingLocksTable = pgTable(
  "deletion_child_processing_locks",
  {
    childId: integer("child_id").primaryKey(),
    requestId: integer("request_id").notNull(),
    leaseId: text("lease_id").notNull(),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
);

export const insertDeletionRequestSchema = createInsertSchema(deletionRequestsTable).omit({
  id: true,
  reviewedAt: true,
  reviewedByUserId: true,
  reviewedByName: true,
  reviewedByRole: true,
  reviewNote: true,
  processedAt: true,
  createdAt: true,
  updatedAt: true,
});
export const insertDeletionRequestAuditEventSchema = createInsertSchema(
  deletionRequestAuditEventsTable,
).omit({
  id: true,
  createdAt: true,
});

export type InsertDeletionRequest = z.infer<typeof insertDeletionRequestSchema>;
export type DeletionRequestRecord = typeof deletionRequestsTable.$inferSelect;
export type InsertDeletionRequestAuditEvent = z.infer<
  typeof insertDeletionRequestAuditEventSchema
>;
export type DeletionRequestAuditEventRecord =
  typeof deletionRequestAuditEventsTable.$inferSelect;