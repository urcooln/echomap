import assert from "node:assert/strict";
import test from "node:test";
import {
  createInvitationToken,
  hashInvitationToken,
  invitationTokenMatchesHash,
} from "../src/lib/invitation-security";

test("invitation token hashes are deterministic but token generation is opaque", () => {
  const token = createInvitationToken();
  assert.match(token, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(hashInvitationToken(token), hashInvitationToken(token));
  assert.notEqual(token, hashInvitationToken(token));
});

test("invitation token verification rejects a mismatched or malformed digest", () => {
  const token = "opaque-test-token";
  assert.equal(invitationTokenMatchesHash(token, hashInvitationToken(token)), true);
  assert.equal(invitationTokenMatchesHash("other-token", hashInvitationToken(token)), false);
  assert.equal(invitationTokenMatchesHash(token, "not-a-digest"), false);
});