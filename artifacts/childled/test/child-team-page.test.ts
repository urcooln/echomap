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
  assert.doesNotMatch(pageSource, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(pageSource, /Copy invite link/);
  assert.match(pageSource, /Clerk emailed this invitation automatically/);
  assert.match(pageSource, /useReplaceCareTeamInvitation/);
  assert.match(pageSource, /Resend invitation/);
  assert.match(pageSource, /button-confirm-replace-team-invitation/);
  assert.match(pageSource, /getListCareTeamInvitationsQueryKey/);
  assert.match(pageSource, /previous\s+link no longer/);
  assert.doesNotMatch(invitationFormSource, /useLookupExistingTeacher/);
  assert.doesNotMatch(invitationFormSource, /useAssignExistingTeacher/);
  assert.match(invitationFormSource, /result\.outcome === "connected"/);
  assert.match(
    invitationFormSource,
    /receive the Clerk invitation automatically/,
  );
  assert.match(invitationFormSource, /Add to care team/);
});
