import assert from "node:assert/strict";
import test from "node:test";
import { hasValidDevelopmentAccessKey } from "../src/lib/development-login-access";

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
