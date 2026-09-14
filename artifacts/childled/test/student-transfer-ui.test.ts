import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("SLPs can start and manage a confirmed student transfer from caseload and Team", async () => {
  const source = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const dialogStart = source.indexOf("function StudentTransferDialog(");
  const dialogEnd = source.indexOf(
    "\nfunction StudentTransferLookupCard",
    dialogStart,
  );
  const dialog = source.slice(dialogStart, dialogEnd);

  assert.notEqual(dialogStart, -1);
  assert.notEqual(dialogEnd, -1);
  assert.match(source, /button-transfer-student-/);
  assert.match(source, /button-child-team-transfer/);
  assert.match(dialog, /useLookupStudentTransferSlp/);
  assert.match(dialog, /useCreateStudentTransfer/);
  assert.match(dialog, /useListStudentTransfers/);
  assert.match(dialog, /useCancelStudentTransfer/);
  assert.match(dialog, /Enter the new SLP's exact email address/);
  assert.match(dialog, /Your active access will be removed/);
  assert.match(dialog, /You keep access until/);
  assert.match(dialog, /Copy invitation link/);
  assert.match(dialog, /Cancel transfer/);
  assert.match(dialog, /Transfer history/);
});
