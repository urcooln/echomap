import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  COMMUNICATION_FUNCTION_OPTIONS,
  communicationFunctionMatches,
  communicationFunctionOptionsWithStoredValues,
  communicationFunctionOtherDescription,
  communicationFunctionSelection,
  formatCommunicationFunction,
  isSupportedCommunicationFunction,
} from "../../../lib/api-zod/src/communication-functions.ts";

const existingOptions = [
  "Connection",
  "Request",
  "Requesting",
  "Protest",
  "Comment",
  "Commenting",
  "Social Interaction",
  "Self-regulation",
  "Self-Regulation",
  "Regulation",
  "Transition",
  "Shared Joy",
  "Self-Advocacy",
  "Unknown",
  "Other",
];

const requestedOptions = [
  "Commenting",
  "Help",
  "Transition",
  "Surprises",
  "Shared Joy",
  "Joint Action Routines",
  "Sensory-Motor Experiences",
  "New Situations",
  "Other",
];

test("preserves existing functions and adds each requested function once", () => {
  for (const option of [...existingOptions, ...requestedOptions]) {
    assert.ok(COMMUNICATION_FUNCTION_OPTIONS.includes(option as never), option);
  }
  assert.equal(
    new Set(COMMUNICATION_FUNCTION_OPTIONS).size,
    COMMUNICATION_FUNCTION_OPTIONS.length,
  );
});

test("stores and restores an optional Other description", () => {
  const stored = formatCommunicationFunction("Other", "Seeking reassurance");
  assert.equal(stored, "Other: Seeking reassurance");
  assert.equal(communicationFunctionSelection(stored), "Other");
  assert.equal(
    communicationFunctionOtherDescription(stored),
    "Seeking reassurance",
  );
  assert.equal(formatCommunicationFunction("Other", ""), "Other");
  assert.ok(isSupportedCommunicationFunction(stored));
  assert.ok(communicationFunctionMatches(stored, "Other"));
});

test("keeps unknown historical values available without changing them", () => {
  const options = communicationFunctionOptionsWithStoredValues([
    "Historical district label",
    "Other: A custom value",
  ]);
  assert.ok(options.includes("Historical district label"));
  assert.ok(isSupportedCommunicationFunction("Historical district label"));
  assert.equal(options.filter((option) => option === "Other").length, 1);
});

test("dictionary and recording controls consume the shared option list", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const sharedUses = appSource.match(
    /options=\{COMMUNICATION_FUNCTION_OPTIONS\}/g,
  );
  assert.ok((sharedUses?.length ?? 0) >= 6);
  assert.match(appSource, /input-gestalt-other-function/);
  assert.match(appSource, /input-clinician-phrase-other-function/);
  assert.match(appSource, /select-edit-gestalt-function/);
  assert.match(appSource, /input-edit-gestalt-other-function/);
  assert.match(appSource, /useUpdateGestalt/);
  assert.match(appSource, /communicationFunctionMatches/);
});
