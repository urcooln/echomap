import assert from "node:assert/strict";
import test from "node:test";
import {
  clearDevelopmentLoginFailures,
  developmentLoginRetryAfterSeconds,
  hasValidDevelopmentAccessKey,
  recordDevelopmentLoginFailure,
} from "../src/lib/development-login-access";
import { canAttachDevelopmentDemoActor } from "../src/lib/development-demo-actor";

test("accepts only the configured development access key", () => {
  assert.equal(
    hasValidDevelopmentAccessKey("owner-secret", "owner-secret"),
    true,
  );
  assert.equal(
    hasValidDevelopmentAccessKey("owner-secret", "wrong-secret"),
    false,
  );
  assert.equal(hasValidDevelopmentAccessKey("owner-secret", undefined), false);
  assert.equal(hasValidDevelopmentAccessKey(undefined, "owner-secret"), false);
});

test("temporarily throttles repeated failed development logins", () => {
  const clientId = "test-client";
  const now = 1_000_000;
  clearDevelopmentLoginFailures(clientId);

  for (let attempt = 0; attempt < 9; attempt += 1) {
    recordDevelopmentLoginFailure(clientId, now);
  }
  assert.equal(developmentLoginRetryAfterSeconds(clientId, now), 0);

  recordDevelopmentLoginFailure(clientId, now);
  assert.equal(developmentLoginRetryAfterSeconds(clientId, now), 900);
  assert.equal(
    developmentLoginRetryAfterSeconds(clientId, now + 15 * 60 * 1000),
    0,
  );
});

test("a successful development login clears failed attempts", () => {
  const clientId = "successful-test-client";
  const now = 2_000_000;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    recordDevelopmentLoginFailure(clientId, now);
  }
  assert.ok(developmentLoginRetryAfterSeconds(clientId, now) > 0);

  clearDevelopmentLoginFailures(clientId);
  assert.equal(developmentLoginRetryAfterSeconds(clientId, now), 0);
});

test("a Clerk-authenticated browser never falls back to the development actor", () => {
  const serverIssuedSessionId = "52e74fe8-80ef-48f0-86c1-b397f2c23402";
  assert.equal(
    canAttachDevelopmentDemoActor({
      demoEnabled: true,
      hasChildledActor: false,
      clerkUserId: "user_clerk",
      demoCookie: serverIssuedSessionId,
    }),
    false,
  );
  assert.equal(
    canAttachDevelopmentDemoActor({
      demoEnabled: true,
      hasChildledActor: false,
      clerkUserId: null,
      demoCookie: serverIssuedSessionId,
    }),
    true,
  );
});

test("the development actor requires a server-issued UUID session cookie", () => {
  for (const demoCookie of [undefined, false, "active", "attacker-value"]) {
    assert.equal(
      canAttachDevelopmentDemoActor({
        demoEnabled: true,
        hasChildledActor: false,
        clerkUserId: null,
        demoCookie,
      }),
      false,
    );
  }
});
