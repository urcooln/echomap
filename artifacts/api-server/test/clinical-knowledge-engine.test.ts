import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKnowledgeInsightDrafts,
  retrieveRelevantKnowledge,
  reviewedPhraseSelection,
  routeInsightDraft,
  insightRunRecoveryState,
  shouldArchiveEngineOwnedGestalt,
} from "../src/lib/clinical-knowledge-engine";
import { citationsForTimelineEvidence } from "@workspace/api-zod/language-journey";

test("only reviewed Child phrases can satisfy a supplied knowledge-insight phrase", () => {
  const records = [
    { phrase: "Let's go", childAttributed: true },
    { phrase: "Try again", childAttributed: false },
  ];

  const chunks = [
    {
      id: 1, sourceId: 1, sourceVersionId: 1, sourceTitle: "Motor planning",
      page: null, section: null, text: "Fine motor exercises and pencil grip guidance.",
    },
  ];
  assert.deepEqual(retrieveRelevantKnowledge("reviewed gestalt phrase transition", chunks), []);
  assert.equal(retrieveRelevantKnowledge("pencil grip", chunks).length, 1);
});

test("category-aware retrieval produces cited, tentative, reviewable GLP prompts", () => {
  const corpus = [
    {
      id: 1, sourceId: 10, sourceVersionId: 1, sourceTitle: "GLP Reference",
      page: 3, section: "NLA stage reference",
      text: "Possible NLA stage indicators include mitigated chunks and flexible recombination in a spontaneous language sample.",
    },
    {
      id: 2, sourceId: 10, sourceVersionId: 1, sourceTitle: "GLP Reference",
      page: 5, section: "Parent coaching",
      text: "Parent coaching acknowledges the child's message, follows child-led play, and supports co-regulation.",
    },
    {
      id: 3, sourceId: 11, sourceVersionId: 2, sourceTitle: "Assessment Protocol",
      page: 6, section: "SOAP",
      text: "SOAP documentation records objective reviewed utterances, possible mitigations, and clinician-reviewed plans.",
    },
  ];
  const drafts = buildKnowledgeInsightDrafts({
    phrase: "Let's go",
    functions: ["Transition"],
    contexts: ["Therapy"],
    reviewedPhraseCount: 2,
    reviewedObservationCount: 1,
    sessionId: 7,
  }, corpus);
  const stage = drafts.find((draft) => draft.category === "nla_stage_indicator");
  const soap = drafts.find((draft) => draft.category === "soap_insight");
  const parent = drafts.find((draft) => draft.category === "parent_coaching");
  assert.ok(stage);
  assert.match(stage.suggestion, /possible NLA indicator/i);
  assert.equal(stage.citations[0]?.page, 3);
  assert.ok(stage.confidenceScore >= 35 && stage.confidenceScore <= 90);
  assert.ok(soap?.citations.some((citation) => citation.section === "SOAP"));
  assert.ok(parent?.citations.some((citation) => citation.section === "Parent coaching"));
});

test("only high-confidence routine findings route to automatic application", () => {
  const evidence = {
    phrase: "Ready set go",
    functions: ["Request"],
    contexts: ["Therapy"],
    reviewedPhraseCount: 3,
    reviewedObservationCount: 1,
    sessionId: 12,
  };
  const base = {
    confidenceScore: 90,
    suggestion: "Cited support",
    rationale: "Reviewed Child evidence",
    citations: [],
    evidenceSnapshot: {
      reviewedPhraseCount: 4,
      reviewedObservationCount: 0,
      sessionId: 13,
      phrase: "Maybe later",
      evidenceVersion: "reviewed-evidence-v1:13:4",
    },
    confidence: "high" as const,
  };
  assert.equal(routeInsightDraft({
    ...base, category: "gestalt_identification", confidence: "high",
  }, evidence).disposition, "applied");
  assert.equal(routeInsightDraft({
    ...base, category: "communication_function", confidence: "medium",
  }, evidence).disposition, "monitoring");
  const stage = routeInsightDraft({
    ...base, category: "nla_stage_indicator", confidence: "high",
  }, evidence);
  assert.equal(stage.disposition, "exception");
  assert.equal(stage.reviewReason, "possible_stage_transition");
});

test("unknown functions and mitigation prompts always remain clinician exceptions", () => {
  const unknownEvidence = {
    phrase: "Maybe later",
    functions: ["Unknown"],
    contexts: ["Home"],
    reviewedPhraseCount: 4,
    reviewedObservationCount: 0,
    sessionId: 13,
  };
  const base = {
    confidenceScore: 90,
    suggestion: "Cited support",
    rationale: "Reviewed Child evidence",
    citations: [],
    evidenceSnapshot: {
      reviewedPhraseCount: 4,
      reviewedObservationCount: 0,
      sessionId: 13,
      phrase: "Maybe later",
      evidenceVersion: "reviewed-evidence-v1:13:4",
    },
    confidence: "high" as const,
  };
  const unknown = routeInsightDraft({
    ...base, category: "communication_function",
  }, unknownEvidence);
  assert.equal(unknown.disposition, "exception");
  assert.equal(unknown.reviewReason, "unknown_function");
  const mitigation = routeInsightDraft({
    ...base, category: "mitigation_observation",
  }, { ...unknownEvidence, functions: ["Request"] });
  assert.equal(mitigation.disposition, "exception");
  assert.equal(mitigation.reviewReason, "possible_mitigation");
});

test("expired insight leases retry safely and end with an auditable terminal state", () => {
  assert.equal(insightRunRecoveryState({
    status: "running", attempt: 2, leaseExpired: true, maxAttempts: 3,
  }), "lease_expired");
  assert.equal(insightRunRecoveryState({
    status: "running", attempt: 3, leaseExpired: true, maxAttempts: 3,
  }), "attempts_exhausted");
  assert.equal(insightRunRecoveryState({
    status: "failed", attempt: 2, leaseExpired: false, maxAttempts: 3,
  }), "retry");
});

test("reversion archives only an unreferenced engine-owned inventory record", () => {
  assert.equal(shouldArchiveEngineOwnedGestalt({
    engineCreatedGestalt: true,
    gestaltSource: "Clinical Insights Engine",
    activeReferences: 0,
  }), true);
  assert.equal(shouldArchiveEngineOwnedGestalt({
    engineCreatedGestalt: true,
    gestaltSource: "Reviewed session",
    activeReferences: 0,
  }), false);
  assert.equal(shouldArchiveEngineOwnedGestalt({
    engineCreatedGestalt: true,
    gestaltSource: "Clinical Insights Engine",
    activeReferences: 1,
  }), false);
});

test("timeline citations match active reviewed phrase evidence only", () => {
  const matchingCitation = { chunkId: 11, sourceTitle: "Language reference" };
  const duplicateMatchingCitation = { chunkId: 11, sourceTitle: "Language reference" };
  const unrelatedCitation = { chunkId: 22, sourceTitle: "Unrelated reference" };
  const insights = [
    {
      status: "applied",
      evidence: { phrase: "  LET'S   GO " },
      citations: [matchingCitation, duplicateMatchingCitation],
    },
    {
      status: "applied",
      evidence: { phrase: "Try again" },
      citations: [unrelatedCitation],
    },
    {
      status: "reverted",
      evidence: { phrase: "Let's go" },
      citations: [{ chunkId: 33, sourceTitle: "Reverted reference" }],
    },
    {
      status: "applied",
      evidence: { phrase: null },
      citations: [{ chunkId: 44, sourceTitle: "Phrase-less reference" }],
    },
  ];
  assert.deepEqual(citationsForTimelineEvidence("Let's go", insights), [matchingCitation]);
  assert.deepEqual(citationsForTimelineEvidence(undefined, insights), []);
});
