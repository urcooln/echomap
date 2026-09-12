// Export your models here. Add one export per file
// export * from "./posts";
//
// Each model/table should ideally be split into different files.
// Each model/table should define a Drizzle table, insert schema, and types:
//
//   import { pgTable, text, serial } from "drizzle-orm/pg-core";
//   import { createInsertSchema } from "drizzle-zod";
//   import { z } from "zod/v4";
//
//   export const postsTable = pgTable("posts", {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//   });
//
//   export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
//   export type InsertPost = z.infer<typeof insertPostSchema>;
//   export type Post = typeof postsTable.$inferSelect;

export * from "./session-transcripts";
export * from "./security-governance";
export * from "./deletion-requests";
export * from "./core-domain";
export * from "./gestalt-collaboration";
export * from "./phrase-observations";
export * from "./clinical-soap-notes";
export * from "./clinical-documentation";
export * from "./communication-goals";
export * from "./communication-passports";
export * from "./manual-session-tracking";
export * from "./clinical-knowledge";
export * from "./care-team-invitations";
export * from "./team-messages";
export * from "./team-message-reads";
export * from "./team-conversations";
export * from "./aac-planning";
export * from "./aac-profile";
export * from "./child-phrase-inbox";
export * from "./shared-child-profile";
export * from "./parent-learning-center";
export * from "./teacher-resource-center";
export * from "./clinician-learning-center";
export * from "./dictionary-duplicate-suggestions";
export * from "./beta-access";
export * from "./slp-onboarding";
export * from "./user-settings";
