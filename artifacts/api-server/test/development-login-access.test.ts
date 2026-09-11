import assert from "node:assert/strict";
import test from "node:test";
import {
  clearDevelopmentLoginFailures,
  developmentLoginRetryAfterSeconds,
  hasValidDevelopmentAccessKey,
  recordDevelopmentLoginFailure,
} from "../src/lib/development-login-access";

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
