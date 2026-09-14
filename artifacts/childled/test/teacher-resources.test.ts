import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Teacher Resources opens without requiring a preselected student", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const routeSetStart = appSource.indexOf("const teacherChildRoutes");
  const routeSetEnd = appSource.indexOf("]);", routeSetStart);
  const teacherChildRoutes = appSource.slice(routeSetStart, routeSetEnd);

  assert.doesNotMatch(teacherChildRoutes, /teacher-resources/);
  assert.match(appSource, /<TeacherResourcesPage/);
  assert.match(appSource, /children=\{children\}/);
  assert.match(appSource, /onSelectChild=\{selectChild\}/);
});

test("Teacher Resources provides handbook and assigned-student support actions", async () => {
  const pageSource = await readFile(
    new URL("../src/pages/teacher-resources.tsx", import.meta.url),
    "utf8",
  );

  assert.match(pageSource, /data-testid="page-teacher-resources"/);
  assert.match(
    pageSource,
    /Classroom Companion &amp; Educator Reference Guide/,
  );
  assert.match(pageSource, /> View PDF/);
  assert.match(pageSource, /Download handbook/);
  assert.match(pageSource, /Supporting student/);
  assert.match(pageSource, /View Communication Passport/);
  assert.match(pageSource, /children\.map\(\(child\)/);
});
