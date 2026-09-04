import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRecurringLanguagePatterns,
  filterRecurringPatternEvidence,
  type RecurringPatternEvidence,
} from "../src/lib/recurring-language-patterns";

const evidence = (
  phraseId: number,
  phrase: string,
  phraseKey: string,
  count: number,
  observedAt: string,
  context: string | null,
  sessionId: number | null,
  communicationFunction = "Request",
  evidenceType: RecurringPatternEvidence["evidenceType"] = "observation",
): RecurringPatternEvidence => ({
  phraseId,
  phrase,
  phraseKey,
  count,
  observedAt: new Date(observedAt),
  settings: context ? [context] : [],
  sessionId,
  communicationFunction,
  evidenceType,
});

test("selects deterministic non-redundant fragments across distinct confirmed phrases", () => {
  const result = buildRecurringLanguagePatterns([
    evidence(1, "I want more bubbles!", "iwantmorebubbles", 3, "2026-08-20T10:00:00.000Z", "Clinic", 11),
    evidence(1, "I want more bubbles!", "iwantmorebubbles", 1, "2026-08-21T10:00:00.000Z", "Home", null),
    evidence(2, "I want more snacks", "iwantmoresnacks", 2, "2026-08-22T10:00:00.000Z", "Snack time", 12),
  ]);

  assert.equal(result.summaries.length, 1);
  assert.deepEqual(result.summaries[0], {
    id: "pattern-i-want-more",
    fragment: "i want more",
    phraseCount: 2,
    totalOccurrences: 6,
    firstObservedAt: "2026-08-20T10:00:00.000Z",
    lastObservedAt: "2026-08-22T10:00:00.000Z",
    examplePhrases: ["I want more bubbles!", "I want more snacks"],
    settings: ["Clinic", "Home", "Snack time"],
    reviewedSessionCount: 2,
    environmentCount: 3,
    communicationFunctions: ["Request"],
    communicationFunctionCount: 1,
    indicators: [
      "Repeated Phrase Use",
      "Appears Across Multiple Phrases",
      "Appears Across Multiple Settings",
    ],
  });
  assert.equal(result.details[0]?.phrases[0]?.observations, 4);
  assert.equal(result.details[0]?.observations.length, 3);
});

test("selects a non-stopword recurring word and rejects stopword-only overlap", () => {
  const result = buildRecurringLanguagePatterns([
    evidence(1, "More bubbles", "morebubbles", 1, "2026-08-20T10:00:00.000Z", "Clinic", 11),
    evidence(2, "More snacks", "moresnacks", 1, "2026-08-21T10:00:00.000Z", "Home", 12),
    evidence(3, "In the house", "inthehouse", 1, "2026-08-22T10:00:00.000Z", "Home", 13),
    evidence(4, "In the garden", "inthegarden", 1, "2026-08-23T10:00:00.000Z", "Garden", 14),
  ]);

  assert.equal(result.summaries.length, 1);
  assert.equal(result.summaries[0]?.fragment, "more");
  assert.equal(result.summaries[0]?.phraseCount, 2);
  assert.equal(result.summaries[0]?.totalOccurrences, 2);
});

test("counts each eligible evidence row once and includes the date-window boundary", () => {
  const rows = [
    evidence(1, "Let's go outside", "letsgooutside", 2, "2026-08-24T12:00:00.000Z", "Playground", 21),
    evidence(2, "Let's go home", "letsgohome", 1, "2026-08-25T12:00:00.000Z", "Clinic", 22),
    evidence(2, "Let's go home", "letsgohome", 1, "2026-08-23T11:59:59.999Z", "Clinic", 20),
  ];
  const filtered = filterRecurringPatternEvidence(rows, "7d", new Date("2026-08-31T12:00:00.000Z"));
  const result = buildRecurringLanguagePatterns(filtered);

  assert.equal(filtered.length, 2);
  assert.equal(result.summaries[0]?.fragment, "lets go");
  assert.equal(result.summaries[0]?.totalOccurrences, 3);
});