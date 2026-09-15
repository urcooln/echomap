import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("communication goal descriptions are optional on create and edit", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const panelStart = appSource.indexOf("function CommunicationGoalsPanel(");
  const panelEnd = appSource.indexOf("\nfunction ClinicianChildProfilePage(", panelStart);
  const panelSource = appSource.slice(panelStart, panelEnd);

  assert.match(panelSource, /Description \(Optional\)/);
  assert.doesNotMatch(panelSource, /!form\.description\.trim\(\)/);
  assert.match(panelSource, /description: form\.description\.trim\(\) \|\| undefined/);
  assert.match(panelSource, /description: form\.description\.trim\(\),/);
  assert.match(panelSource, /goal\.description \? \(/);
});
