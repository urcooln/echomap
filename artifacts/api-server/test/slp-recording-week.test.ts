import assert from "node:assert/strict";
import test from "node:test";
import {
  recordingWeekFor,
  remainingRecordingMilliseconds,
} from "../src/lib/slp-recording-week";

test("Monday midnight in New York resets the recording week, including DST", () => {
  const before = recordingWeekFor(new Date("2026-09-21T03:59:59Z"));
  assert.equal(before.periodStart, "2026-09-14");
  assert.equal(before.periodEnd.toISOString(), "2026-09-21T04:00:00.000Z");
  const after = recordingWeekFor(new Date("2026-09-21T04:00:00Z"));
  assert.equal(after.periodStart, "2026-09-21");
  assert.equal(after.periodEnd.toISOString(), "2026-09-28T04:00:00.000Z");

  const dst = recordingWeekFor(new Date("2026-11-01T12:00:00Z"));
  assert.equal(dst.periodStart, "2026-10-26");
  assert.equal(dst.periodEnd.toISOString(), "2026-11-02T05:00:00.000Z");
});

test("remaining time is based on actual milliseconds", () => {
  assert.equal(remainingRecordingMilliseconds(0), 3_600_000);
  assert.equal(remainingRecordingMilliseconds(1_350_000), 2_250_000);
  assert.equal(remainingRecordingMilliseconds(3_600_100), 0);
});
