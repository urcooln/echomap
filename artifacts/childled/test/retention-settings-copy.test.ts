import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("admin retention settings distinguish enforced cleanup from planning targets", () => {
  const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(source, /Full recordings are deleted after finalization/);
  assert.match(source, /Session note retention target \(days\)/);
  assert.match(source, /Session notes are not automatically\s+deleted/);
  assert.match(source, /Archived storage retention target \(days\)/);
  assert.match(source, /Archived storage is not automatically\s+deleted/);
});
