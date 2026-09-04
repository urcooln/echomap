import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCalibrationProbeFailure,
  needsWebmDurationConversion,
} from "../src/lib/calibration-diagnostics";

test("classifies a missing staged private object without exposing its storage path", () => {
  const failure = classifyCalibrationProbeFailure(Object.assign(
    new Error("Object private/clinical/child/123 was not found"),
    { code: 404 },
  ));

  assert.equal(failure.code, "CALIBRATION_OBJECT_UNAVAILABLE");
  assert.equal(failure.message, "The uploaded calibration object was not available for server-side inspection.");
  assert.doesNotMatch(failure.message, /private\/clinical|child\/123/);
});

test("classifies a duration probe timeout as a retryable server verification failure", () => {
  const failure = classifyCalibrationProbeFailure(Object.assign(
    new Error("Command timed out after 15000ms"),
    { killed: true, signal: "SIGTERM" },
  ));

  assert.equal(failure.code, "CALIBRATION_DURATION_PROBE_TIMEOUT");
  assert.match(failure.message, /too long to inspect/i);
});

test("classifies unreadable WebM probe output without returning raw ffprobe output", () => {
  const failure = classifyCalibrationProbeFailure(Object.assign(
    new Error("ffprobe exited with code 1"),
    { stderr: "Invalid data found when processing input /tmp/private-recording.webm" },
  ));

  assert.equal(failure.code, "CALIBRATION_MEDIA_UNREADABLE");
  assert.equal(failure.message, "The uploaded audio format could not be read for duration verification.");
  assert.doesNotMatch(failure.message, /private-recording/);
});

test("uses WAV duration verification only for readable WebM recordings missing container duration metadata", () => {
  assert.equal(needsWebmDurationConversion("audio/webm", "matroska,webm", null), true);
  assert.equal(needsWebmDurationConversion("audio/webm", "matroska,webm", 7.45), false);
  assert.equal(needsWebmDurationConversion("audio/wav", "wav", null), false);
});