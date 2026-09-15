import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const betaAccessSource = readFileSync(
  new URL("../src/components/beta-access.tsx", import.meta.url),
  "utf8",
);

test("beta approval remains visible when mobile clipboard access is unavailable", () => {
  assert.match(betaAccessSource, /navigator\.clipboard\?\.writeText/);
  assert.match(betaAccessSource, /automatic copy was blocked/);
  assert.match(
    betaAccessSource,
    /Press and hold the invitation link to copy it/,
  );
  assert.match(betaAccessSource, /role="status"/);
});

test("beta requests show delivery, review, resend, and revoke states", () => {
  assert.match(betaAccessSource, /Review required/);
  assert.match(betaAccessSource, /Invite sent/);
  assert.match(betaAccessSource, /handleRequestAction\(req\.id, 'resend'\)/);
  assert.match(
    betaAccessSource,
    /handleRequestAction\(req\.id, 'revoke-invitation'\)/,
  );
  assert.match(betaAccessSource, /processingRequest === req\.id/);
  assert.match(betaAccessSource, /Copy invitation link for/);
});
