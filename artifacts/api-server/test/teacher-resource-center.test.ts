import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  TEACHER_RESOURCE_PDF,
  TEACHER_RESOURCE_VERSION,
  teacherResourceDefinitions,
} from "../src/lib/teacher-resource-center";

test("packages the supplied Teacher handbook as a PDF", () => {
  const handbook = readFileSync(
    path.resolve(
      process.cwd(),
      "../..",
      "attached_assets",
      TEACHER_RESOURCE_PDF,
    ),
  );

  assert.equal(handbook.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(handbook.length > 80_000);
  assert.equal(TEACHER_RESOURCE_VERSION, "2.0");
});

test("keeps the Teacher resource library organized around classroom support", () => {
  const categories = new Set(
    teacherResourceDefinitions.map((resource) => resource.category),
  );

  assert.ok(categories.has("Classroom Communication Supports"));
  assert.ok(categories.has("AAC Support Strategies"));
  assert.ok(categories.has("Regulation & Sensory Supports"));
  assert.ok(teacherResourceDefinitions.length >= 8);
});
