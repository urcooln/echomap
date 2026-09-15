import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("student creation can issue child-scoped Parent and Teacher invitations", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const formStart = appSource.indexOf("function ChildForm(");
  const formEnd = appSource.indexOf("\nfunction Field(", formStart);
  const formSource = appSource.slice(formStart, formEnd);

  assert.notEqual(formStart, -1);
  assert.notEqual(formEnd, -1);
  assert.match(formSource, /useCreateCareTeamInvitation\(\)/);
  assert.match(formSource, /childId: child\.id/);
  assert.match(formSource, /addInvite\("Parent"\)/);
  assert.match(formSource, /addInvite\("Teacher"\)/);
  assert.match(formSource, /retryInvitation/);
  assert.doesNotMatch(formSource, /teacherLookupMutation\.mutateAsync/);
  assert.doesNotMatch(formSource, /teacherAssignmentMutation\.mutateAsync/);
  assert.match(formSource, /result\.result\?\.outcome === "connected"/);
  assert.match(formSource, /Existing accounts were connected automatically/);
  assert.match(formSource, /Clerk emailed invitations/);
  assert.doesNotMatch(formSource, /Copy link/);
  assert.ok(
    formSource.indexOf("await mutation.mutateAsync") <
      formSource.indexOf("results.push(await sendInvitation"),
  );
});
