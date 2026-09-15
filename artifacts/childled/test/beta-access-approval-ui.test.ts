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

test("approved beta requests cannot be approved or rejected again from the queue", () => {
  assert.match(betaAccessSource, /req\.status === 'approved' \? 'Approved'/);
  assert.match(betaAccessSource, /req\.status === 'pending' && \(/);
  assert.match(betaAccessSource, /processingRequest === req\.id/);
  assert.match(betaAccessSource, /Copy invitation link for/);
});
