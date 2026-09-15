import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("custom frequency details are optional across the form and API", async () => {
  const [formSource, routeSource, schemaSource] = await Promise.all([
    readFile(
      new URL(
        "../src/components/service-requirement-form.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../../api-server/src/routes/childled.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../../lib/db/src/schema/core-domain.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(formSource, /Custom frequency details \(Optional\)/);
  assert.match(formSource, /customFrequencyDescription\.trim\(\) \|\| null/);
  assert.doesNotMatch(
    formSource,
    /period === "custom" && !customFrequencyDescription\.trim\(\)/,
  );
  assert.doesNotMatch(
    routeSource,
    /Describe how the custom service frequency is scheduled/,
  );
  assert.match(
    routeSource,
    /body\.data\.customFrequencyDescription\?\.trim\(\) \|\| null/,
  );
  assert.match(
    schemaSource,
    /customFrequencyDescription: text\("custom_frequency_description"\),/,
  );
});
