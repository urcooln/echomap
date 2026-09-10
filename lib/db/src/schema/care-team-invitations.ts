import { integer, jsonb, pgTable, serial, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childProfilesTable, organizationsTable, usersTable } from "./core-domain";

export const careTeamInvitationsTable = pgTable(
  "care_team_invitations",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id").references(() => childProfilesTable.id, { onDelete: "restrict" }),
    invitedEmail: text("invited_email").notNull(),
    invitedRole: text("invited_role").notNull(),
    status: text("status").notNull().default("pending"),
    invitedByUserId: text("invited_by_user_id").notNull(),
    /** Clerk application invitation used to enforce invite-only account creation. */
    clerkInvitationId: text("clerk_invitation_id"),
    /**
     * SHA-256 digest of an opaque invitation token. The token is deliberately
     * never persisted; routes must hash it before querying this column.
     */
    tokenHash: text("token_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: text("revoked_by_user_id").references(() => usersTable.id, { onDelete: "restrict" }),
    acceptedByUserId: text("accepted_by_user_id").references(() => usersTable.id, { onDelete: "restrict" }),
    /** Server-enforced access level and optional child assignment set. */
    accessScope: text("access_scope").notNull().default("child"),
    childScope: jsonb("child_scope").$type<number[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (table) => [
    index("care_team_invitations_org_child_idx").on(table.organizationId, table.childId),
    index("care_team_invitations_email_idx").on(table.invitedEmail),
    uniqueIndex("care_team_invitations_token_hash_unique").on(table.tokenHash),
    uniqueIndex("care_team_invitations_clerk_invitation_unique").on(
      table.clerkInvitationId,
    ),
    index("care_team_invitations_pending_email_idx").on(table.organizationId, table.invitedEmail, table.status),
  ],
);

export const insertCareTeamInvitationSchema = createInsertSchema(careTeamInvitationsTable).omit({ id: true, createdAt: true, acceptedAt: true });
export type InsertCareTeamInvitation = z.infer<typeof insertCareTeamInvitationSchema>;
export type CareTeamInvitation = typeof careTeamInvitationsTable.$inferSelect;
