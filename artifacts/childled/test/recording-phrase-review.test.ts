import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { buildRecordedSessionSummary } from "../src/lib/recorded-session-review.ts";

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
