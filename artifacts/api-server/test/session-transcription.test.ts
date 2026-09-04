import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTranscriptResult,
  childSpeechChunks,
  evidenceSafeTranscriptText,
  intelligibilityFrom,
  MANUAL_TRANSCRIPT_REVIEW_LABEL,
  manualTranscriptReviewSegments,
  normalizePhrase,
  provisionalPhraseCandidates,
  segmentSpeakerTranscript,
  segmentSeparatedSpeakerTranscript,
  segmentTranscript,
  scheduleOptionalSpeakerSeparation,
  sessionReviewProgressFor,
  separateTranscriptSpeakers,
  splitAtPauses,
  speakerRolesForTranscript,
} from "../src/lib/session-transcription";
import { parseProviderTurns } from "../src/lib/speaker-diarization";
import { inferSpeakerRoles } from "../src/lib/speaker-role-inference";

const wavWithPcm = (pcm: Buffer, sampleRate = 16_000) => {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
};

test("keeps distinct labeled speaker turns in transcript order", () => {
  const segments = segmentSpeakerTranscript([
    "Speaker A: Blast off!\nSpeaker B: What would you like to do?\nSpeaker A: Blast off!",
  ]);

  assert.deepEqual(
    segments.map(({ speakerLabel, text }) => [speakerLabel, text]),
    [
      ["Speaker A", "Blast off!"],
      ["Speaker B", "What would you like to do?"],
      ["Speaker A", "Blast off!"],
    ],
  );
  assert.deepEqual(segments.map(({ confidence }) => confidence), ["medium", "medium", "medium"]);
});

test("excludes adult turns from child-only phrase candidates", () => {
  const segments = segmentSpeakerTranscript([
    "Speaker A: Blast off!\nSpeaker B: Please put the train away.\nSpeaker A: Blast off!",
  ]);
  const childPhrases = segmentTranscript(
    childSpeechChunks(segments, new Map([["Speaker A", "child"], ["Speaker B", "slp"]])),
  );

  assert.deepEqual(
    childPhrases.map(({ phrase, frequency }) => [phrase, frequency]),
    [["Blast off", 2]],
  );
});

test("keeps word boundaries in the canonical dictionary phrase identity", () => {
  assert.equal(normalizePhrase(" Ice   cream! "), "ice cream");
  assert.notEqual(
    normalizePhrase("ice cream"),
    normalizePhrase("icecream"),
    "a spacing variation must not qualify as an exact dictionary reuse",
  );
});

test("reassignment changes which turns are eligible for analysis", () => {
  const segments = segmentSpeakerTranscript([
    "Speaker A: I need help.\nSpeaker B: Blast off!",
  ]);
  const before = childSpeechChunks(segments, new Map([["Speaker A", "slp"], ["Speaker B", "unassigned"]]));
  const after = childSpeechChunks(segments, new Map([["Speaker A", "slp"], ["Speaker B", "child"]]));

  assert.deepEqual(before, []);
  assert.deepEqual(after, ["Blast off!"]);
});

test("unassigned speakers never feed child analysis", () => {
  const segments = segmentSpeakerTranscript(["Speaker A: Blast off!"]);
  assert.deepEqual(childSpeechChunks(segments, new Map()), []);
});

test("confirmed non-child roles never feed child-only analysis", () => {
  const segments = segmentSpeakerTranscript([
    "Speaker A: Blast off!\nSpeaker B: Please put the train away.\nSpeaker C: I noticed a pause.",
  ]);

  assert.deepEqual(
    childSpeechChunks(
      segments,
      new Map([["Speaker A", "child"], ["Speaker B", "parent"], ["Speaker C", "unknown"]]),
    ),
    ["Blast off!"],
  );
});

test("keeps a plain transcript available when speaker separation is unavailable", () => {
  const result = buildTranscriptResult(["Blast off!\nI want more bubbles."], 12.4);

  assert.equal(result.rawTranscript, "Blast off!\nI want more bubbles.");
  assert.equal(result.audioDurationSeconds, 12.4);
  assert.equal(result.speakerCount, 0);
  assert.deepEqual(
    childSpeechChunks(result.segments, new Map()),
    [],
    "plain transcription must not be treated as child analysis until an SLP reviews it",
  );
});

test("creates neutral clinician-review turns when speaker grouping is unavailable", () => {
  const segments = manualTranscriptReviewSegments(
    "Blast off! What would you like to do?\n[unintelligible]",
  );

  assert.deepEqual(
    segments.map(({ speakerLabel, text, position, confidence, intelligibility }) => ({
      speakerLabel,
      text,
      position,
      confidence,
      intelligibility,
    })),
    [
      {
        speakerLabel: MANUAL_TRANSCRIPT_REVIEW_LABEL,
        text: "Blast off!",
        position: 0,
        confidence: "low",
        intelligibility: "intelligible",
      },
      {
        speakerLabel: MANUAL_TRANSCRIPT_REVIEW_LABEL,
        text: "What would you like to do?",
        position: 1,
        confidence: "low",
        intelligibility: "intelligible",
      },
      {
        speakerLabel: MANUAL_TRANSCRIPT_REVIEW_LABEL,
        text: "[unintelligible]",
        position: 2,
        confidence: "low",
        intelligibility: "unintelligible",
      },
    ],
  );
  assert.deepEqual(
    childSpeechChunks(segments, new Map()),
    [],
    "neutral fallback turns must never receive an inferred Child role",
  );
});

test("derives durable session review counts and remaining work", () => {
  assert.deepEqual(
    sessionReviewProgressFor(
      6,
      ["child", "not_child", "unsure", "unintelligible", "pending"],
      0,
    ),
    {
      total: 6,
      reviewed: 4,
      unresolved: 2,
      child: 1,
      notChild: 1,
      unsure: 1,
      unintelligible: 1,
      nextStep: "Child Phrase Inbox available.",
    },
  );
});

test("uses persisted review and phrase inbox thresholds for the next step", () => {
  assert.equal(sessionReviewProgressFor(0, [], 0).nextStep, "Continue reviewing Child language.");
  assert.equal(sessionReviewProgressFor(3, ["pending"], 1).nextStep, "Session Summary available.");
  assert.equal(
    sessionReviewProgressFor(2, ["not_child", "unintelligible"], 1).nextStep,
    "Review Complete. Continue to Child Phrase Inbox → Session Summary.",
  );
});

test("review progress does not depend on speaker identification state", () => {
  const unavailableSpeakerState = sessionReviewProgressFor(2, ["child", "pending"], 0);
  const identifiedSpeakerState = sessionReviewProgressFor(2, ["child", "pending"], 0);
  assert.deepEqual(unavailableSpeakerState, identifiedSpeakerState);
});

test("creates actionable provisional candidates without treating them as Child evidence", () => {
  const candidates = provisionalPhraseCandidates(
    "Blast off! Blast off! I want more bubbles. I want more bubbles. More [unclear].",
  );
  const recurring = candidates.find((candidate) => candidate.normalizedPhrase === "blast off");
  const partial = candidates.find((candidate) => candidate.normalizedPhrase === "more");

  assert.equal(recurring?.frequency, 2);
  assert.equal(recurring?.candidateKind, "recurring_utterance");
  assert.equal(partial?.phrase, "More");
  assert.equal(
    candidates.some((candidate) => candidate.normalizedPhrase.includes("unclear")),
    false,
  );
});

test("exposes the configured diarization provider without assigning clinical roles", async () => {
  const { speakerDiarizationAvailability } = await import("../src/lib/speaker-diarization");

  assert.equal(speakerDiarizationAvailability.status, "available");
  assert.equal(speakerDiarizationAvailability.provider, "Replit OpenAI audio diarization");
});

test("keeps raw transcription separate from alternating speaker turns", () => {
  const separatedSegments = segmentSeparatedSpeakerTranscript(
    "Speaker A: Blast off!\nSpeaker B: What would you like to do?\nSpeaker A: Again!",
  );
  const result = buildTranscriptResult(["Blast off! What would you like to do? Again!"], 8.1, separatedSegments);

  assert.equal(result.rawTranscript, "Blast off! What would you like to do? Again!");
  assert.deepEqual(
    result.segments.map(({ speakerLabel, text }) => [speakerLabel, text]),
    [
      ["Speaker A", "Blast off!"],
      ["Speaker B", "What would you like to do?"],
      ["Speaker A", "Again!"],
    ],
  );
  assert.deepEqual(
    childSpeechChunks(result.segments, new Map([["Speaker A", "child"], ["Speaker B", "slp"]])),
    ["Blast off!", "Again!"],
  );
});

test("preserves structured diarization confidence for every turn", () => {
  const separatedSegments = segmentSeparatedSpeakerTranscript(JSON.stringify({
    turns: [
      { speaker: "Speaker A", text: "Blast off!", confidence: "high" },
      { speaker: "Speaker B", text: "What would you like to do?", confidence: "low" },
      { speaker: "Speaker A", text: "Again!", confidence: "medium" },
    ],
  }));

  assert.deepEqual(
    separatedSegments.map(({ speakerLabel, text, confidence }) => [speakerLabel, text, confidence]),
    [
      ["Speaker A", "Blast off!", "high"],
      ["Speaker B", "What would you like to do?", "low"],
      ["Speaker A", "Again!", "medium"],
    ],
  );
});

test("preserves explicit unintelligible and partial vocal turns without guessing words", () => {
  const segments = segmentSeparatedSpeakerTranscript(JSON.stringify({
    turns: [
      {
        speaker: "Speaker A",
        text: "",
        confidence: "medium",
        confidenceScore: 77,
        intelligibility: "unintelligible",
        transcriptionConfidenceScore: 0,
        startTimeMilliseconds: 1200,
        durationMilliseconds: 850,
      },
      {
        speaker: "Speaker A",
        text: "more [unclear]",
        confidence: "high",
        confidenceScore: 93,
        intelligibility: "partially_intelligible",
        transcriptionConfidenceScore: 61,
        startTimeMilliseconds: 2300,
        durationMilliseconds: 1100,
      },
    ],
  }));

  assert.deepEqual(
    segments.map((segment) => ({
      text: segment.text,
      intelligibility: segment.intelligibility,
      transcriptionConfidenceScore: segment.transcriptionConfidenceScore,
      startTimeMilliseconds: segment.startTimeMilliseconds,
      durationMilliseconds: segment.durationMilliseconds,
    })),
    [
      {
        text: "",
        intelligibility: "unintelligible",
        transcriptionConfidenceScore: 0,
        startTimeMilliseconds: 1200,
        durationMilliseconds: 850,
      },
      {
        text: "more [unclear]",
        intelligibility: "partially_intelligible",
        transcriptionConfidenceScore: 61,
        startTimeMilliseconds: 2300,
        durationMilliseconds: 1100,
      },
    ],
  );
  assert.deepEqual(
    childSpeechChunks(segments, new Map([["Speaker A", "child"]])),
    [],
    "uncertain provider text must not become phrase input before review",
  );
});

test("normalizes provider uncertainty markers conservatively", () => {
  assert.equal(intelligibilityFrom(undefined, "[unintelligible]"), "unintelligible");
  assert.equal(intelligibilityFrom(undefined, "more [unclear]"), "partially_intelligible");
  assert.equal(intelligibilityFrom(undefined, "More bubbles"), "intelligible");
});

test("uncertainty markers override contradictory provider intelligibility labels", () => {
  const segments = segmentSeparatedSpeakerTranscript(JSON.stringify({
    turns: [
      {
        speaker: "Speaker A",
        text: "more [unclear]",
        confidence: "high",
        confidenceScore: 94,
        intelligibility: "intelligible",
        transcriptionConfidenceScore: 98,
      },
      {
        speaker: "Speaker A",
        text: "[unintelligible]",
        confidence: "high",
        confidenceScore: 95,
        intelligibility: "intelligible",
        transcriptionConfidenceScore: 99,
      },
    ],
  }));

  assert.deepEqual(
    segments.map((segment) => segment.intelligibility),
    ["partially_intelligible", "unintelligible"],
  );
  assert.deepEqual(
    childSpeechChunks(segments, new Map([["Speaker A", "child"]])),
    [],
  );
});

test("diarization provider parsing cannot downgrade explicit uncertainty markers", () => {
  const segments = parseProviderTurns(JSON.stringify({
    turns: [
      {
        speaker: "Speaker A",
        text: "more [unclear]",
        confidence: "high",
        confidenceScore: 94,
        intelligibility: "intelligible",
        transcriptionConfidenceScore: 98,
      },
      {
        speaker: "Speaker A",
        text: "[unintelligible]",
        confidence: "high",
        confidenceScore: 95,
        intelligibility: "intelligible",
        transcriptionConfidenceScore: 99,
      },
    ],
  }));

  assert.deepEqual(
    segments.map((segment) => segment.intelligibility),
    ["partially_intelligible", "unintelligible"],
  );
});

test("uncertainty annotation tokens never become phrase evidence text", () => {
  const supportedText = evidenceSafeTranscriptText("more [unclear]");
  assert.equal(supportedText, "more");
  assert.equal(evidenceSafeTranscriptText("[unintelligible]"), "");
  assert.equal(
    evidenceSafeTranscriptText("want [inaudible] bubbles"),
    "want bubbles",
  );
  assert.deepEqual(
    segmentTranscript([supportedText]).map((phrase) => phrase.phrase),
    ["more"],
  );
  assert.equal(
    segmentTranscript([supportedText]).some((phrase) => phrase.phrase.includes("unclear")),
    false,
  );
});

test("keeps opaque characteristics and numeric confidence for protected profile matching", () => {
  const profileSignature = "a1b2c3d4e5f6g7h8i9j0_k-l";
  const [segment] = segmentSeparatedSpeakerTranscript(JSON.stringify({
    turns: [{
      speaker: "Provider turn 1",
      text: "Blast off!",
      confidence: "high",
      confidenceScore: 96,
      profileSignature,
    }],
  }));

  assert.equal(segment?.confidenceScore, 96);
  assert.equal(segment?.profileSignature, profileSignature);
});

test("rejects non-opaque speaker characteristics", () => {
  const [segment] = segmentSeparatedSpeakerTranscript(JSON.stringify({
    turns: [{
      speaker: "Provider turn 1",
      text: "Blast off!",
      confidence: "high",
      confidenceScore: 96,
      profileSignature: "Speaker named Maya Chen",
    }],
  }));

  assert.equal(segment?.profileSignature, undefined);
});

test("rejects structured diarization without a supported confidence tier", () => {
  assert.deepEqual(
    segmentSeparatedSpeakerTranscript(JSON.stringify({
      turns: [{ speaker: "Speaker A", text: "Blast off!", confidence: "certain" }],
    })),
    [],
  );
});

test("rejects an unlabeled separation response instead of inventing voices", () => {
  assert.deepEqual(
    segmentSeparatedSpeakerTranscript("Blast off!\nWhat would you like to do?"),
    [],
  );
});

test("rejects mixed labeled and unlabeled separation output", () => {
  assert.deepEqual(
    segmentSeparatedSpeakerTranscript("Speaker A: Blast off!\nAdded summary text."),
    [],
  );
});

test("does not invent speaker groups when automatic separation fails", () => {
  assert.deepEqual(
    segmentSeparatedSpeakerTranscript("Blast off! I want more bubbles.\nPlease help."),
    [],
  );
});

test("applies one child role to every turn in a clinician-confirmed group", () => {
  assert.deepEqual(
    childSpeechChunks(
      [
        { speakerLabel: "Speaker A", text: "Blast off", position: 0, confidence: "high" },
        { speakerLabel: "Speaker B", text: "Please help", position: 1, confidence: "medium" },
        { speakerLabel: "Speaker A", text: "Again", position: 2, confidence: "high" },
      ],
      new Map([["Speaker A", "child"], ["Speaker B", "slp"]]),
    ),
    ["Blast off", "Again"],
  );
});

test("keeps speaker separation available after a delay longer than the former six-second window", async () => {
  let persisted = false;
  scheduleOptionalSpeakerSeparation(
    () => new Promise((resolve) => {
      setTimeout(
          () => resolve([{ speakerLabel: "Speaker A", text: "Blast off!", position: 0, confidence: "high" }]),
        6_100,
      );
    }),
    async () => { persisted = true; },
    () => assert.fail("a delayed separation should not be marked unavailable"),
  );

  assert.equal(persisted, false, "scheduling must return before separation resolves");
  await new Promise((resolve) => setTimeout(resolve, 6_200));
  assert.equal(persisted, true);
});

test("passes speaker provider failures to the durable failure handler", async () => {
  const providerError = new Error("provider timeout");
  let received: unknown;
  scheduleOptionalSpeakerSeparation(
    async () => {
      throw providerError;
    },
    () => assert.fail("failed separation output must never be persisted"),
    (error) => {
      received = error;
    },
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(received, providerError);
});

test("does not reuse a generic speaker role from an earlier transcript", () => {
  const segments = segmentSpeakerTranscript(["Help me."]);
  const assignments = [
    { transcriptId: 41, speakerLabel: "Speaker A", role: "child" },
  ];
  const currentTranscriptRoles = speakerRolesForTranscript(assignments, 42);

  assert.deepEqual(
    childSpeechChunks(segments, currentTranscriptRoles),
    [],
    "a new plain transcript starts unassigned even when an earlier transcript reviewed Speaker A as the child",
  );
});

test("never creates a role assignment from diarization consistency alone", () => {
  const [inference] = inferSpeakerRoles({
    segments: [{
      speakerLabel: "Speaker A",
      text: "hello",
      position: 0,
      confidenceScore: 99,
      profileSignatureHash: null,
    }],
    profiles: [],
    confirmedChildPatterns: [],
    learning: [],
  });

  assert.equal(inference?.state, "unavailable");
  assert.equal(inference?.predictedRole, null);
});

test("requires more than a protected profile match for a provisional role", () => {
  const [inference] = inferSpeakerRoles({
    segments: [{
      speakerLabel: "Speaker A",
      text: "hello",
      position: 0,
      confidenceScore: 96,
      profileSignatureHash: "opaque-child-scoped-profile",
    }],
    profiles: [{ profileSignatureHash: "opaque-child-scoped-profile", role: "child" }],
    confirmedChildPatterns: [],
    learning: [],
  });

  assert.equal(inference?.state, "review_required");
  assert.equal(inference?.predictedRole, "child");
});

test("uses multiple bounded signals for provisional review guidance", () => {
  const [inference] = inferSpeakerRoles({
    segments: [
      {
        speakerLabel: "Speaker A",
        text: "I want more bubbles again, I want more bubbles again!",
        position: 0,
        confidenceScore: 95,
        profileSignatureHash: "opaque-child-scoped-profile",
      },
      {
        speakerLabel: "Speaker A",
        text: "More bubbles again!",
        position: 1,
        confidenceScore: 94,
        profileSignatureHash: "opaque-child-scoped-profile",
      },
    ],
    profiles: [{ profileSignatureHash: "opaque-child-scoped-profile", role: "child" }],
    confirmedChildPatterns: ["Want more bubbles"],
    learning: [{ role: "child", featureKey: "confirmed_role", confirmedCount: 3 }],
  });

  assert.equal(inference?.state, "provisional");
  assert.equal(inference?.predictedRole, "child");
  assert.ok((inference?.signalCount ?? 0) >= 2);
  assert.ok(
    inference?.signalSummary.some(
      (signal) => signal.signal === "confirmed_child_patterns" && signal.contribution > 0,
    ),
  );
});

test("groups recurring phrase fragments across separate child turns", () => {
  const candidates = segmentTranscript([
    "I want more bubbles.",
    "Want more bubbles please.",
  ]);

  assert.equal(
    candidates.find((candidate) => candidate.normalizedPhrase === "want more bubbles")
      ?.frequency,
    2,
  );
});

test("splits an oversized WAV into ordered provider-sized chunks", async () => {
  const wav = wavWithPcm(Buffer.alloc(128_000));
  const providerMaxBytes = 20_000;
  const chunks = await splitAtPauses(wav, providerMaxBytes);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= providerMaxBytes));
  assert.equal(
    chunks.reduce((total, chunk) => total + chunk.length - 44, 0),
    wav.length - 44,
  );
});

test("rejects a provider byte limit that would require too many chunks", async () => {
  const wav = wavWithPcm(Buffer.alloc(128_000));

  await assert.rejects(
    () => splitAtPauses(wav, 2_000),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "TRANSCRIPTION_PROVIDER_LIMIT",
  );
});