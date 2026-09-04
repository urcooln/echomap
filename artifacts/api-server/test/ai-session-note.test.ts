import assert from "node:assert/strict";
import test from "node:test";
import {
  contentFromAiSessionNote,
  addLongitudinalSessionSummary,
  parseAiSessionNote,
  selectAiSessionEvidence,
} from "../src/lib/ai-session-note";
import {
  DOCUMENTATION_REVIEW_REQUIRED_LABEL,
  DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
  hasRequiredDocumentationLabels,
  hasShareSafeFamilyHighlights,
} from "../src/lib/documentation-draft";

const segment = (
  id: number,
  intelligibility = "intelligible",
) => ({
  id,
  position: id,
  text: `utterance ${id}`,
  intelligibility,
});

const review = (
  segmentId: number,
  disposition: string,
  meaning: string | null = "working meaning",
  intelligibilityReviewStatus = "confirmed",
) => ({
  segmentId,
  disposition,
  meaning,
  context: "session context",
  intelligibilityReviewStatus,
});

test("selects only meaning-backed clinician-confirmed Child utterances", () => {
  const evidence = selectAiSessionEvidence(
    [
      segment(1),
      segment(2),
      segment(3),
      segment(4),
      segment(5),
      segment(6, "unintelligible"),
      segment(7, "partially_intelligible"),
      segment(8, "partially_intelligible"),
      segment(9),
    ],
    [
      review(1, "child"),
      review(2, "confirmed_gestalt"),
      review(3, "not_child"),
      review(4, "unsure"),
      review(5, "unintelligible"),
      review(6, "child"),
      review(7, "child", "working meaning", "pending"),
      review(8, "child"),
      review(9, "child", null),
    ],
  );

  assert.deepEqual(evidence.map((item) => item.segmentId), [1, 2, 8]);
  assert.equal(evidence.every((item) => item.meaning === "working meaning"), true);
});

test("excludes unreviewed turns and never includes a raw transcript container", () => {
  const evidence = selectAiSessionEvidence(
    [segment(1), segment(2)],
    [review(1, "child")],
  );

  assert.deepEqual(evidence.map((item) => Object.keys(item).sort()), [[
    "context",
    "meaning",
    "position",
    "segmentId",
    "utterance",
  ]]);
  assert.equal(evidence.some((item) => "rawTranscript" in item), false);
});

test("rejects empty or incomplete provider output", () => {
  const evidence = selectAiSessionEvidence([segment(1)], [review(1, "child")]);
  assert.throws(() => parseAiSessionNote({}, evidence), /missing a required section/);
  assert.throws(() => parseAiSessionNote(null, evidence), /not an object/);
});

test("accepts only constrained codes tied to eligible evidence", () => {
  const evidence = selectAiSessionEvidence([segment(1)], [review(1, "child")]);
  const valid = {
    functionObservations: [{ segmentId: 1, category: "requesting" }],
    potentialGestaltSegmentIds: [1],
    nlaObservationCodes: ["variation_observed"],
  };
  assert.deepEqual(parseAiSessionNote(valid, evidence), valid);
  assert.throws(
    () => parseAiSessionNote({
      ...valid,
      functionObservations: [{ segmentId: 1, category: "diagnosis" }],
    }, evidence),
    /ineligible evidence/,
  );
  assert.throws(
    () => parseAiSessionNote({
      ...valid,
      potentialGestaltSegmentIds: [999],
    }, evidence),
    /ineligible evidence/,
  );
  assert.throws(
    () => parseAiSessionNote({
      ...valid,
      nlaObservationCodes: ["nla_stage_2"],
    }, evidence),
    /unsupported observation/,
  );
  assert.throws(
    () => parseAiSessionNote({
      sessionSummary: "The child has autism and should begin therapy twice weekly.",
      functionObservations: [],
      potentialGestaltSegmentIds: [],
      nlaObservationCodes: [],
    }, evidence),
    /unsupported field/,
  );
});

test("adds immutable AI and clinician-review labels without clinical conclusions", () => {
  const evidence = selectAiSessionEvidence([segment(1)], [review(1, "child")]);
  const draft = parseAiSessionNote({
    functionObservations: [{ segmentId: 1, category: "requesting" }],
    potentialGestaltSegmentIds: [1],
    nlaObservationCodes: ["variation_observed"],
  }, evidence);
  const content = contentFromAiSessionNote(draft, evidence);

  assert.equal(hasRequiredDocumentationLabels(content), true);
  assert.match(content.nlaObservations, new RegExp(DOCUMENTATION_SUGGESTED_INSIGHT_LABEL));
  assert.match(content.potentialGestalts, new RegExp(DOCUMENTATION_REVIEW_REQUIRED_LABEL));
  assert.match(content.suggestedClinicalImpressions, /No diagnosis, treatment recommendation/);
  assert.doesNotMatch(
    Object.values(content).join("\n"),
    /autism|apraxia|stage\s*[1-6]|begin therapy twice weekly/i,
  );
  assert.equal(content.clinicianNotes, "");
  assert.match(content.observedLanguage, /utterance-1/);
  assert.match(content.aacPlanningOpportunities, /No AAC plan or support was changed/);
  assert.match(content.suggestedDictionaryCandidates, /never changes the Communication Dictionary/);
  assert.match(content.sessionParticipation, /No engagement, intent, responsiveness/);
  assert.equal(content.evidenceReferences.length, 1);
  assert.equal(content.evidenceReferences[0]?.kind, "reviewed_utterance");
  assert.equal(hasShareSafeFamilyHighlights(content), true);
});

test("builds cautious longitudinal comparisons from reviewed history only", () => {
  const current = [{
    segmentId: 10,
    position: 0,
    utterance: "Let's go",
    meaning: "Ready to move",
    context: "Hallway",
    communicationFunction: "Directing",
  }, {
    segmentId: 11,
    position: 1,
    utterance: "Help me",
    meaning: "Requests assistance",
    context: "Therapy",
    communicationFunction: "Assistance seeking",
  }];
  const base = contentFromAiSessionNote({
    functionObservations: [{ segmentId: 10, category: "regulation_support_seeking" }],
    potentialGestaltSegmentIds: [11],
    nlaObservationCodes: ["variation_observed"],
  }, current);
  const enriched = addLongitudinalSessionSummary(base, current, {
    priorEvidence: [{
      segmentId: -1,
      position: 0,
      utterance: "Let's go",
      meaning: "Ready to move",
      context: "Classroom",
      communicationFunction: "Directing",
    }, {
      segmentId: -2,
      position: 1,
      utterance: "All done",
      meaning: "Requests ending",
      context: "Therapy",
      communicationFunction: "Protest",
    }],
    priorSessionCount: 1,
    priorFunctions: ["Directing", "Protest"],
    dictionaryPhrases: ["Let's go", "All done"],
  });

  assert.match(enriched.notableLanguageChanges, /Newly observed.*“Help me”/s);
  assert.match(enriched.notableLanguageChanges, /Prior phrases not observed.*“All done”/s);
  assert.match(enriched.notableLanguageChanges, /Reused in a different recorded context.*“Let's go”/s);
  assert.match(enriched.notableLanguageChanges, /First-observed communication functions: Assistance seeking/);
  assert.match(enriched.communicationGrowthSnapshot, /may reflect the recorded sample/);
  assert.equal(enriched.evidenceReferences.some((item) => item.kind === "prior_reviewed_session"), true);
  assert.equal(enriched.evidenceReferences.some((item) => item.kind === "dictionary_history"), true);
});

test("rejects diagnostic or NLA language from shareable highlights", () => {
  const evidence = selectAiSessionEvidence([segment(1)], [review(1, "child")]);
  const content = contentFromAiSessionNote({
    functionObservations: [],
    potentialGestaltSegmentIds: [],
    nlaObservationCodes: [],
  }, evidence);
  assert.equal(hasShareSafeFamilyHighlights({
    ...content,
    familyTeamHighlights: "Clinician Review Required\nThe child is at NLA stage 2.",
  }), false);
  assert.equal(hasShareSafeFamilyHighlights({
    ...content,
    familyTeamHighlights: "Clinician Review Required\nThe phrase was confirmed during the reviewed session.",
  }), true);
  for (const unsafe of [
    "This diagnoses a communication disorder.",
    "We recommend therapy twice weekly.",
    "A therapy goal should address this phrase.",
    "Natural Language Acquisition stage two was observed.",
    "Prescribe a treatment plan.",
  ]) {
    assert.equal(hasShareSafeFamilyHighlights({
      ...content,
      familyTeamHighlights: `Clinician Review Required\n${unsafe}`,
    }), false, unsafe);
  }
});