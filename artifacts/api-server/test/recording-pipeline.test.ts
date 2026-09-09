import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeUploadedRecording,
  normalizeRecordingContentType,
  normalizeRecordingUploadContentType,
  safeTranscriptionFailure,
  successfulEmptyTranscript,
  TRANSCRIPTION_MODEL,
  TRANSCRIPTION_PROVIDER,
} from "../src/lib/recording-pipeline";

test("rejects an empty browser recording before it can be stored", () => {
  assert.throws(
    () => decodeUploadedRecording(""),
    (error: any) => error.code === "EMPTY_RECORDING",
  );
});

test("rejects malformed recording data instead of silently decoding it", () => {
  assert.throws(
    () => decodeUploadedRecording("not valid base64!"),
    (error: any) => error.code === "INVALID_RECORDING_DATA",
  );
});

test("accepts the exact FileReader data URL representation used by audio uploads", () => {
  const recording = decodeUploadedRecording(
    "data:audio/wav;base64,AAECAw==",
    "audio/wav",
  );

  assert.deepEqual([...recording], [0, 1, 2, 3]);
});

test("accepts MediaRecorder WebM and OGG data URLs with codec parameters", () => {
  const webm = decodeUploadedRecording(
    "data:audio/webm;codecs=opus;base64,AAECAw==",
    "audio/webm",
  );
  const ogg = decodeUploadedRecording(
    "data:audio/ogg;codecs=opus;base64,BAUGBw==",
    "audio/ogg",
  );

  assert.deepEqual([...webm], [0, 1, 2, 3]);
  assert.deepEqual([...ogg], [4, 5, 6, 7]);
});

test("normalizes browser-reported video WebM to the supported audio storage type", () => {
  const recording = decodeUploadedRecording(
    "data:video/webm;codecs=opus;base64,AAECAw==",
    "video/webm",
  );

  assert.deepEqual([...recording], [0, 1, 2, 3]);
  assert.equal(normalizeRecordingContentType("video/webm;codecs=opus"), "audio/webm");
  assert.equal(normalizeRecordingContentType("video/mp4"), null);
  assert.equal(normalizeRecordingUploadContentType("video/webm;codecs=opus"), "video/webm");
  assert.equal(normalizeRecordingUploadContentType("video/mp4"), "video/mp4");
});

test("rejects a data URL whose audio type differs from the declared upload type", () => {
  assert.throws(
    () => decodeUploadedRecording("data:audio/webm;base64,AAE=", "audio/wav"),
    (error: any) => error.code === "INVALID_RECORDING_DATA",
  );
});

test("returns safe diagnostic guidance for a conversion failure", () => {
  const failure = safeTranscriptionFailure(new Error("ffmpeg exited with code 1"));

  assert.equal(failure.code, "AUDIO_FORMAT_UNREADABLE");
  assert.match(failure.message, /could not be prepared/i);
});

test("reports a missing audio converter as a service failure", () => {
  const failure = safeTranscriptionFailure(new Error("spawn ffmpeg ENOENT"));

  assert.equal(failure.code, "AUDIO_PREPARATION_FAILED");
  assert.match(failure.message, /temporarily unavailable/i);
});

test("only treats a completed empty provider response as no detected speech", () => {
  assert.equal(successfulEmptyTranscript("complete", " \n "), true);
  assert.equal(successfulEmptyTranscript("failed", ""), false);
  assert.equal(successfulEmptyTranscript("processing", ""), false);
  assert.equal(successfulEmptyTranscript("complete", "Speaker A: Blast off!"), false);
});

test("publishes the provider and model used by the session pipeline", () => {
  assert.equal(TRANSCRIPTION_PROVIDER, "Replit OpenAI integration");
  assert.equal(TRANSCRIPTION_MODEL, "gpt-4o-mini-transcribe");
});
