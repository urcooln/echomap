import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the child Team tab shows memberships and child-scoped invitations", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const navigationStart = appSource.indexOf("const childNavItems");
  const navigationEnd = appSource.indexOf("const activePath", navigationStart);
  const navigationSource = appSource.slice(navigationStart, navigationEnd);
  const pageStart = appSource.indexOf("function ChildTeamPage(");
  const pageEnd = appSource.indexOf("\nfunction ClinicalDisclaimer", pageStart);
  const pageSource = appSource.slice(pageStart, pageEnd);
  const invitationFormStart = appSource.indexOf(
    "function CareTeamInvitationForm(",
  );
  const invitationFormEnd = appSource.indexOf(
    "\nfunction HistoricalSessionDetail",
    invitationFormStart,
  );
  const invitationFormSource = appSource.slice(
    invitationFormStart,
    invitationFormEnd,
  );

  assert.doesNotMatch(
    navigationSource,
    /label: "Team",[\s\S]*?team-communication/,
  );
  assert.match(
    navigationSource,
    /label: "Team",[\s\S]*?childProfileHref\("team"\)/,
  );
  assert.match(pageSource, /useGetSettings\(\)/);
  assert.match(pageSource, /useListCareTeamInvitations/);
  assert.match(pageSource, /invitation\.childId === child\.id/);
  assert.match(pageSource, /student\?\.careTeam \?\? \[\]/);
  assert.match(pageSource, /onClick=\{onInvite\}/);
  assert.match(pageSource, /invitation\.invitationPath/);
  assert.match(pageSource, /navigator\.clipboard\.writeText/);
  assert.match(pageSource, /Copy invite link/);
  assert.match(pageSource, /useReplaceCareTeamInvitation/);
  assert.match(pageSource, /Get a new link/);
  assert.match(pageSource, /button-confirm-replace-team-invitation/);
  assert.match(pageSource, /getListCareTeamInvitationsQueryKey/);
  assert.match(pageSource, /The previous link no longer/);
  assert.match(invitationFormSource, /useLookupExistingTeacher/);
  assert.match(invitationFormSource, /useAssignExistingTeacher/);
  assert.match(invitationFormSource, /Existing ChildLed Teacher found/);
  assert.match(invitationFormSource, /Add to Student/);
  assert.match(invitationFormSource, /already has access/);
  assert.match(invitationFormSource, /Different ChildLed account type/);
});
