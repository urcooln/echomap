import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  convertToWav,
  ensureCompatibleFormat,
  speechToText,
} from "@workspace/integrations-openai-ai-server/audio";
import { batchProcess } from "@workspace/integrations-openai-ai-server/batch";
import { getSpeakerDiarizationProvider } from "./speaker-diarization";
import { RecordingPipelineError } from "./recording-pipeline";
import { matchPhraseKey, normalizePhrase } from "./phrase-identity";

export { matchPhraseKey, normalizePhrase } from "./phrase-identity";

const MAX_TRANSCRIPTION_CHUNKS = 12;
const MIN_CHUNK_SECONDS = 0.35;
// Keeping a conversation together preserves the provider's temporary speaker
// labels. Splitting every few seconds makes the same voice look like a new
// speaker in each chunk, which creates unsafe work for the clinical review.
const TARGET_CHUNK_SECONDS = 8 * 60;
const SILENCE_SECONDS = 0.65;
export const DEFAULT_PROVIDER_MAX_BYTES = 25 * 1024 * 1024;

type WavInfo = {
  dataOffset: number;
  dataSize: number;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  blockAlign: number;
};

export type SegmentedPhrase = {
  phrase: string;
  normalizedPhrase: string;
  frequency: number;
};

export type SpeakerSegment = {
  speakerLabel: string;
  text: string;
  position: number;
  confidence: SpeakerConfidence;
  confidenceScore?: number;
  intelligibility?: SpeechIntelligibility;
  transcriptionConfidenceScore?: number;
  startTimeMilliseconds?: number;
  durationMilliseconds?: number;
  /**
   * An opaque, provider-issued characteristic. It is never persisted directly;
   * the route hashes it before storage and only uses it within this child.
   */
  profileSignature?: string;
};
export type SpeakerRole =
  | "unassigned"
  | "child"
  | "slp"
  | "parent"
  | "teacher"
  | "caregiver"
  | "unknown";
export type SpeakerConfidence = "high" | "medium" | "low";
export type SpeechIntelligibility =
  | "intelligible"
  | "partially_intelligible"
  | "unintelligible";

const speakerConfidenceValues = new Set<SpeakerConfidence>(["high", "medium", "low"]);
const toSpeakerConfidence = (value: unknown): SpeakerConfidence =>
  typeof value === "string" && speakerConfidenceValues.has(value as SpeakerConfidence)
    ? value as SpeakerConfidence
    : "low";

const opaqueProfileSignature = (value: unknown) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{16,256}$/u.test(value)
    ? value
    : undefined;

const confidenceScore = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100
    ? value
    : undefined;

const intelligibilityValues = new Set<SpeechIntelligibility>([
  "intelligible",
  "partially_intelligible",
  "unintelligible",
]);

const nonNegativeMilliseconds = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;

export const intelligibilityFrom = (
  value: unknown,
  text: string,
): SpeechIntelligibility => {
  const normalized = text.trim().toLocaleLowerCase();
  if (
    /^\[?(?:unintelligible|inaudible|unclear)(?:\s+(?:speech|vocalization))?\]?$/u.test(
      normalized,
    )
  ) {
    return "unintelligible";
  }
  if (/\[(?:unintelligible|inaudible|unclear)\]/u.test(normalized)) {
    return "partially_intelligible";
  }
  if (
    typeof value === "string"
    && intelligibilityValues.has(value as SpeechIntelligibility)
  ) {
    return value as SpeechIntelligibility;
  }
  return "intelligible";
};

export const evidenceSafeTranscriptText = (text: string) =>
  text
    .replace(/\[(?:unintelligible|inaudible|unclear)\]/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();

export const MANUAL_TRANSCRIPT_REVIEW_LABEL = "Transcript utterance";

export const sessionReviewProgressFor = (
  total: number,
  dispositions: string[],
  activePhraseInboxCount: number,
) => {
  const child = dispositions.filter((value) => value === "child" || value === "confirmed_gestalt").length;
  const reviewed = dispositions.filter((value) => value !== "pending").length;
  const reviewComplete = total > 0 && reviewed === total;
  return {
    total,
    reviewed,
    unresolved: Math.max(0, total - reviewed),
    child,
    notChild: dispositions.filter((value) => value === "not_child" || value === "not_gestalt").length,
    unsure: dispositions.filter((value) => value === "unsure" || value === "context").length,
    unintelligible: dispositions.filter((value) => value === "unintelligible" || value === "unlabeled").length,
    nextStep: reviewComplete
      ? "Review Complete. Continue to Child Phrase Inbox → Session Summary."
      : activePhraseInboxCount > 0
        ? "Session Summary available."
        : child > 0
          ? "Child Phrase Inbox available."
          : "Continue reviewing Child language.",
  };
};

/**
 * Builds neutral review turns from the primary transcript when optional speaker
 * grouping is unavailable. These turns deliberately contain no identity, role,
 * timing, or confidence inference; they become evidence only through the
 * existing explicit clinician review gate.
 */
export const manualTranscriptReviewSegments = (
  rawTranscript: string,
): SpeakerSegment[] =>
  rawTranscript
    .split(/(?<=[.!?;])\s+|\r?\n+/u)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, position) => ({
      speakerLabel: MANUAL_TRANSCRIPT_REVIEW_LABEL,
      text,
      position,
      confidence: "low",
      intelligibility: intelligibilityFrom(undefined, text),
    }));

const parseWav = (buffer: Buffer): WavInfo => {
  if (
    buffer.length < 44 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new Error("The converted recording is not a valid WAV file.");
  }

  let offset = 12;
  let sampleRate = 16_000;
  let channels = 1;
  let bitsPerSample = 16;
  let blockAlign = 2;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;
    if (chunkId === "fmt " && chunkSize >= 16) {
      channels = buffer.readUInt16LE(chunkDataOffset + 2);
      sampleRate = buffer.readUInt32LE(chunkDataOffset + 4);
      blockAlign = buffer.readUInt16LE(chunkDataOffset + 12);
      bitsPerSample = buffer.readUInt16LE(chunkDataOffset + 14);
    }
    if (chunkId === "data") {
      return {
        dataOffset: chunkDataOffset,
        dataSize: Math.min(chunkSize, buffer.length - chunkDataOffset),
        sampleRate,
        channels,
        bitsPerSample,
        blockAlign,
      };
    }
    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  throw new Error("The converted recording does not contain audio samples.");
};

const createWav = (
  pcm: Buffer,
  sampleRate: number,
  channels: number,
  bitsPerSample: number,
) => {
  const header = Buffer.alloc(44);
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
};

const detectPauseMidpoints = async (wav: Buffer) => {
  const inputPath = join(tmpdir(), `childled-pause-${randomUUID()}.wav`);
  await writeFile(inputPath, wav);
  try {
    const stderr = await new Promise<string>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-hide_banner",
        "-i",
        inputPath,
        "-af",
        `silencedetect=noise=-35dB:d=${SILENCE_SECONDS}`,
        "-f",
        "null",
        "-",
      ]);
      let output = "";
      ffmpeg.stderr.on("data", (chunk) => {
        output += String(chunk);
      });
      ffmpeg.on("error", reject);
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve(output);
        else reject(new Error(`Pause detection exited with code ${code}.`));
      });
    });

    const midpoints: number[] = [];
    let silenceStart: number | undefined;
    for (const line of stderr.split(/\r?\n/)) {
      const start = line.match(/silence_start:\s*([\d.]+)/);
      if (start) silenceStart = Number(start[1]);
      const end = line.match(/silence_end:\s*([\d.]+)/);
      if (end && silenceStart !== undefined) {
        const silenceEnd = Number(end[1]);
        midpoints.push(silenceStart + (silenceEnd - silenceStart) / 2);
        silenceStart = undefined;
      }
    }
    return midpoints;
  } finally {
    await unlink(inputPath).catch(() => {});
  }
};

export const splitAtPauses = async (
  wav: Buffer,
  providerMaxBytes = DEFAULT_PROVIDER_MAX_BYTES,
) => {
  const info = parseWav(wav);
  const durationSeconds = info.dataSize / (info.sampleRate * info.blockAlign);
  if (wav.length <= providerMaxBytes) return [wav];
  const bytesPerSecond = info.sampleRate * info.blockAlign;
  const maximumDataBytes = Math.floor(
    (providerMaxBytes - 44) / info.blockAlign,
  ) * info.blockAlign;
  if (maximumDataBytes < info.blockAlign) {
    throw new RecordingPipelineError(
      "TRANSCRIPTION_PROVIDER_LIMIT",
      "The transcription service limit is too small to process this recording.",
    );
  }
  const maximumChunkSeconds = maximumDataBytes / bytesPerSecond;
  const chunkCount = Math.ceil(durationSeconds / maximumChunkSeconds);
  if (chunkCount > MAX_TRANSCRIPTION_CHUNKS) {
    throw new RecordingPipelineError(
      "TRANSCRIPTION_PROVIDER_LIMIT",
      "This recording is too large for the transcription service. Please record a shorter session or split it into smaller recordings.",
    );
  }
  let pauseMidpoints: number[] = [];
  try {
    pauseMidpoints = await detectPauseMidpoints(wav);
  } catch {
    // A fixed boundary is safer than failing a recording because silence
    // detection is unavailable. The transcript still remains ordered.
  }
  const targetLength = Math.min(TARGET_CHUNK_SECONDS, maximumChunkSeconds);
  const boundaries = [0];
  let lastBoundary = 0;
  while (durationSeconds - lastBoundary > maximumChunkSeconds) {
    const targetBoundary = lastBoundary + targetLength;
    const maximumBoundary = lastBoundary + maximumChunkSeconds;
    const pause = pauseMidpoints.find((midpoint) =>
      midpoint >= targetBoundary &&
      midpoint <= maximumBoundary &&
      durationSeconds - midpoint >= MIN_CHUNK_SECONDS,
    );
    const nextBoundary = pause ?? maximumBoundary;
    boundaries.push(nextBoundary);
    lastBoundary = nextBoundary;
    if (boundaries.length > MAX_TRANSCRIPTION_CHUNKS) {
      throw new RecordingPipelineError(
        "TRANSCRIPTION_PROVIDER_LIMIT",
        "This recording is too large for the transcription service. Please record a shorter session or split it into smaller recordings.",
      );
    }
  }
  boundaries.push(durationSeconds);

  const pcm = wav.subarray(info.dataOffset, info.dataOffset + info.dataSize);
  const chunks: Buffer[] = [];
  let previousEndByte = 0;
  for (let index = 0; index < boundaries.length - 1; index++) {
    const endSeconds = boundaries[index + 1] ?? durationSeconds;
    const startByte = previousEndByte;
    const endByte =
      Math.min(
        pcm.length,
        startByte + maximumDataBytes,
        index === boundaries.length - 2
          ? pcm.length
          : Math.floor(endSeconds * bytesPerSecond / info.blockAlign) * info.blockAlign,
      );
    if (endByte <= startByte) continue;
    chunks.push(
      createWav(
        pcm.subarray(startByte, endByte),
        info.sampleRate,
        info.channels,
        info.bitsPerSample,
      ),
    );
    previousEndByte = endByte;
  }
  return chunks.length ? chunks : [wav];
};

const wordsFrom = (value: string) =>
  value.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];

const repeatedParts = (value: string) => {
  const words = wordsFrom(value);
  if (!words.length) return [] as { phrase: string; frequency: number }[];

  const output: { phrase: string; frequency: number }[] = [];
  let unrepeated: string[] = [];
  const flushUnrepeated = () => {
    if (unrepeated.length) {
      output.push({ phrase: unrepeated.join(" "), frequency: 1 });
      unrepeated = [];
    }
  };

  let index = 0;
  while (index < words.length) {
    let best: { length: number; count: number; covered: number } | undefined;
    const maximumLength = Math.min(10, Math.floor((words.length - index) / 2));
    for (let length = 1; length <= maximumLength; length++) {
      const pattern = words
        .slice(index, index + length)
        .map(normalizePhrase)
        .join(" ");
      let count = 1;
      while (
        index + (count + 1) * length <= words.length &&
        words
          .slice(index + count * length, index + (count + 1) * length)
          .map(normalizePhrase)
          .join(" ") === pattern
      ) {
        count++;
      }
      if (count < 2) continue;
      const covered = count * length;
      if (!best || covered > best.covered || (covered === best.covered && length < best.length)) {
        best = { length, count, covered };
      }
    }

    if (!best) {
      unrepeated.push(words[index] ?? "");
      index++;
      continue;
    }

    flushUnrepeated();
    output.push({
      phrase: words.slice(index, index + best.length).join(" "),
      frequency: best.count,
    });
    index += best.covered;
  }
  flushUnrepeated();
  return output;
};

export const segmentTranscript = (transcriptChunks: string[]) => {
  const aggregated = new Map<string, SegmentedPhrase>();

  const addPhrase = (phrase: string, frequency = 1) => {
    const normalizedPhrase = normalizePhrase(phrase);
    if (!normalizedPhrase) return;
    const existing = aggregated.get(normalizedPhrase);
    if (existing) existing.frequency += frequency;
    else {
      aggregated.set(normalizedPhrase, {
        phrase: phrase.trim(),
        normalizedPhrase,
        frequency,
      });
    }
  };

  const units = transcriptChunks.flatMap((chunk) =>
    chunk
      .split(/(?:[.!?;]+|\r?\n)+/u)
      .map((part) => part.trim())
      .filter(Boolean),
  );

  const ngramCounts = new Map<string, { phrase: string; frequency: number }>();
  for (const unit of units) {
    // repeatedParts also returns each full, non-repeated child turn as a
    // reviewable candidate. Keeping it as the single source of base counts
    // prevents an utterance from being counted twice.
    for (const part of repeatedParts(unit)) addPhrase(part.phrase, part.frequency);

    const words = wordsFrom(unit);
    const seenInTurn = new Set<string>();
    for (let length = 2; length <= Math.min(6, words.length); length++) {
      for (let start = 0; start <= words.length - length; start++) {
        const phrase = words.slice(start, start + length).join(" ");
        const key = normalizePhrase(phrase);
        // Count a phrase once per turn. A directly repeated phrase in one turn
        // is already handled by repeatedParts above.
        if (!key || seenInTurn.has(key)) continue;
        seenInTurn.add(key);
        const entry = ngramCounts.get(key);
        if (entry) entry.frequency += 1;
        else ngramCounts.set(key, { phrase, frequency: 1 });
      }
    }
  }

  // Surface phrase fragments that recur across separate child turns, such as
  // "want more" in "I want more" and "want more bubbles". This makes the
  // grouping useful when a gestalt appears with small variations.
  for (const { phrase, frequency } of ngramCounts.values()) {
    if (frequency < 2) continue;
    const normalizedPhrase = normalizePhrase(phrase);
    const existing = aggregated.get(normalizedPhrase);
    // Whole-turn and directly repeated phrase detection may already have
    // counted this exact phrase. N-grams corroborate the grouping; they do
    // not represent additional spoken occurrences.
    if (existing) existing.frequency = Math.max(existing.frequency, frequency);
    else addPhrase(phrase, frequency);
  }

  return [...aggregated.values()];
};

export type ProvisionalPhraseCandidate = SegmentedPhrase & {
  candidateKind: "potential_phrase" | "repeated_phrase" | "recurring_utterance";
};

export const provisionalPhraseCandidates = (
  rawTranscript: string,
): ProvisionalPhraseCandidate[] => {
  const safeTranscript = evidenceSafeTranscriptText(rawTranscript);
  const exactUtteranceCounts = new Map<string, number>();
  for (const utterance of safeTranscript
    .split(/(?:[.!?;]+|\r?\n)+/u)
    .map((part) => part.trim())
    .filter(Boolean)) {
    const key = normalizePhrase(utterance);
    if (key) {
      exactUtteranceCounts.set(key, (exactUtteranceCounts.get(key) ?? 0) + 1);
    }
  }
  return segmentTranscript([safeTranscript])
    .map((phrase) => ({
      ...phrase,
      candidateKind: phrase.frequency > 1
        ? (exactUtteranceCounts.get(phrase.normalizedPhrase) ?? 0) > 1
          ? "recurring_utterance" as const
          : "repeated_phrase" as const
        : "potential_phrase" as const,
    }))
    .sort((left, right) => right.frequency - left.frequency)
    .slice(0, 120);
};

const normalizeSpeakerTurns = (
  turns: Array<{
    sourceLabel: string;
    text: string;
    confidence?: SpeakerConfidence;
    confidenceScore?: number;
    intelligibility?: SpeechIntelligibility;
    transcriptionConfidenceScore?: number;
    startTimeMilliseconds?: number;
    durationMilliseconds?: number;
    profileSignature?: string;
  }>,
): SpeakerSegment[] => {
  const labelMap = new Map<string, string>();
  const nextLabel = () => `Speaker ${String.fromCharCode(65 + labelMap.size)}`;
  const segments: SpeakerSegment[] = [];

  for (const turn of turns) {
    const sourceLabel = turn.sourceLabel.replace(/\s+/g, " ").trim().toLocaleLowerCase();
    const text = turn.text.trim();
    const intelligibility = turn.intelligibility ?? intelligibilityFrom(undefined, text);
    if (!sourceLabel || (!text && intelligibility !== "unintelligible")) continue;
    const speakerLabel = labelMap.get(sourceLabel) ?? nextLabel();
    labelMap.set(sourceLabel, speakerLabel);
    segments.push({
      speakerLabel,
      text,
      position: segments.length,
      confidence: turn.confidence ?? "medium",
      intelligibility,
      ...(turn.confidenceScore === undefined ? {} : { confidenceScore: turn.confidenceScore }),
      ...(turn.transcriptionConfidenceScore === undefined
        ? {}
        : { transcriptionConfidenceScore: turn.transcriptionConfidenceScore }),
      ...(turn.startTimeMilliseconds === undefined
        ? {}
        : { startTimeMilliseconds: turn.startTimeMilliseconds }),
      ...(turn.durationMilliseconds === undefined
        ? {}
        : { durationMilliseconds: turn.durationMilliseconds }),
      ...(turn.profileSignature ? { profileSignature: turn.profileSignature } : {}),
    });
  }

  return segments;
};

export const segmentSpeakerTranscript = (transcriptChunks: string[]): SpeakerSegment[] => {
  const turns = transcriptChunks.flatMap((chunk) =>
    chunk
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        const match = line.match(/^(?:\[)?(speaker\s*[a-z0-9]+|[a-z0-9]+)(?:\])?\s*:\s*(.+)$/iu);
        return match
          ? [{
              sourceLabel: match[1]?.replace(/\s+/g, " ").trim() ?? "speaker",
              text: match[2] ?? "",
              confidence: "medium" as SpeakerConfidence,
              intelligibility: intelligibilityFrom(undefined, match[2] ?? ""),
            }]
          : [];
      }),
  );
  return normalizeSpeakerTurns(turns);
};

export const segmentSeparatedSpeakerTranscript = (transcript: string): SpeakerSegment[] => {
  const json = transcript
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "");
  try {
    const parsed = JSON.parse(json) as {
      turns?: Array<{
        speaker?: unknown;
        text?: unknown;
        confidence?: unknown;
        confidenceScore?: unknown;
        profileSignature?: unknown;
        intelligibility?: unknown;
        transcriptionConfidenceScore?: unknown;
        startTimeMilliseconds?: unknown;
        durationMilliseconds?: unknown;
      }>;
    };
    const turns = parsed.turns;
    if (
      Array.isArray(turns) &&
      turns.length > 0 &&
      turns.every(
        (turn) =>
          typeof turn.speaker === "string" &&
          typeof turn.text === "string" &&
          typeof turn.confidence === "string" &&
          speakerConfidenceValues.has(turn.confidence as SpeakerConfidence),
      )
    ) {
      return normalizeSpeakerTurns(
        turns.map((turn) => ({
          sourceLabel: turn.speaker as string,
          text: turn.text as string,
          confidence: toSpeakerConfidence(turn.confidence),
          confidenceScore: confidenceScore(turn.confidenceScore),
          intelligibility: intelligibilityFrom(turn.intelligibility, turn.text as string),
          transcriptionConfidenceScore: confidenceScore(turn.transcriptionConfidenceScore),
          startTimeMilliseconds: nonNegativeMilliseconds(turn.startTimeMilliseconds),
          durationMilliseconds: nonNegativeMilliseconds(turn.durationMilliseconds),
          profileSignature: opaqueProfileSignature(turn.profileSignature),
        })),
      );
    }
  } catch {
    // Older or partially formatted provider responses fall through to the
    // legacy labelled-turn parser below. Unlabelled text is still rejected.
  }
  const lines = transcript.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  const hasOnlyExplicitLabels = lines.length > 0 && lines.every((line) =>
    /^(?:\[)?speaker\s*[a-z0-9]+(?:\])?\s*:\s*.+$/iu.test(line),
  );
  return hasOnlyExplicitLabels ? segmentSpeakerTranscript([transcript]) : [];
};

export const childSpeechChunks = (
  segments: SpeakerSegment[],
  rolesBySpeaker: Map<string, SpeakerRole | string>,
) =>
  segments
    .filter(
      (segment) =>
        rolesBySpeaker.get(segment.speakerLabel) === "child"
        && (segment.intelligibility ?? "intelligible") === "intelligible",
    )
    .sort((left, right) => left.position - right.position)
    .map((segment) => segment.text);

export const speakerRolesForTranscript = (
  assignments: Array<{
    transcriptId: number;
    speakerLabel: string;
    role: SpeakerRole | string;
  }>,
  transcriptId: number,
) =>
  new Map(
    assignments
      .filter((assignment) => assignment.transcriptId === transcriptId)
      .map((assignment) => [assignment.speakerLabel, assignment.role]),
  );

export const buildTranscriptResult = (
  transcriptChunks: string[],
  audioDurationSeconds: number,
  segments: SpeakerSegment[] = [],
) => {
  // The raw transcript is the primary output. Speaker separation is optional
  // and arrives separately, so it can never hide or block the transcript.
  const rawTranscript = transcriptChunks.map((chunk) => chunk.trim()).filter(Boolean).join("\n");
  return {
    rawTranscript,
    segments,
    audioDurationSeconds,
    speakerCount: new Set(segments.map((segment) => segment.speakerLabel)).size,
  };
};

export const transcribeRecording = async (
  audioBuffer: Buffer,
  phrasePrompt?: string,
  providerMaxBytes = DEFAULT_PROVIDER_MAX_BYTES,
) => {
  const compatible = await ensureCompatibleFormat(audioBuffer);
  const wav =
    compatible.format === "wav"
      ? compatible.buffer
      : await convertToWav(compatible.buffer);
  const wavInfo = parseWav(wav);
  const audioDurationSeconds = Number(
    (wavInfo.dataSize / (wavInfo.sampleRate * wavInfo.blockAlign)).toFixed(1),
  );
  const audioChunks = await splitAtPauses(wav, providerMaxBytes);
  const transcriptChunks = (
    await batchProcess(
      audioChunks,
      async (chunk) =>
        (await speechToText(
          chunk,
          "wav",
          [
            "Transcribe every clearly audible word in this therapy-session recording.",
            "Preserve unclear speech with [unintelligible] or [unclear] markers instead of omitting it.",
            "Never guess missing words or infer speaker identities, roles, meanings, or phrases that are not audible.",
            phrasePrompt,
          ]
            .filter(Boolean)
            .join(" "),
        )).trim(),
      { concurrency: 1, retries: 5 },
    )
  ).filter(Boolean);
  return {
    ...buildTranscriptResult(transcriptChunks, audioDurationSeconds),
    chunkCount: audioChunks.length,
    providerMaxBytes,
  };
};

export const separateTranscriptSpeakers = async (audioBuffer: Buffer) => {
  const provider = getSpeakerDiarizationProvider();
  if (!provider) return [];
  return provider.diarize(audioBuffer);
};

export const scheduleOptionalSpeakerSeparation = (
  separate: () => Promise<SpeakerSegment[]>,
  persist: (segments: SpeakerSegment[]) => Promise<void>,
  unavailable: (error?: unknown) => void | Promise<void>,
) => {
  void separate()
    .then(async (segments) => {
      if (!segments.length) {
        await unavailable();
        return;
      }
      await persist(segments);
    })
    .catch((error) => unavailable(error));
};