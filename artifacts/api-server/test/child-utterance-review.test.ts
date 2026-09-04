import assert from "node:assert/strict";
import test from "node:test";
import {
  canCreatePhraseEvidenceFrom,
  hasMeaningBackedConfirmedUtterance,
  hasUnresolvedChildUtteranceReviews,
} from "../src/lib/child-utterance-review";

test("session closeout remains blocked when a confirmed Child turn has no review", () => {
  assert.equal(
    hasUnresolvedChildUtteranceReviews([11, 12], [
      { segmentId: 11, disposition: "not_gestalt", meaning: null },
    ]),
    true,
  );
});

test("session closeout remains blocked when a Child review is pending", () => {
  assert.equal(
    hasUnresolvedChildUtteranceReviews([11], [
      { segmentId: 11, disposition: "pending", meaning: null },
    ]),
    true,
  );
});

test("context and exclusion resolve review without creating evidence", () => {
  const reviews = [
    { segmentId: 11, disposition: "context", meaning: null },
    { segmentId: 12, disposition: "not_gestalt", meaning: null },
  ];
  assert.equal(hasUnresolvedChildUtteranceReviews([11, 12], reviews), false);
  assert.equal(hasMeaningBackedConfirmedUtterance(reviews), false);
});

test("only a meaning-backed confirmed utterance can support transcript evidence", () => {
  assert.equal(hasMeaningBackedConfirmedUtterance([
    { segmentId: 11, disposition: "confirmed_gestalt", meaning: "Requests another turn." },
  ]), true);
  assert.equal(hasMeaningBackedConfirmedUtterance([
    { segmentId: 11, disposition: "confirmed_gestalt", meaning: "  " },
  ]), false);
});

test("unintelligible speech requires an explicit classification", () => {
  assert.equal(
    hasUnresolvedChildUtteranceReviews([
      { id: 11, intelligibility: "unintelligible" },
    ], []),
    true,
  );
  assert.equal(
    hasUnresolvedChildUtteranceReviews([
      { id: 11, intelligibility: "unintelligible" },
    ], [
      { segmentId: 11, disposition: "unintelligible", meaning: null },
    ]),
    false,
  );
});

test("all four explicit classifications resolve utterance review", () => {
  const reviews = [
    { segmentId: 11, disposition: "child", meaning: "Requests another turn." },
    { segmentId: 12, disposition: "not_child", meaning: null },
    { segmentId: 13, disposition: "unsure", meaning: null },
    { segmentId: 14, disposition: "unintelligible", meaning: null },
  ];
  assert.equal(hasUnresolvedChildUtteranceReviews([11, 12, 13, 14], reviews), false);
  assert.equal(hasMeaningBackedConfirmedUtterance(reviews), true);
});

test("only meaning-backed Child classifications create phrase evidence", () => {
  const segment = { intelligibility: "intelligible" };
  assert.equal(canCreatePhraseEvidenceFrom(segment, {
    segmentId: 11,
    disposition: "child",
    meaning: "Requests help.",
  }), true);
  assert.equal(canCreatePhraseEvidenceFrom(segment, {
    segmentId: 11,
    disposition: "child",
    meaning: null,
  }), false);
  assert.equal(canCreatePhraseEvidenceFrom(segment, {
    segmentId: 11,
    disposition: "not_child",
    meaning: "Requests help.",
  }), false);
});

test("partial transcription needs clinician confirmation before phrase evidence", () => {
  const partial = { intelligibility: "partially_intelligible" };
  const review = {
    segmentId: 11,
    disposition: "confirmed_gestalt",
    meaning: "Requests another turn.",
    intelligibilityReviewStatus: "pending",
  };
  assert.equal(canCreatePhraseEvidenceFrom(partial, review), false);
  assert.equal(
    canCreatePhraseEvidenceFrom(partial, {
      ...review,
      intelligibilityReviewStatus: "confirmed",
    }),
    true,
  );
  assert.equal(
    canCreatePhraseEvidenceFrom(
      { intelligibility: "unintelligible" },
      { ...review, intelligibilityReviewStatus: "confirmed" },
    ),
    false,
  );
});