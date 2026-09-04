import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable, usersTable } from "./core-domain";

/**
 * Public applicants may only receive a sanitized projection of this record.
 * Review notes and reviewer identity are retained solely for super-admin use.
 */
export const betaAccessRequestsTable = pgTable(
  "beta_access_requests",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    organizationName: text("organization_name").notNull(),
    requestedRole: text("requested_role").notNull(),
    message: text("message"),
    status: text("status").notNull().default("pending"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => usersTable.id, { onDelete: "restrict" }),
    reviewNotes: text("review_notes"),
    approvedOrganizationId: integer("approved_organization_id").references(() => organizationsTable.id, { onDelete: "restrict" }),
    invitationId: integer("invitation_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("beta_access_requests_status_created_idx").on(table.status, table.createdAt),
    index("beta_access_requests_email_idx").on(table.email),
  ],
);

/** A singleton row (id=1), managed only through super-admin controls. */
export const betaControlsTable = pgTable("beta_controls", {
  id: integer("id").primaryKey().default(1),
  enabled: boolean("enabled").notNull().default(true),
  defaultCohort: text("default_cohort"),
  defaultOrganizationUserLimit: integer("default_organization_user_limit"),
  invitationLimitPerDay: integer("invitation_limit_per_day").notNull().default(25),
  currentNoticeVersion: text("current_notice_version").notNull().default("1"),
  updatedByUserId: text("updated_by_user_id").references(() => usersTable.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const betaNoticesTable = pgTable(
  "beta_notices",
  {
    id: serial("id").primaryKey(),
    version: text("version").notNull(),
    body: text("body").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id").references(() => usersTable.id, { onDelete: "restrict" }),
  },
  (table) => [uniqueIndex("beta_notices_version_unique").on(table.version)],
);

export const betaNoticeAcknowledgementsTable = pgTable(
  "beta_notice_acknowledgements",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    noticeVersion: text("notice_version").notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("beta_notice_acknowledgements_user_version_unique").on(table.userId, table.noticeVersion),
    index("beta_notice_acknowledgements_user_idx").on(table.userId),
  ],
);

export const insertBetaAccessRequestSchema = createInsertSchema(betaAccessRequestsTable)
  .omit({ id: true, status: true, reviewedAt: true, reviewedByUserId: true, reviewNotes: true, approvedOrganizationId: true, archivedAt: true, createdAt: true, updatedAt: true });
export const insertBetaControlsSchema = createInsertSchema(betaControlsTable).omit({ createdAt: true, updatedAt: true });
export const insertBetaNoticeSchema = createInsertSchema(betaNoticesTable).omit({ id: true, publishedAt: true, retiredAt: true });
export const insertBetaNoticeAcknowledgementSchema = createInsertSchema(betaNoticeAcknowledgementsTable).omit({ id: true, acknowledgedAt: true });

export type BetaAccessRequest = typeof betaAccessRequestsTable.$inferSelect;
export type BetaControls = typeof betaControlsTable.$inferSelect;
export type BetaNotice = typeof betaNoticesTable.$inferSelect;
export type BetaNoticeAcknowledgement = typeof betaNoticeAcknowledgementsTable.$inferSelect;
export type InsertBetaAccessRequest = z.infer<typeof insertBetaAccessRequestSchema>;