import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("offers specific group sizes while retaining legacy service labels", async () => {
  const source = await readFile(
    new URL("../src/components/service-requirement-form.tsx", import.meta.url),
    "utf8",
  );
  const optionsStart = source.indexOf("const selectableServiceTypes");
  const optionsEnd = source.indexOf("] satisfies", optionsStart);
  const optionsSource = source.slice(optionsStart, optionsEnd);

  for (const size of [2, 3, 4, 5]) {
    assert.match(optionsSource, new RegExp(`group_not_to_exceed_${size}`));
    assert.match(source, new RegExp(`Group \\(not to exceed ${size}\\)`));
  }

  assert.doesNotMatch(optionsSource, /"group"/);
  assert.match(source, /group: "Group"/);
  assert.match(source, /legacyServiceTypeOption\(requirement\)/);
  assert.match(optionsSource, /"individual"/);
  assert.match(optionsSource, /"co_treat_ot"/);
  assert.match(optionsSource, /"co_treat_pt"/);
  assert.match(optionsSource, /"integrated_group"/);
  assert.match(optionsSource, /"consult"/);
  assert.match(optionsSource, /"assistive_technology"/);
});
