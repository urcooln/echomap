import assert from "node:assert/strict";
import test from "node:test";
import {
  CHILD_PROFILE_CONSENT_STATEMENT,
  CHILD_PROFILE_CONSENT_STATEMENT_VERSION,
  buildChildProfileConsentRecord,
  hasLegalAuthorityConsent,
} from "../src/lib/child-profile-consent";
import {
  childSpeakerProfilesTable,
  childSpeakerRoleLearningAggregatesTable,
  childSpeakerRolesTable,
  sessionTranscriptsTable,
} from "@workspace/db/schema";
import { deleteTranscriptDataForChild } from "../src/lib/transcript-deletion";

test("rejects missing or false legal-authority confirmation", () => {
  assert.equal(hasLegalAuthorityConsent({}), false);
  assert.equal(hasLegalAuthorityConsent({ legalAuthorityConfirmed: false }), false);
  assert.equal(hasLegalAuthorityConsent({ legalAuthorityConfirmed: true }), true);
});

test("builds a timestamped consent audit record from server-owned identity", () => {
  const record = buildChildProfileConsentRecord({
    childId: 42,
    userId: "care-team-user-12",
    confirmedBy: "Avery Rivera",
  });

  assert.equal(record.childId, 42);
  assert.equal(record.userId, "care-team-user-12");
  assert.equal(record.confirmedBy, "Avery Rivera");
  assert.equal(record.statementVersion, CHILD_PROFILE_CONSENT_STATEMENT_VERSION);
  assert.equal(record.statement, CHILD_PROFILE_CONSENT_STATEMENT);
  assert.ok(record.confirmedAt instanceof Date);
});

test("keeps consent records tied to their child-profile identifier", () => {
  const first = buildChildProfileConsentRecord({ childId: 12, userId: "user-a", confirmedBy: "User A" });
  const second = buildChildProfileConsentRecord({ childId: 13, userId: "user-a", confirmedBy: "User A" });

  assert.notEqual(first.childId, second.childId);
});

test("deleting transcripts also deletes legacy child-scoped speaker roles", async () => {
  const deletedTables: unknown[] = [];
  const transaction = {
    delete(table: unknown) {
      deletedTables.push(table);
      return { where: async () => undefined };
    },
  };

  await deleteTranscriptDataForChild(transaction, 42);

  assert.deepEqual(deletedTables, [
    sessionTranscriptsTable,
    childSpeakerRolesTable,
    childSpeakerProfilesTable,
    childSpeakerRoleLearningAggregatesTable,
  ]);
});