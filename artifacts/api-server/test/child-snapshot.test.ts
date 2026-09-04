import assert from "node:assert/strict";
import test from "node:test";
import { buildChildSnapshot, childAttributedOnly, countReviewedChildSessions } from "../src/lib/child-snapshot";

const now = new Date("2026-08-23T12:00:00.000Z");

test("builds child-scoped totals and honors the seven-day boundary", () => {
  const snapshot = buildChildSnapshot([
    { id: 1, phrase: "Blast off", meaning: "Start", communicationFunction: "Request", contexts: ["Play"], createdAt: new Date("2026-08-16T12:00:00.000Z") },
    { id: 2, phrase: "Again", meaning: "Repeat", communicationFunction: "Request", contexts: ["Play"], createdAt: new Date("2026-08-16T11:59:59.000Z") },
    { id: 3, phrase: "Future", meaning: "Not included", communicationFunction: "Request", contexts: ["Play"], createdAt: new Date("2026-08-24T00:00:00.000Z") },
  ], [], now);

  assert.equal(snapshot.totalGestaltsCollected, 3);
  assert.equal(snapshot.newGestaltsThisWeek, 1);
  assert.equal(snapshot.newGestaltsLastWeek, 1);
  assert.equal(snapshot.newGestaltsTrend, "stable");
});

test("aggregates reviewed child occurrences, functions, contexts, and trend states", () => {
  const snapshot = buildChildSnapshot([], [
    { sessionId: 3, phrase: "Blast off", originalPhrase: "Blast off", meaning: "Start play", communicationFunction: "Request", context: "Play", gestaltId: 1, sessionDate: new Date("2026-08-22T00:00:00.000Z"), frequency: 3 },
    { sessionId: 1, phrase: "Blast off", originalPhrase: "Blast off", meaning: "Start play", communicationFunction: "Request", context: "Home", gestaltId: 1, sessionDate: new Date("2026-08-10T00:00:00.000Z"), frequency: 1 },
    { sessionId: 3, phrase: "Pause please", originalPhrase: "Pause please", meaning: "Flexible boundary", communicationFunction: "Self-Advocacy", context: "Therapy", gestaltId: 2, sessionDate: new Date("2026-08-21T00:00:00.000Z"), frequency: 1 },
  ], now);

  assert.equal(snapshot.totalReviewedChildUtterances, 3);
  assert.equal(snapshot.frequentPhrases[0]?.occurrences, 4);
  assert.deepEqual(snapshot.frequentPhrases[0]?.contexts, ["Play", "Home"]);
  assert.equal(snapshot.frequentPhrases[0]?.trend, "up");
  assert.equal(snapshot.functionDistribution[0]?.label, "Request");
  assert.equal(snapshot.functionDistribution[0]?.percentage, 80);
  assert.equal(snapshot.emergingMitigations[0]?.phrase, "Pause please");
});

test("summarizes the latest reviewed session with new gestalts, functions, and cautious variation evidence", () => {
  const snapshot = buildChildSnapshot([], [
    { sessionId: 1, phrase: "Let's blast off!", originalPhrase: "Let's blast off!", meaning: "Start a familiar play routine", communicationFunction: "Request", context: "Play", gestaltId: 10, sessionDate: new Date("2026-08-10T10:00:00.000Z"), frequency: 1 },
    { sessionId: 2, phrase: "Blast off", originalPhrase: "Let's blast off!", meaning: "Start a familiar play routine", communicationFunction: "Request", context: "Play", gestaltId: 10, sessionDate: new Date("2026-08-17T10:00:00.000Z"), frequency: 2 },
    { sessionId: 2, phrase: "It's my turn now", originalPhrase: "It's my turn now", meaning: "Comment on turn-taking", communicationFunction: "Comment", context: "Game", gestaltId: 11, sessionDate: new Date("2026-08-17T10:00:00.000Z"), frequency: 1 },
  ], now, "Oliver");

  assert.equal(snapshot.sessionChange.comparisonState, "compared");
  assert.match(snapshot.sessionChange.clinicalSummary, /Oliver demonstrated 1 new gestalt/);
  assert.equal(snapshot.sessionChange.newGestalts[0]?.phrase, "It's my turn now");
  assert.equal(snapshot.sessionChange.newFunctions[0]?.label, "Commenting");
  assert.deepEqual(snapshot.sessionChange.newFunctions[0]?.examples[0]?.phrase, "It's my turn now");
  assert.deepEqual(snapshot.sessionChange.possibleMitigations[0], {
    originalPhrase: "Let's blast off!",
    observedVariation: "Blast off",
    confidence: "Moderate",
    context: "Play",
    sessionDate: "2026-08-17T10:00:00.000Z",
  });
});

test("compares communication functions with the immediately preceding reviewed session", () => {
  const snapshot = buildChildSnapshot([], [
    { sessionId: 1, phrase: "I like it", originalPhrase: "I like it", meaning: "Share enjoyment", communicationFunction: "Shared Joy", context: "Play", gestaltId: 30, sessionDate: new Date("2026-08-01T10:00:00.000Z"), frequency: 1 },
    { sessionId: 2, phrase: "Again please", originalPhrase: "Again please", meaning: "Request repetition", communicationFunction: "Request", context: "Play", gestaltId: 31, sessionDate: new Date("2026-08-10T10:00:00.000Z"), frequency: 1 },
    { sessionId: 3, phrase: "This is fun", originalPhrase: "This is fun", meaning: "Share enjoyment", communicationFunction: "Shared Joy", context: "Play", gestaltId: 32, sessionDate: new Date("2026-08-20T10:00:00.000Z"), frequency: 1 },
  ], now, "Oliver");

  assert.equal(snapshot.sessionChange.comparisonState, "compared");
  assert.equal(snapshot.sessionChange.newFunctions[0]?.label, "Shared joy");
});

test("keeps single-occurrence and unrelated phrase changes as cautious or absent mitigation prompts", () => {
  const lowEvidence = buildChildSnapshot([], [
    { sessionId: 1, phrase: "Let's build a tower", originalPhrase: "Let's build a tower", meaning: "Start building", communicationFunction: "Request", context: "Blocks", gestaltId: 40, sessionDate: new Date("2026-08-10T10:00:00.000Z"), frequency: 1 },
    { sessionId: 2, phrase: "Build a tower", originalPhrase: "Build a tower", meaning: "Start building", communicationFunction: "Request", context: "Blocks", gestaltId: 41, sessionDate: new Date("2026-08-20T10:00:00.000Z"), frequency: 1 },
  ], now, "Oliver");
  const unrelated = buildChildSnapshot([], [
    { sessionId: 1, phrase: "Let's build a tower", originalPhrase: "Let's build a tower", meaning: "Start building", communicationFunction: "Request", context: "Blocks", gestaltId: 50, sessionDate: new Date("2026-08-10T10:00:00.000Z"), frequency: 1 },
    { sessionId: 2, phrase: "More bubbles please", originalPhrase: "More bubbles please", meaning: "Request bubbles", communicationFunction: "Request", context: "Water play", gestaltId: 51, sessionDate: new Date("2026-08-20T10:00:00.000Z"), frequency: 2 },
  ], now, "Oliver");

  assert.equal(lowEvidence.sessionChange.possibleMitigations[0]?.confidence, "Low");
  assert.deepEqual(unrelated.sessionChange.possibleMitigations, []);
});

test("uses a supportive first-session summary without claiming a comparison", () => {
  const snapshot = buildChildSnapshot([], [
    { sessionId: 1, phrase: "More music", originalPhrase: "More music", meaning: "Request another song", communicationFunction: "Request", context: "Music", gestaltId: 21, sessionDate: new Date("2026-08-20T10:00:00.000Z"), frequency: 1 },
  ], now, "Maya");

  assert.equal(snapshot.sessionChange.comparisonState, "first_session");
  assert.match(snapshot.sessionChange.clinicalSummary, /Maya’s first reviewed session/);
  assert.equal(snapshot.sessionChange.previousSessionDate, null);
  assert.equal(snapshot.sessionChange.newGestalts[0]?.phrase, "More music");
});

test("returns a safe onboarding snapshot when no reviewed data exists", () => {
  const snapshot = buildChildSnapshot([], [], now);
  assert.equal(snapshot.hasEnoughData, false);
  assert.deepEqual(snapshot.frequentPhrases, []);
  assert.deepEqual(snapshot.functionDistribution, []);
  assert.deepEqual(snapshot.emergingMitigations, []);
  assert.equal(snapshot.sessionChange.comparisonState, "onboarding");
});

test("excludes non-child session evidence before language trend aggregation", () => {
  const phrases = [
    { id: 1, sessionId: 7, childAttributed: true, phrase: "Child phrase" },
    { id: 2, sessionId: 7, childAttributed: false, phrase: "Adult phrase" },
    { id: 3, sessionId: 8, childAttributed: false, phrase: "Another adult phrase" },
    { id: 4, sessionId: 9, childAttributed: true, phrase: "Another child phrase" },
  ];
  assert.deepEqual(childAttributedOnly(phrases), [phrases[0], phrases[3]]);
  assert.equal(countReviewedChildSessions(phrases), 2);
});