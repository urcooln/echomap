import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { probeRecordingDurationMilliseconds } from "../src/lib/recording-duration";

const execFileAsync = promisify(execFile);

test("verifies duration from audio rather than client metadata", async () => {
  const { stdout } = await execFileAsync(
    "ffmpeg",
    [
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2.25",
      "-c:a",
      "libopus",
      "-f",
      "webm",
      "pipe:1",
    ],
    { encoding: "buffer", maxBuffer: 256 * 1024 },
  );
  const duration = await probeRecordingDurationMilliseconds(
    stdout,
    "audio/webm",
  );
  assert.ok(
    duration >= 2_200 && duration <= 2_350,
    `duration was ${duration}ms`,
  );
});

test("rejects bytes without an audio stream", async () => {
  await assert.rejects(
    probeRecordingDurationMilliseconds(Buffer.from("not audio"), "audio/webm"),
  );
});
