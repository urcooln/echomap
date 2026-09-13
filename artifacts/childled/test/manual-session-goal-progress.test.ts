import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { validateManualSessionGoalProgress } from "../../../lib/api-zod/src/manual-session-goal-progress.ts";

const progress = (
  successfulAttempts: string,
  totalAttempts: string,
  accuracyPercent = "",
) =>
  validateManualSessionGoalProgress({
    successfulAttempts,
    totalAttempts,
    accuracyPercent,
    promptingLevel: null,
    progressNote: "",
  });

test("derives accuracy from valid whole-number attempts", () => {
  const eightOfTen = progress("8", "10");
  assert.equal(eightOfTen.valid, true);
  assert.equal(eightOfTen.values.accuracyPercent, 80);

  const zeroOfTen = progress("0", "10");
  assert.equal(zeroOfTen.valid, true);
  assert.equal(zeroOfTen.values.accuracyPercent, 0);
});

test("attempts remain the source of truth when manual accuracy differs", () => {
  const result = progress("7", "10", "80");
  assert.equal(result.valid, true);
  assert.equal(result.values.accuracyPercent, 70);
});

test("rejects attempts greater than total opportunities", () => {
  const result = progress("8", "7");
  assert.equal(result.valid, false);
  assert.equal(
    result.errors.successfulAttempts,
    "Successful attempts cannot be greater than total opportunities.",
  );
});

test("requires both attempt fields and a meaningful nonzero total", () => {
  assert.equal(
    progress("8", "").errors.totalAttempts,
    "Enter the total number of opportunities.",
  );
  assert.equal(
    progress("", "10").errors.successfulAttempts,
    "Enter the number of successful attempts.",
  );
  assert.equal(
    progress("0", "0").errors.totalAttempts,
    "Total opportunities must be greater than zero when tracking attempts.",
  );
});

test("rejects decimal and negative attempt values", () => {
  assert.equal(
    progress("7.5", "10").errors.successfulAttempts,
    "Successful attempts must be a whole number.",
  );
  assert.equal(
    progress("7", "-10").errors.totalAttempts,
    "Total opportunities cannot be negative.",
  );
});

test("accepts standalone accuracy and rejects empty progress", () => {
  const accuracy = progress("", "", "85");
  assert.equal(accuracy.valid, true);
  assert.equal(accuracy.values.accuracyPercent, 85);

  const empty = progress("", "");
  assert.equal(empty.valid, false);
  assert.equal(
    empty.errors.progressNote,
    "Add at least one progress measure: accuracy, attempt data, prompting/support, or a progress note.",
  );
});

test("manual goal fields distinguish guidance from entered clinical data", async () => {
  const source = await readFile(
    new URL("../src/pages/manual-session.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /placeholder="(?:80|7|10)"/);
  assert.match(source, /placeholder="Enter successful attempts"/);
  assert.match(source, /placeholder="Enter total opportunities"/);
  assert.match(source, /Select prompting level/);
  assert.match(source, /<option value="na"/);
});
