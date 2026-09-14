import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Parent and Teacher invitees complete identity setup before their portal", async () => {
  const [appSource, pageSource] = await Promise.all([
    readFile(new URL("../src/App.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/pages/care-team-onboarding.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(
    appSource,
    /viewerData\.role === "Parent" \|\| viewerData\.role === "Teacher"/,
  );
  assert.match(appSource, /"\/care-team-onboarding"/);
  assert.match(appSource, /<CareTeamOnboardingPage/);
  assert.match(pageSource, /useGetCareTeamOnboarding/);
  assert.match(pageSource, /useCompleteCareTeamOnboarding/);
  assert.match(pageSource, /firstName: firstName\.trim\(\)/);
  assert.match(pageSource, /lastName: lastName\.trim\(\)/);
  assert.match(
    pageSource,
    /Completing setup does not add access to any other students/,
  );
});
