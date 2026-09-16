import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  buildRecordedSessionSummary,
  hasUnpreparedChildTranscriptPhrase,
  nextPrioritizedChildLanguageReview,
} from "../src/lib/recorded-session-review.ts";

const phrase = (value: string) => ({
  phrase: value,
  meaning: "",
  communicationFunction: "Unknown",
  context: "Therapy",
  emotionalState: "Unknown",
  note: "",
});

test("builds the note from the current selected phrase collection", () => {
  const empty = buildRecordedSessionSummary({
    sessionLabel: "Recorded session",
    selectedPhrases: [],
    clinicalObservations: "",
    goalProgress: [],
    nextSteps: "",
  });
  assert.match(empty, /No reviewed child utterances were selected\./);

  const reviewed = buildRecordedSessionSummary({
    sessionLabel: "Recorded session",
    selectedPhrases: [
      phrase("Let's go again."),
      phrase("I want the ball."),
      phrase("That's so funny."),
    ],
    clinicalObservations: "Shared attention was observed.",
    goalProgress: ["Requesting: Progressed."],
    nextSteps: "",
  });
  assert.doesNotMatch(reviewed, /No reviewed child utterances/);
  assert.match(reviewed, /Let's go again\./);
  assert.match(reviewed, /I want the ball\./);
  assert.match(reviewed, /That's so funny\./);
  assert.match(reviewed, /Requesting: Progressed\./);
  assert.doesNotMatch(reviewed, /Next steps:/);
});

test("keeps selected phrases without requiring a working meaning", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const buttonTestId = appSource.indexOf(
    "button-save-phrase-inbox-${activeInboxItem.id}",
  );
  assert.notEqual(buttonTestId, -1);

  const buttonStart = appSource.lastIndexOf("<Button", buttonTestId);
  const buttonMarkup = appSource.slice(buttonStart, buttonTestId + 220);
  assert.match(buttonMarkup, /disabled=\{updateChildPhraseInbox\.isPending\}/);
  assert.doesNotMatch(buttonMarkup, /inboxMeaningDrafts/);
  assert.match(buttonMarkup, /"reviewed"/);
  assert.match(buttonMarkup, /Keep phrase & continue/);
});

test("advances pending phrase review and exposes the next review step", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    appSource,
    /const activeInboxItem = phraseInboxQuery\.data\?\.find\(\s*\(item\) => item\.status === "pending",\s*\);/,
  );
  assert.match(
    appSource,
    /getElementById\("session-evidence-closeout"\)[\s\S]*?scrollIntoView/,
  );
  assert.match(
    appSource,
    /<section id="session-evidence-closeout" className="space-y-4">/,
  );
});

test("persists selected phrases separately from dictionary promotion", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );

  assert.match(appSource, /useUpdateRecordedSessionReviewDraft/);
  assert.match(appSource, /selectedPhrases: captured\.map/);
  assert.match(appSource, /addToDictionary: false/);
  assert.match(
    appSource,
    /checkbox-add-review-phrase-to-dictionary-\$\{item\.id\}/,
  );
  assert.match(appSource, /Working meaning \(optional\)/);
});

test("sends only intentionally addressed goals to finalization", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    appSource,
    /\.filter\(\(\{ review \}\) => review\.progressStatus !== "not_addressed"\)/,
  );
  assert.match(appSource, /goalReviews: addressedGoalReviews\.map/);
});

test("protects clinician edits during regeneration", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    appSource,
    /sessionNoteEdited &&[\s\S]*?window\.confirm\([\s\S]*?Regenerating will replace your edits/,
  );
});

test("keeps transcript review mode independent from all phrase decisions", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const mutationStart = appSource.indexOf(
    "const reviewChildUtterances = async",
  );
  const mutationEnd = appSource.indexOf(
    "const updatePhraseInboxItem = async",
    mutationStart,
  );
  const mutationSource = appSource.slice(mutationStart, mutationEnd);

  assert.match(
    appSource,
    /useState<\s*"prioritized" \| "chronological"\s*>\("prioritized"\)/,
  );
  assert.doesNotMatch(mutationSource, /setTranscriptReviewMode/);
  assert.doesNotMatch(
    appSource,
    /childUtterances\.length === 0[\s\S]{0,200}setTranscriptReviewMode/,
  );
  for (const [testId, decision] of [
    ["button-utterance-child-", "child"],
    ["button-utterance-not-child-", "not_child"],
    ["button-utterance-unsure-", "unsure"],
    ["button-utterance-unintelligible-", "unintelligible"],
  ] as const) {
    const testIdIndex = appSource.indexOf(testId);
    const buttonStart = appSource.lastIndexOf("<Button", testIdIndex);
    const buttonSource = appSource.slice(buttonStart, testIdIndex + 120);
    assert.notEqual(testIdIndex, -1);
    assert.match(buttonSource, /reviewChildUtterances/);
    assert.match(buttonSource, new RegExp(`"${decision}"`));
    assert.doesNotMatch(buttonSource, /setTranscriptReviewMode/);
  }
});

test("advances to the next pending phrase by review priority", () => {
  const utterances = [
    { segmentId: 30, reviewRank: 3, disposition: "pending" },
    { segmentId: 10, reviewRank: 1, disposition: "child" },
    { segmentId: 20, reviewRank: 2, disposition: "pending" },
  ];

  assert.equal(nextPrioritizedChildLanguageReview(utterances)?.segmentId, 20);

  for (const decision of ["child", "not_child", "unsure", "unintelligible"]) {
    const reviewed = utterances.map((utterance) =>
      utterance.segmentId === 20
        ? { ...utterance, disposition: decision }
        : utterance,
    );
    assert.equal(nextPrioritizedChildLanguageReview(reviewed)?.segmentId, 30);
  }
});

test("does not return to transcription loading for an inbox-managed Child phrase", () => {
  const phrases = [
    { id: 41, childAttributed: true },
    { id: 42, childAttributed: false },
  ];

  assert.equal(
    hasUnpreparedChildTranscriptPhrase({
      phrases,
      ignoredPhraseIds: [],
      capturedPhraseIds: [],
      inboxPhraseIds: [],
    }),
    true,
  );
  assert.equal(
    hasUnpreparedChildTranscriptPhrase({
      phrases,
      ignoredPhraseIds: [],
      capturedPhraseIds: [41],
      inboxPhraseIds: [],
    }),
    false,
  );
  assert.equal(
    hasUnpreparedChildTranscriptPhrase({
      phrases,
      ignoredPhraseIds: [],
      capturedPhraseIds: [],
      inboxPhraseIds: [41],
    }),
    false,
  );
});
