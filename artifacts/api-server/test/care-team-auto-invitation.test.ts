import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("care-team invitations use Clerk email delivery and trusted server context", async () => {
  const [invitationSource, routeSource, provisioningSource] = await Promise.all(
    [
      readFile(
        new URL("../src/lib/clerk-invitations.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../src/routes/childled.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../src/lib/clerk-invitation-provisioning.ts", import.meta.url),
        "utf8",
      ),
    ],
  );
  const routeStart = routeSource.indexOf(
    'router.post("/care-team-invitations",',
  );
  const routeEnd = routeSource.indexOf(
    'router.post(\n  "/care-team-invitations/:invitationId/replace"',
    routeStart,
  );
  const createRoute = routeSource.slice(routeStart, routeEnd);

  assert.notEqual(routeStart, -1);
  assert.notEqual(routeEnd, -1);
  assert.match(invitationSource, /notify: true/);
  assert.match(invitationSource, /runtimeConfig\.publicAppOrigin/);
  assert.match(invitationSource, /childledInvitationId/);
  assert.match(invitationSource, /childledInvitationRole/);
  assert.match(createRoute, /resolveExistingCareTeamAccount/);
  assert.match(createRoute, /assignExistingCareTeamAccount/);
  assert.match(createRoute, /outcome: "connected"/);
  assert.match(createRoute, /outcome: "invited"/);
  assert.match(createRoute, /ignoreExisting: false/);
  assert.match(createRoute, /Invitation sent to/);
  assert.match(provisioningSource, /acceptedInvitationChildScope/);
  assert.match(provisioningSource, /role\.membershipRole/);
  assert.match(provisioningSource, /childCareTeamMembershipsTable/);
  assert.match(provisioningSource, /existingMemberships\.some/);
  assert.match(
    provisioningSource,
    /membership\.role\.trim\(\)\.toLowerCase\(\) !== role\.membershipRole/,
  );
});
