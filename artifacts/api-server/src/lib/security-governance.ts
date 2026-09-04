import {
  db,
  securityAuditLogsTable,
  sensitiveDataClassificationsTable,
} from "@workspace/db";
import { safeAuditMetadata } from "./audit-sanitization";

export { safeAuditMetadata } from "./audit-sanitization";

export type SecurityActor = {
  userId: string;
  author: string;
  role: string;
};

export const SENSITIVE_DATA_CLASSIFICATIONS = [
  ["child_name", "child profile", "Child names are visible only to the authorized child care team."],
  ["date_of_birth", "child profile", "Dates of birth are private child profile data."],
  ["audio_recording", "recording", "Therapy recordings are private and require care-team authorization."],
  ["observation_video", "home observation", "Family-shared observation videos are private and require assigned care-team authorization."],
  ["clinical_observation", "clinical documentation", "Clinical observations are private child data."],
  ["session_note", "clinical documentation", "Session notes and next steps are private clinical documentation."],
  ["gestalt_history", "communication history", "Gestalt history is private communication data."],
  ["aac_profile", "communication profile", "AAC device and vocabulary information is private child communication data."],
] as const;

export const writeSecurityAudit = async ({
  actor,
  action,
  targetType,
  targetId,
  childId,
  outcome = "success",
  metadata,
}: {
  actor: SecurityActor;
  action: string;
  targetType: string;
  targetId?: string | number | null;
  childId?: number | null;
  outcome?: "success" | "failure";
  metadata?: Record<string, unknown>;
}) =>
  db.insert(securityAuditLogsTable).values({
    userId: actor.userId,
    actorName: actor.author,
    actorRole: actor.role,
    action,
    targetType,
    targetId: targetId == null ? null : String(targetId),
    childId: childId ?? null,
    outcome,
    metadata: safeAuditMetadata(metadata),
  });

export const ensureSensitiveDataClassifications = async () => {
  await db
    .insert(sensitiveDataClassificationsTable)
    .values(
      SENSITIVE_DATA_CLASSIFICATIONS.map(([dataType, category, description]) => ({
        dataType,
        category,
        description,
      })),
    )
    .onConflictDoNothing();
};