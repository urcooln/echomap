import assert from "node:assert/strict";
import test from "node:test";
import { goalSourceIsRelevant } from "../src/lib/goal-connection-matcher";

test("goal connection matching requires conservative lexical relevance", () => {
  const goal = {
    title: "Request help during transitions",
    goalArea: "Self advocacy",
    description: "Notice language used to request help during classroom transitions.",
  };
  assert.equal(goalSourceIsRelevant(goal, {
    label: "Reviewed Child utterance",
    detail: "“help please” · meaning: request help · context: classroom transition",
  }), true);
  assert.equal(goalSourceIsRelevant(goal, {
    label: "Teacher observation",
    detail: "Student enjoyed painting at recess.",
  }), false);
  assert.equal(goalSourceIsRelevant(goal, {
    label: "AAC profile",
    detail: "Communication support device",
  }), false);
});