import assert from "node:assert/strict";
import test from "node:test";
import {
  CLINICIAN_LEARNING_DISCLAIMER,
  CLINICIAN_LEARNING_SAFETY_POINTS,
  clinicianLearningModuleDefinitions,
  clinicianLearningHandbookText,
  resolveClinicianLearningSectionProgress,
} from "../src/lib/clinician-learning-center";

const searchableLibrary = JSON.stringify(clinicianLearningModuleDefinitions).toLocaleLowerCase();

test("covers the professional handbook topics from the clinician brief", () => {
  const requiredTopics = [
    "turning communication into shared understanding",
    "communication dictionary framework",
    "evidence review workflow",
    "child language review",
    "stage 0",
    "stage 6",
    "stage decision support",
    "mitigation",
    "mini-chunks",
    "identifying gestalts",
    "working meanings",
    "script recognition",
    "longitudinal tracking",
    "handling unintelligible speech",
    "context collection",
    "dictionary-to-aac handoff",
    "core",
    "fringe",
    "home-school-therapy consistency",
    "recording sessions",
    "phrase inbox",
    "session summary creation",
    "reports and documentation",
  ];
  requiredTopics.forEach((topic) => assert.ok(searchableLibrary.includes(topic), `missing topic: ${topic}`));
});

test("publishes explicit educational safety boundaries in the center and handbook", () => {
  assert.equal(CLINICIAN_LEARNING_SAFETY_POINTS.length, 4);
  [
    "educational content only",
    "does not make diagnoses",
    "assign nla stages automatically",
    "does not generate treatment recommendations",
    "never modify child records",
    "separate from clinical documentation",
    "do not replace clinician judgment",
  ].forEach((phrase) => assert.ok(CLINICIAN_LEARNING_DISCLAIMER.toLocaleLowerCase().includes(phrase)));
  assert.ok(clinicianLearningHandbookText().includes(CLINICIAN_LEARNING_DISCLAIMER));
});

test("provides stable reader sections, implementation checklists, clinical notes, examples, and safe links", () => {
  const sections = clinicianLearningModuleDefinitions.flatMap((module) => module.sections);
  const keys = sections.map((section) => section.sectionKey);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(sections.some((section) => section.clinicalNote));
  assert.ok(sections.some((section) => section.checklist?.length));
  assert.ok(sections.some((section) => section.example));
  const links = sections.flatMap((section) => section.links ?? []);
  assert.ok(links.length > 0);
  links.forEach((link) => assert.match(link.url, /^https:\/\//));
});

test("accepts only section progress owned by the selected module and derives an integer percentage", () => {
  const module = clinicianLearningModuleDefinitions.find((entry) => entry.moduleKey === "childled-foundations")!;
  const firstKey = module.sections[0]!.sectionKey!;
  const expected = Math.round(100 / module.sections.length);
  assert.deepEqual(resolveClinicianLearningSectionProgress(module.sections, firstKey, expected), {
    sectionKey: firstKey,
    progressPercent: expected,
  });
  assert.equal(resolveClinicianLearningSectionProgress(module.sections, "not-a-real-section", 25), null);
  const foreignKey = clinicianLearningModuleDefinitions.find((entry) => entry.moduleKey !== module.moduleKey)!.sections[0]!.sectionKey!;
  assert.equal(resolveClinicianLearningSectionProgress(module.sections, foreignKey, expected), null);
  assert.equal(resolveClinicianLearningSectionProgress(module.sections, firstKey, 12.5), null);
  assert.equal(resolveClinicianLearningSectionProgress(module.sections, firstKey, expected + 1), null);
});