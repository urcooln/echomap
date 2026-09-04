import {
  childSpeakerProfilesTable,
  childSpeakerRoleLearningAggregatesTable,
  childSpeakerRolesTable,
  sessionTranscriptsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";

/**
 * Removes transcript-bound data, remembered speaker characteristics, and the
 * legacy child-scoped role records that predate transcript-scoped roles. New
 * role records cascade from transcripts.
 */
export const deleteTranscriptDataForChild = async (
  transaction: {
    delete: (table: unknown) => { where: (condition: unknown) => Promise<unknown> };
  },
  childId: number,
) => {
  await transaction
    .delete(sessionTranscriptsTable)
    .where(eq(sessionTranscriptsTable.childId, childId));
  await transaction
    .delete(childSpeakerRolesTable)
    .where(eq(childSpeakerRolesTable.childId, childId));
  await transaction
    .delete(childSpeakerProfilesTable)
    .where(eq(childSpeakerProfilesTable.childId, childId));
  await transaction
    .delete(childSpeakerRoleLearningAggregatesTable)
    .where(eq(childSpeakerRoleLearningAggregatesTable.childId, childId));
};