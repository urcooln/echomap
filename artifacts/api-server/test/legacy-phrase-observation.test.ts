import assert from "node:assert/strict";
import test from "node:test";
import {
  legacyNoteHasTypedObservation,
  parseLegacyPhraseObservationNote,
} from "../src/lib/legacy-phrase-observation";

const note = {
  id: 41,
  gestaltId: 9,
  authorUserId: "parent-1",
  body: "Parent phrase observation · Home · 8/20/2026\nUsed while asking for help.",
  createdAt: new Date("2026-08-20T15:00:00.000Z"),
};

test("parses only preserved phrase-observation notes", () => {
  assert.deepEqual(parseLegacyPhraseObservationNote(note), {
    authorRole: "Parent",
    context: "Home",
    observedAt: new Date("2026-08-20T00:00:00.000Z"),
  });
  assert.equal(parseLegacyPhraseObservationNote({
    body: "General care-team discussion",
    createdAt: note.createdAt,
  }), null);
});

test("excludes historical notes already represented by typed evidence", () => {
  assert.equal(legacyNoteHasTypedObservation(note, [{
    gestaltId: 9,
    sourceNoteId: null,
    authorUserId: "parent-1",
    context: " home ",
    observedAt: new Date("2026-08-20T18:30:00.000Z"),
  }]), true);
});

test("uses an explicit source-note link as the strongest idempotency signal", () => {
  assert.equal(legacyNoteHasTypedObservation(note, [{
    gestaltId: 77,
    sourceNoteId: 41,
    authorUserId: "someone-else",
    context: "School",
    observedAt: new Date("2026-08-22T00:00:00.000Z"),
  }]), true);
});

test("does not collapse distinct contexts, dates, or contributors", () => {
  assert.equal(legacyNoteHasTypedObservation(note, [{
    gestaltId: 9,
    sourceNoteId: null,
    authorUserId: "teacher-2",
    context: "School",
    observedAt: new Date("2026-08-21T00:00:00.000Z"),
  }]), false);
});