const allowedAuditMetadataKeys = new Set([
  "environment",
  "contentType",
  "sizeBytes",
  "provider",
  "hasRecording",
  "hasTranscript",
  "audioRetentionDays",
  "sessionNoteRetentionDays",
  "archivedClientStorageDays",
  "childId",
  "organizationId",
  "transcriptId",
  "sessionId",
  "segmentId",
  "previousNlaStage",
  "nlaStage",
  "stageChangeType",
  "changedFields",
]);

export const safeAuditMetadata = (
  metadata: Record<string, unknown> | undefined,
): Record<string, string | number | boolean | null> => {
  if (!metadata) return {};
  return Object.fromEntries(
    Object.entries(metadata).flatMap(([key, value]) => {
      if (!allowedAuditMetadataKeys.has(key)) return [];
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return [[key, value]];
      }
      return [];
    }),
  );
};