export type DocumentationDraftInput = {
  inputObservations: string;
  inputSummary: string;
  inputQuickNote: string;
  evidence?: {
    subjective: string;
    gestaltTracking: string;
    nlaObservations: string;
    assessment: string;
    functions: string[];
  };
};

export type DocumentationDraftContent = {
  sessionSummary: string;
  observedGestalts: string;
  communicationFunctions: string;
  nlaObservations: string;
  potentialGestalts: string;
  suggestedClinicalImpressions: string;
  clinicianNotes: string;
  observedLanguage: string;
  communicationFunctionsObserved: string;
  notableLanguageChanges: string;
  nlaGestaltInsights: string;
  sessionParticipation: string;
  aacPlanningOpportunities: string;
  suggestedDictionaryCandidates: string;
  suggestedFollowUpTargets: string;
  communicationGrowthSnapshot: string;
  familyTeamHighlights: string;
  evidenceReferences: Array<{
    id: string;
    kind: "reviewed_utterance" | "prior_reviewed_session" | "dictionary_history";
    label: string;
    detail: string;
  }>;
  goalConnections?: Array<{
    goalId: number;
    goalTitle: string;
    goalArea: string;
    goalVersion: number;
    sourceKind: "reviewed_utterance" | "dictionary_phrase" | "aac_profile" | "shared_moment" | "teacher_observation";
    sourceId: number;
    sourceLabel: string;
    sourceDetail: string;
    evidenceClass: "reviewed_clinical_evidence" | "care_team_context";
    included: boolean;
  }>;
};

export const DOCUMENTATION_SUGGESTED_INSIGHT_LABEL = "Suggested Insight";
export const DOCUMENTATION_REVIEW_REQUIRED_LABEL = "Clinician Review Required";

export const buildDocumentationDraftContent = ({
  inputObservations,
  inputSummary,
  inputQuickNote,
  evidence,
}: DocumentationDraftInput): DocumentationDraftContent => {
  const supplied = [inputSummary, inputObservations, inputQuickNote].filter(Boolean);
  const sessionSummary = [
    supplied.length ? `Clinician-provided context:\n${supplied.join("\n\n")}` : "",
    evidence?.subjective ?? "",
  ].filter(Boolean).join("\n\n") || "No clinician-authored context was supplied for this note.";

  return {
    sessionSummary,
    observedGestalts: evidence?.gestaltTracking
      ? `Clinician-confirmed phrase evidence from the reviewed session:\n${evidence.gestaltTracking}\n\n${DOCUMENTATION_REVIEW_REQUIRED_LABEL}\nAny meaning or interpretation must remain the clinician’s own review.`
      : `No confirmed Child gestalts are attached to this note.\n\n${DOCUMENTATION_REVIEW_REQUIRED_LABEL}\nDo not infer a gestalt from unreviewed or missing evidence.`,
    communicationFunctions: evidence?.functions.length
      ? `Clinician-confirmed communication functions: ${evidence.functions.join(", ")}.\n\n${DOCUMENTATION_REVIEW_REQUIRED_LABEL}\nReview each function in context before including it in a finalized record.`
      : `No confirmed communication functions are attached to this note.\n\n${DOCUMENTATION_REVIEW_REQUIRED_LABEL}\nNo function is inferred from the supplied text alone.`,
    nlaObservations: [
      DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
      evidence?.nlaObservations ?? "No NLA-related observation is generated from clinician input alone.",
      "",
      DOCUMENTATION_REVIEW_REQUIRED_LABEL,
      "EchoMap does not assign an NLA stage. Review language in context and edit this section using the clinician’s own judgment.",
    ].join("\n"),
    potentialGestalts: [
      DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
      "No potential gestalts are generated from clinician input alone.",
      "",
      DOCUMENTATION_REVIEW_REQUIRED_LABEL,
      "Treat this as a prompt for review, not as confirmed phrase evidence.",
    ].join("\n"),
    suggestedClinicalImpressions: [
      DOCUMENTATION_REVIEW_REQUIRED_LABEL,
      evidence?.assessment ?? "No clinical impression is generated from clinician input alone.",
      "",
      DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
      "Use this section as a prompt for clinician-authored documentation, not as a confirmed finding, diagnosis, or treatment recommendation.",
    ].join("\n"),
    clinicianNotes: "",
    observedLanguage: evidence?.gestaltTracking
      ? evidence.gestaltTracking
      : "No reviewed Child language was attached to this draft.",
    communicationFunctionsObserved: evidence?.functions.length
      ? evidence.functions.join(", ")
      : "No reviewed communication functions were attached to this draft.",
    notableLanguageChanges: "No longitudinal comparison was generated for this draft.",
    nlaGestaltInsights: [
      DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
      "No additional NLA or gestalt insight is generated from clinician input alone.",
      "",
      DOCUMENTATION_REVIEW_REQUIRED_LABEL,
      "Do not treat this section as a stage assignment or clinical conclusion.",
    ].join("\n"),
    sessionParticipation: "Participation is not inferred from this documentation draft. Use only explicit session metadata and reviewed language evidence.",
    aacPlanningOpportunities: [
      DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
      "Suggested support consideration only: review whether the confirmed communication functions call for an AAC planning conversation. No AAC plan was changed.",
      "",
      DOCUMENTATION_REVIEW_REQUIRED_LABEL,
      "This section is a review prompt and does not update AAC planning.",
    ].join("\n"),
    suggestedDictionaryCandidates: [
      DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
      "No dictionary candidate is added automatically. Review any phrase evidence above before taking dictionary action.",
      "",
      DOCUMENTATION_REVIEW_REQUIRED_LABEL,
      "This section does not change the Communication Dictionary.",
    ].join("\n"),
    suggestedFollowUpTargets: [
      DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
      "Clinician review prompt: decide what should be revisited with the child and care team. No treatment target was generated.",
      "",
      DOCUMENTATION_REVIEW_REQUIRED_LABEL,
      "This section is not a treatment recommendation or assigned goal.",
    ].join("\n"),
    communicationGrowthSnapshot: "No growth snapshot was generated for this draft.",
    familyTeamHighlights: [
      DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
      "Review-only plain-language highlight area. Nothing is shared automatically.",
      "",
      DOCUMENTATION_REVIEW_REQUIRED_LABEL,
      "Adapt any highlights for the intended audience before sharing them manually.",
    ].join("\n"),
    evidenceReferences: [],
  };
};

export const hasRequiredDocumentationLabels = (content: DocumentationDraftContent) =>
  content.nlaObservations.includes(DOCUMENTATION_SUGGESTED_INSIGHT_LABEL)
  && content.nlaObservations.includes(DOCUMENTATION_REVIEW_REQUIRED_LABEL)
  && content.potentialGestalts.includes(DOCUMENTATION_SUGGESTED_INSIGHT_LABEL)
  && content.potentialGestalts.includes(DOCUMENTATION_REVIEW_REQUIRED_LABEL)
  && content.suggestedClinicalImpressions.includes(DOCUMENTATION_SUGGESTED_INSIGHT_LABEL)
  && content.suggestedClinicalImpressions.includes(DOCUMENTATION_REVIEW_REQUIRED_LABEL)
  && content.observedGestalts.includes(DOCUMENTATION_REVIEW_REQUIRED_LABEL)
  && content.communicationFunctions.includes(DOCUMENTATION_REVIEW_REQUIRED_LABEL)
  && content.nlaGestaltInsights.includes(DOCUMENTATION_SUGGESTED_INSIGHT_LABEL)
  && content.nlaGestaltInsights.includes(DOCUMENTATION_REVIEW_REQUIRED_LABEL)
  && content.aacPlanningOpportunities.includes(DOCUMENTATION_REVIEW_REQUIRED_LABEL)
  && content.suggestedDictionaryCandidates.includes(DOCUMENTATION_REVIEW_REQUIRED_LABEL)
  && content.suggestedFollowUpTargets.includes(DOCUMENTATION_REVIEW_REQUIRED_LABEL)
  && content.familyTeamHighlights.includes(DOCUMENTATION_REVIEW_REQUIRED_LABEL);

export const hasShareSafeFamilyHighlights = (content: DocumentationDraftContent) =>
  !/\b(?:nla|natural\s+language\s+acquisition|stage\s*(?:[0-9]+|one|two|three|four|five|six)|diagnos\w*|autis\w*|apraxi\w*|treatment\w*|therap(?:y|ies|eutic)\w*|goal\w*|recommend\w*|prescri\w*)\b/i
    .test(content.familyTeamHighlights);

export const canExportClinicalDocumentation = (status: string) => status === "finalized";