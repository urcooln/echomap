import {
  aacVocabularyPlanningTable,
  clinicalGestaltsTable,
  clinicalKnowledgeAppliedFactsTable,
  gestaltCollaborationNotesTable,
  gestaltOccurrencesTable,
  phraseObservationsTable,
  therapySessionGestaltsTable,
  transcriptPhrasesTable,
  type db,
} from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { matchPhraseKey, normalizePhrase } from "./phrase-identity";

type DbExecutor = Pick<
  typeof db,
  "delete" | "insert" | "select" | "update"
>;

type GestaltRecord = typeof clinicalGestaltsTable.$inferSelect;

export const isClinicallyReviewedGestalt = (record: GestaltRecord) => {
  const source = record.source.toLocaleLowerCase();
  const meaning = record.meaning.toLocaleLowerCase();
  const communicationFunction = record.communicationFunction.toLocaleLowerCase();
  const pendingMeaning = /\b(?:awaiting|awaits|await)\s+clinician\s+review\b/.test(meaning);
  return !source.includes("review pending")
    && !source.includes("clinician review pending")
    && !pendingMeaning
    && communicationFunction !== "not yet reviewed";
};

const canonicalFirst = (left: GestaltRecord, right: GestaltRecord) =>
  Number(isClinicallyReviewedGestalt(right)) - Number(isClinicallyReviewedGestalt(left))
  || left.createdAt.getTime() - right.createdAt.getTime()
  || left.id - right.id;

const uniqueStrings = (values: string[]) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, 30);

/**
 * Consolidates only exact phrase identities for one child. It never joins
 * merely similar phrases, and keeps the earliest clinician-reviewed record as
 * the canonical clinical meaning when one is available.
 */
export const repairCanonicalGestaltsForChild = async (
  executor: DbExecutor,
  organizationId: number,
  childId: number,
) => {
  const records = await executor
    .select()
    .from(clinicalGestaltsTable)
    .where(and(
      eq(clinicalGestaltsTable.organizationId, organizationId),
      eq(clinicalGestaltsTable.childId, childId),
      isNull(clinicalGestaltsTable.archivedAt),
    ))
    .for("update");

  const occurrences = await executor
    .select()
    .from(gestaltOccurrencesTable)
    .where(eq(gestaltOccurrencesTable.childId, childId))
    .for("update");

  const recordsByKey = new Map<string, GestaltRecord[]>();
  for (const record of records) {
    const key = matchPhraseKey(record.phrase);
    if (!key) continue;
    recordsByKey.set(key, [...(recordsByKey.get(key) ?? []), record]);
  }

  const canonicalIdForGestaltId = new Map<number, number>();
  let archivedCount = 0;
  for (const [phraseKey, matching] of recordsByKey) {
    if (matching.length === 1) {
      canonicalIdForGestaltId.set(matching[0]!.id, matching[0]!.id);
      continue;
    }

    const [target, ...duplicates] = [...matching].sort(canonicalFirst);
    if (!target || !duplicates.length) continue;
    const duplicateIds = duplicates.map((record) => record.id);
    const affectedOccurrenceRows = occurrences.filter((record) =>
      matchPhraseKey(record.normalizedPhrase) === phraseKey,
    );

    await executor
      .update(therapySessionGestaltsTable)
      .set({ gestaltId: target.id })
      .where(inArray(therapySessionGestaltsTable.gestaltId, duplicateIds));
    await executor
      .update(transcriptPhrasesTable)
      .set({ matchedGestaltId: target.id })
      .where(inArray(transcriptPhrasesTable.matchedGestaltId, duplicateIds));
    await executor
      .update(gestaltCollaborationNotesTable)
      .set({ gestaltId: target.id })
      .where(inArray(gestaltCollaborationNotesTable.gestaltId, duplicateIds));
    await executor
      .update(phraseObservationsTable)
      .set({ gestaltId: target.id })
      .where(inArray(phraseObservationsTable.gestaltId, duplicateIds));
    await executor
      .update(clinicalKnowledgeAppliedFactsTable)
      .set({ gestaltId: target.id })
      .where(inArray(clinicalKnowledgeAppliedFactsTable.gestaltId, duplicateIds));
    const planningRows = await executor
      .select()
      .from(aacVocabularyPlanningTable)
      .where(and(
        eq(aacVocabularyPlanningTable.organizationId, organizationId),
        eq(aacVocabularyPlanningTable.childId, childId),
        inArray(aacVocabularyPlanningTable.gestaltId, [target.id, ...duplicateIds]),
      ))
      .for("update");
    const targetPlanning = planningRows.find((record) => record.gestaltId === target.id);
    const duplicatePlanning = planningRows.filter((record) => duplicateIds.includes(record.gestaltId));
    if (targetPlanning) {
      if (duplicatePlanning.length) {
        await executor.delete(aacVocabularyPlanningTable).where(inArray(
          aacVocabularyPlanningTable.id,
          duplicatePlanning.map((record) => record.id),
        ));
      }
    } else if (duplicatePlanning.length) {
      const [planningToKeep, ...planningToRemove] = duplicatePlanning
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime() || right.id - left.id);
      if (planningToRemove.length) {
        await executor.delete(aacVocabularyPlanningTable).where(inArray(
          aacVocabularyPlanningTable.id,
          planningToRemove.map((record) => record.id),
        ));
      }
      if (planningToKeep) {
        await executor.update(aacVocabularyPlanningTable).set({
          gestaltId: target.id,
          updatedAt: new Date(),
        }).where(eq(aacVocabularyPlanningTable.id, planningToKeep.id));
      }
    }

    // Archive first: the active-only uniqueness index permits retained
    // historical records to keep their original legacy normalization.
    await executor
      .update(clinicalGestaltsTable)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(inArray(clinicalGestaltsTable.id, duplicateIds));
    const [canonical] = await executor
      .update(clinicalGestaltsTable)
      .set({
        normalizedPhrase: normalizePhrase(target.phrase),
        contexts: uniqueStrings([...target.contexts, ...duplicates.flatMap((record) => record.contexts)]),
        updatedAt: new Date(),
      })
      .where(eq(clinicalGestaltsTable.id, target.id))
      .returning();
    if (!canonical) throw new Error("The canonical phrase could not be updated.");

    if (affectedOccurrenceRows.length) {
      await executor
        .delete(gestaltOccurrencesTable)
        .where(inArray(gestaltOccurrencesTable.id, affectedOccurrenceRows.map((record) => record.id)));
      const lastSeenAt = affectedOccurrenceRows
        .map((record) => record.lastSeenAt)
        .filter((value): value is Date => value instanceof Date)
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
      await executor.insert(gestaltOccurrencesTable).values({
        childId,
        gestaltId: canonical.id,
        phrase: canonical.phrase,
        normalizedPhrase: canonical.normalizedPhrase,
        occurrenceCount: affectedOccurrenceRows.reduce(
          (total, record) => total + record.occurrenceCount,
          0,
        ),
        lastSeenAt,
      });
    }

    canonicalIdForGestaltId.set(target.id, canonical.id);
    for (const duplicate of duplicates) canonicalIdForGestaltId.set(duplicate.id, canonical.id);
    archivedCount += duplicates.length;
  }

  return { archivedCount, canonicalIdForGestaltId };
};