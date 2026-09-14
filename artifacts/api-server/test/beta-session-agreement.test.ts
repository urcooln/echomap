import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  BETA_CONFIDENTIALITY_AGREEMENT_TYPE,
  BETA_CONFIDENTIALITY_FALLBACK_VERSION,
  betaLoginSessionHash,
} from "../src/lib/beta-session-agreement";

test("login session identifiers are stored as stable one-way hashes", () => {
  const sessionId = "sess_2ypYSS8qtw5C0YmLRVmhO0zH9wG";
  const hash = betaLoginSessionHash(sessionId);

  assert.equal(hash, betaLoginSessionHash(sessionId));
  assert.notEqual(hash, sessionId);
  assert.equal(hash.length, 64);
  assert.notEqual(hash, betaLoginSessionHash("sess_different"));
});

test("the beta agreement has an explicit type and initial version", () => {
  assert.equal(BETA_CONFIDENTIALITY_AGREEMENT_TYPE, "beta_confidentiality");
  assert.equal(BETA_CONFIDENTIALITY_FALLBACK_VERSION, "1.0");
});

test("the acknowledgement endpoint records the required audit fields", () => {
  const source = readFileSync(
    path.resolve(
      process.cwd(),
      "artifacts/api-server/src/routes/childled.ts",
    ),
    "utf8",
  );
  for (const field of [
    "organizationId: actor.organizationId",
    "userId: actor.userId",
    "clerkUserId: actor.clerkUserId",
    "role: actor.role",
    "agreementType: BETA_CONFIDENTIALITY_AGREEMENT_TYPE",
    "loginSessionHash: betaLoginSessionHash(actor.loginSessionId)",
  ]) {
    assert.ok(source.includes(field), `missing audit field: ${field}`);
  }
});
