import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDocumentationDraftContent,
  canExportClinicalDocumentation,
  DOCUMENTATION_REVIEW_REQUIRED_LABEL,
  DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
  hasRequiredDocumentationLabels,
} from "../src/lib/documentation-draft";

test("uses clinician input without inventing evidence", () => {
  const draft = buildDocumentationDraftContent({
    inputSummary: "Practiced transitions with a visual schedule.",
    inputObservations: "Used a familiar phrase before choosing a break.",
    inputQuickNote: "Follow up next session.",
  });
  assert.match(draft.sessionSummary, /Practiced transitions/);
  assert.match(draft.sessionSummary, /Used a familiar phrase/);
  assert.match(draft.observedGestalts, /No confirmed Child gestalts/);
  assert.match(draft.communicationFunctions, /No confirmed communication functions/);
  assert.equal(hasRequiredDocumentationLabels(draft), true);
});

test("keeps reviewed evidence distinct from generated interpretation", () => {
  const draft = buildDocumentationDraftContent({
    inputSummary: "",
    inputObservations: "",
    inputQuickNote: "",
    evidence: {
      subjective: "Clinician-entered session report.",
      gestaltTracking: "“Let’s go” — confirmed in session.",
      functions: ["Requesting"],
      nlaObservations: "Possible pattern only; no stage assignment.",
      assessment: "Draft clinical summary.",
    },
  });
  assert.match(draft.observedGestalts, /Clinician-confirmed phrase evidence/);
  assert.match(draft.observedGestalts, /“Let’s go”/);
  assert.match(draft.nlaObservations, new RegExp(DOCUMENTATION_SUGGESTED_INSIGHT_LABEL));
  assert.match(draft.nlaObservations, new RegExp(DOCUMENTATION_REVIEW_REQUIRED_LABEL));
  assert.match(draft.suggestedClinicalImpressions, /not as a confirmed finding/);
  assert.equal(hasRequiredDocumentationLabels(draft), true);
});

test("rejects content after a required interpretation label is removed", () => {
  const draft = buildDocumentationDraftContent({
    inputSummary: "Brief clinician summary.",
    inputObservations: "",
    inputQuickNote: "",
  });
  assert.equal(hasRequiredDocumentationLabels({
    ...draft,
    nlaObservations: draft.nlaObservations.replace(DOCUMENTATION_SUGGESTED_INSIGHT_LABEL, ""),
  }), false);
  assert.equal(hasRequiredDocumentationLabels({
    ...draft,
    observedGestalts: draft.observedGestalts.replace(DOCUMENTATION_REVIEW_REQUIRED_LABEL, ""),
  }), false);
});

test("allows document export only after finalization", () => {
  assert.equal(canExportClinicalDocumentation("draft"), false);
  assert.equal(canExportClinicalDocumentation("finalized"), true);
});