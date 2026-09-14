import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { careTeamInvitationsTable } from "./care-team-invitations";
import {
  childProfilesTable,
  organizationsTable,
  usersTable,
} from "./core-domain";

export const studentTransfersTable = pgTable(
  "student_transfers",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    childId: integer("child_id")
      .notNull()
      .references(() => childProfilesTable.id, { onDelete: "restrict" }),
    fromSlpUserId: text("from_slp_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    toSlpUserId: text("to_slp_user_id").references(() => usersTable.id, {
      onDelete: "restrict",
    }),
    destinationEmail: text("destination_email").notNull(),
    transferMode: text("transfer_mode").notNull(),
    status: text("status").notNull().default("pending"),
    invitationId: integer("invitation_id").references(
      () => careTeamInvitationsTable.id,
      { onDelete: "restrict" },
    ),
    initiatedByUserId: text("initiated_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByUserId: text("cancelled_by_user_id").references(
      () => usersTable.id,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "student_transfers_mode_check",
      sql`${table.transferMode} in ('existing_account', 'invitation')`,
    ),
    check(
      "student_transfers_status_check",
      sql`${table.status} in ('pending', 'completed', 'cancelled')`,
    ),
    uniqueIndex("student_transfers_one_pending_child_unique")
      .on(table.childId)
      .where(sql`${table.status} = 'pending'`),
    uniqueIndex("student_transfers_invitation_unique")
      .on(table.invitationId)
      .where(sql`${table.invitationId} is not null`),
    index("student_transfers_org_child_requested_idx").on(
      table.organizationId,
      table.childId,
      table.requestedAt,
    ),
    index("student_transfers_destination_status_idx").on(
      table.organizationId,
      table.destinationEmail,
      table.status,
    ),
  ],
);

export type StudentTransfer = typeof studentTransfersTable.$inferSelect;
