import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const betaAccessSource = readFileSync(
  new URL("../src/components/beta-access.tsx", import.meta.url),
  "utf8",
);
const appSource = readFileSync(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);

test("beta agreement requires an explicit checkbox before continuing", () => {
  assert.match(betaAccessSource, /I have read and agree to the ChildLed Beta/);
  assert.match(
    betaAccessSource,
    /disabled=\{!accepted \|\| submitting\}/,
  );
  assert.match(betaAccessSource, /JSON\.stringify\(\{ accepted: true \}\)/);
  assert.match(betaAccessSource, />\s*Sign out\s*</);
});

test("all roles, including development demo sessions, pass through the beta gate", () => {
  assert.doesNotMatch(
    appSource,
    /if \(!developmentSession\) \{\s*const noticeRes = await fetch\("\/api\/beta-notice"/,
  );
  assert.match(appSource, /onSignOut=\{signOutFromBetaAgreement\}/);
  assert.match(
    appSource,
    /onAcknowledge=\{\(\) => setRetryAttempt\(\(attempt\) => attempt \+ 1\)\}/,
  );
});
