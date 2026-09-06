import { openai } from "@workspace/integrations-openai-ai-server";
import {
  DOCUMENTATION_REVIEW_REQUIRED_LABEL,
  DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
  type DocumentationDraftContent,
} from "./documentation-draft";
import { canCreatePhraseEvidenceFrom } from "./child-utterance-review";

export type AiSessionEvidence = {
  segmentId: number;
  position: number;
  utterance: string;
  meaning: string;
  context: string;
  phrase?: string;
  communicationFunction?: string;
};

export type AiSessionEvidenceSegment = {
  id: number;
  position: number;
  text: string;
  intelligibility: string;
};

export type AiSessionEvidenceReview = {
  segmentId: number;
  disposition: string;
  meaning: string | null;
  context: string | null;
  intelligibilityReviewStatus?: string;
};

export type AiSessionLongitudinalContext = {
  priorEvidence: AiSessionEvidence[];
  priorSessionCount: number;
  priorFunctions: string[];
  dictionaryPhrases: string[];
};

export const selectAiSessionEvidence = (
  segments: AiSessionEvidenceSegment[],
  reviews: AiSessionEvidenceReview[],
) => {
  const reviewBySegmentId = new Map(reviews.map((review) => [review.segmentId, review]));
  return segments.flatMap<AiSessionEvidence>((segment) => {
    const review = reviewBySegmentId.get(segment.id);
    if (!review || !canCreatePhraseEvidenceFrom(segment, review)) return [];
    return [{
      segmentId: segment.id,
      position: segment.position,
      utterance: segment.text.trim(),
      meaning: review.meaning?.trim() ?? "",
      context: review.context?.trim() ?? "",
    }];
  });
};

export type AiSessionEvidenceSummary = {
  eligibleUtterances: number;
  excludedUtterances: number;
  reviewComplete: boolean;
};

const communicationFunctionValues = [
  "requesting",
  "commenting",
  "protesting",
  "directing",
  "assistance_seeking",
  "social_interaction",
  "information_sharing",
  "self_advocacy",
  "regulation_support_seeking",
] as const;
type CommunicationFunctionCode = typeof communicationFunctionValues[number];

const nlaObservationValues = [
  "repetition_observed",
  "variation_observed",
  "context_linked_use",
  "possible_mitigation_to_review",
  "insufficient_evidence",
] as const;
type NlaObservationCode = typeof nlaObservationValues[number];

type ModelDraft = {
  functionObservations: Array<{
    segmentId: number;
    category: CommunicationFunctionCode;
  }>;
  potentialGestaltSegmentIds: number[];
  nlaObservationCodes: NlaObservationCode[];
};

export const AI_SESSION_NOTE_SOURCE = "ai_confirmed_child_language_v2";

const modelDraftSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "functionObservations",
    "potentialGestaltSegmentIds",
    "nlaObservationCodes",
  ],
  properties: {
    functionObservations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["segmentId", "category"],
        properties: {
          segmentId: { type: "integer" },
          category: { type: "string", enum: communicationFunctionValues },
        },
      },
    },
    potentialGestaltSegmentIds: {
      type: "array",
      items: { type: "integer" },
    },
    nlaObservationCodes: {
      type: "array",
      items: { type: "string", enum: nlaObservationValues },
    },
  },
} as const;

export const parseAiSessionNote = (
  value: unknown,
  evidence: AiSessionEvidence[],
): ModelDraft => {
  if (!value || typeof value !== "object") throw new Error("AI session note was not an object.");
  const record = value as Record<string, unknown>;
  const allowedFields = new Set([
    "functionObservations",
    "potentialGestaltSegmentIds",
    "nlaObservationCodes",
  ]);
  if (Object.keys(record).some((key) => !allowedFields.has(key))) {
    throw new Error("AI session note included an unsupported field.");
  }
  if (
    !Array.isArray(record.functionObservations)
    || !Array.isArray(record.potentialGestaltSegmentIds)
    || !Array.isArray(record.nlaObservationCodes)
  ) throw new Error("AI session note was missing a required section.");

  const eligibleIds = new Set(evidence.map((item) => item.segmentId));
  const functionObservations = record.functionObservations.map((item) => {
    if (!item || typeof item !== "object") throw new Error("AI session note included an invalid function observation.");
    const observation = item as Record<string, unknown>;
    if (
      typeof observation.segmentId !== "number"
      || !eligibleIds.has(observation.segmentId)
      || !communicationFunctionValues.includes(observation.category as CommunicationFunctionCode)
    ) throw new Error("AI session note referenced ineligible evidence.");
    return {
      segmentId: observation.segmentId,
      category: observation.category as CommunicationFunctionCode,
    };
  });
  const potentialGestaltSegmentIds = record.potentialGestaltSegmentIds.map((segmentId) => {
    if (typeof segmentId !== "number" || !eligibleIds.has(segmentId)) {
      throw new Error("AI session note referenced ineligible evidence.");
    }
    return segmentId;
  });
  const nlaObservationCodes = record.nlaObservationCodes.map((code) => {
    if (!nlaObservationValues.includes(code as NlaObservationCode)) {
      throw new Error("AI session note included an unsupported observation.");
    }
    return code as NlaObservationCode;
  });
  return { functionObservations, potentialGestaltSegmentIds, nlaObservationCodes };
};

const functionLabels: Record<CommunicationFunctionCode, string> = {
  requesting: "Requesting",
  commenting: "Commenting",
  protesting: "Protesting",
  directing: "Directing",
  assistance_seeking: "Assistance seeking",
  social_interaction: "Social interaction",
  information_sharing: "Information sharing",
  self_advocacy: "Self-advocacy",
  regulation_support_seeking: "Regulation/support seeking",
};

export const canonicalSessionCommunicationFunction = (value?: string) => {
  if (!value) return undefined;
  const normalized = value.trim().toLocaleLowerCase().replace(/[_-]+/g, " ");
  if (/^requests?$|^requesting$/.test(normalized)) return "Requesting";
  if (/^comments?$|^commenting$/.test(normalized)) return "Commenting";
  if (/^protests?$|^protesting$|refusal/.test(normalized)) return "Protesting";
  if (/^direct(?:s|ing)?$/.test(normalized)) return "Directing";
  if (/assistance|help/.test(normalized)) return "Assistance seeking";
  if (/social|connection|shared joy/.test(normalized)) return "Social interaction";
  if (/information/.test(normalized)) return "Information sharing";
  if (/self advocacy/.test(normalized)) return "Self-advocacy";
  if (/regulation|transition|support seeking/.test(normalized)) return "Regulation/support seeking";
  return undefined;
};

const nlaObservationLabels: Record<NlaObservationCode, string> = {
  repetition_observed: "Repetition was present within the reviewed sample.",
  variation_observed: "Variation across reviewed utterances may be worth observing over time.",
  context_linked_use: "Use appeared linked to the clinician-recorded context.",
  possible_mitigation_to_review: "Possible mitigation is a review question only; no NLA stage is assigned.",
  insufficient_evidence: "The reviewed sample is not sufficient for an NLA-related observation.",
};

export const contentFromAiSessionNote = (
  draft: ModelDraft,
  evidence: AiSessionEvidence[],
): DocumentationDraftContent => {
  const byId = new Map(evidence.map((item) => [item.segmentId, item]));
  const phraseCounts = new Map<string, { utterance: string; count: number }>();
  for (const item of evidence) {
    const key = item.utterance.trim().toLocaleLowerCase();
    const current = phraseCounts.get(key);
    phraseCounts.set(key, {
      utterance: current?.utterance ?? item.utterance,
      count: (current?.count ?? 0) + 1,
    });
  }
  const repeated = [...phraseCounts.values()].filter((item) => item.count > 1);
  const functionLines = draft.functionObservations.map((observation) => {
    const item = byId.get(observation.segmentId)!;
    return `Possible ${functionLabels[observation.category]}: “${item.utterance}” (clinician-entered working meaning: ${item.meaning}).`;
  });
  const potentialGestaltLines = [...new Set(draft.potentialGestaltSegmentIds)].map((segmentId) => {
    const item = byId.get(segmentId)!;
    return `“${item.utterance}” — consider whether this is a gestalt candidate in context.`;
  });
  const nlaLines = [...new Set(draft.nlaObservationCodes)].map((code) => nlaObservationLabels[code]);
  const evidenceReferences = evidence.map((item) => ({
    id: `utterance-${item.segmentId}`,
    kind: "reviewed_utterance" as const,
    label: `Reviewed Child utterance ${item.position + 1}`,
    detail: `“${item.utterance}” · meaning: ${item.meaning} · context: ${item.context || "Not documented"}`,
  }));
  const observedLanguage = evidence.map((item) =>
    `• “${item.utterance}” — meaning: ${item.meaning}; context: ${item.context || "Not documented"} [utterance-${item.segmentId}]`,
  ).join("\n");
  const longerExamples = evidence.filter((item) => item.utterance.trim().split(/\s+/).length >= 5);
  const possibleFlexibility = draft.nlaObservationCodes.includes("variation_observed")
    || draft.nlaObservationCodes.includes("possible_mitigation_to_review");
  const functionSummary = functionLines.length
    ? functionLines.map((line, index) => `${line} [utterance-${draft.functionObservations[index]!.segmentId}]`).join("\n")
    : "No communication function was selected from the constrained AI review.";
  return {
  sessionSummary: [
    `AI-assisted overview from ${evidence.length} meaning-backed, clinician-confirmed Child utterance${evidence.length === 1 ? "" : "s"}.`,
    `The reviewed sample contained ${phraseCounts.size} distinct utterance${phraseCounts.size === 1 ? "" : "s"}.`,
    "No raw transcript, unresolved speech, diagnosis, treatment recommendation, or NLA stage is included.",
  ].join("\n"),
  observedGestalts: [
    "Recurring phrase summary",
    repeated.length
      ? repeated.map((item) => `“${item.utterance}” appeared ${item.count} times.`).join("\n")
      : "No exact repeated utterance was present in the eligible reviewed sample.",
    "",
    DOCUMENTATION_REVIEW_REQUIRED_LABEL,
    "Only the reviewed Child utterances listed in the evidence summary were provided to this draft.",
  ].join("\n"),
   communicationFunctions: [
     functionSummary,
    "",
    DOCUMENTATION_REVIEW_REQUIRED_LABEL,
    "Review each possible function in context before using it in a finalized record.",
  ].join("\n"),
  nlaObservations: [
    DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
    nlaLines.length
      ? nlaLines.join("\n")
      : nlaObservationLabels.insufficient_evidence,
    "",
    DOCUMENTATION_REVIEW_REQUIRED_LABEL,
    "ChildLed does not assign an NLA stage. Review and edit this observation using clinical judgment.",
  ].join("\n"),
  potentialGestalts: [
    DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
    potentialGestaltLines.length
      ? potentialGestaltLines.join("\n")
      : "No potential gestalt candidate was selected from the eligible reviewed sample.",
    "",
    DOCUMENTATION_REVIEW_REQUIRED_LABEL,
    "These are possibilities for clinician review, not confirmed gestalts.",
  ].join("\n"),
  suggestedClinicalImpressions: [
    DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
    "No diagnosis, treatment recommendation, or definitive clinical impression is generated.",
    "",
    DOCUMENTATION_REVIEW_REQUIRED_LABEL,
    "Clinical interpretation remains the responsibility of the licensed professional.",
  ].join("\n"),
  clinicianNotes: "",
   observedLanguage: [
     "Direct reviewed examples:",
     observedLanguage,
     "",
     repeated.length
       ? `Repeated language: ${repeated.map((item) => `“${item.utterance}” (${item.count})`).join(", ")}.`
       : "Repeated language: no exact repetition was present in the eligible sample.",
     longerExamples.length
       ? `Longer reviewed examples: ${longerExamples.map((item) => `“${item.utterance}”`).join(", ")}.`
       : "Longer reviewed examples: none identified in this sample.",
     potentialGestaltLines.length
       ? `Possible gestalt candidates requiring review: ${potentialGestaltLines.join(" ")}`
       : "Possible gestalt candidates: none selected from the eligible sample.",
     possibleFlexibility
       ? "Variation in the reviewed sample may warrant clinician review for emerging flexibility or recombination; this is not an NLA-stage conclusion."
       : "Emerging flexibility or recombination was not supported strongly enough to describe from this sample.",
   ].join("\n"),
   communicationFunctionsObserved: functionSummary,
   notableLanguageChanges: "Longitudinal comparison is added from prior reviewed sessions by the server.",
   nlaGestaltInsights: [
     DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
     nlaLines.length ? nlaLines.join("\n") : nlaObservationLabels.insufficient_evidence,
     "",
     DOCUMENTATION_REVIEW_REQUIRED_LABEL,
     "These observations may reflect patterns in this sample; they do not assign an NLA stage.",
   ].join("\n"),
   sessionParticipation: [
     `The saved review contains ${evidence.length} meaning-backed Child utterance${evidence.length === 1 ? "" : "s"}.`,
     "No engagement, intent, responsiveness, or participation quality is inferred beyond this reviewed language evidence.",
   ].join("\n"),
   aacPlanningOpportunities: [
     "Suggested support consideration only:",
     functionLines.length
       ? `Review whether the observed ${[...new Set(draft.functionObservations.map((item) => functionLabels[item.category]))].join(", ")} functions suggest an AAC planning conversation.`
       : "Review whether the confirmed language suggests an AAC planning conversation.",
     "",
     DOCUMENTATION_REVIEW_REQUIRED_LABEL,
     "No AAC plan or support was changed by this draft.",
   ].join("\n"),
   suggestedDictionaryCandidates: [
     DOCUMENTATION_SUGGESTED_INSIGHT_LABEL,
     potentialGestaltLines.length
       ? potentialGestaltLines.map((line, index) => `${line} [utterance-${draft.potentialGestaltSegmentIds[index % draft.potentialGestaltSegmentIds.length]}]`).join("\n")
       : "No potential gestalt candidate was selected from the eligible reviewed sample.",
     "",
     DOCUMENTATION_REVIEW_REQUIRED_LABEL,
     "Review and add any candidate manually; this draft never changes the Communication Dictionary.",
   ].join("\n"),
   suggestedFollowUpTargets: [
     "Suggested review prompts:",
     "• Revisit the confirmed examples in a future session and compare context.",
     "• Confirm meanings with the care team before carrying them into a finalized record.",
     "",
     DOCUMENTATION_REVIEW_REQUIRED_LABEL,
     "These are prompts, not treatment recommendations or assigned goals.",
   ].join("\n"),
   communicationGrowthSnapshot: [
     `Current reviewed sample: ${evidence.length} utterance${evidence.length === 1 ? "" : "s"}, ${phraseCounts.size} distinct phrase pattern${phraseCounts.size === 1 ? "" : "s"}, and ${repeated.length} repeated pattern${repeated.length === 1 ? "" : "s"}.`,
     "Longitudinal changes are described cautiously and are not proof of developmental change.",
   ].join("\n"),
   familyTeamHighlights: [
     "Review-only plain-language highlights:",
     ...evidence.slice(0, 5).map((item) => `• The phrase “${item.utterance}” was confirmed in the reviewed session.`),
     "",
     DOCUMENTATION_REVIEW_REQUIRED_LABEL,
     "Edit these highlights for the intended audience. ChildLed does not send them automatically.",
   ].join("\n"),
   evidenceReferences,
  };
};

export const addLongitudinalSessionSummary = (
  content: DocumentationDraftContent,
  evidence: AiSessionEvidence[],
  context: AiSessionLongitudinalContext,
) => {
  const key = (value: string) => value.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const currentKeys = new Set(evidence.map((item) => key(item.utterance)));
  const priorKeys = new Set(context.priorEvidence.map((item) => key(item.utterance)));
  const newPhrases = evidence.filter((item) => !priorKeys.has(key(item.utterance)));
  const reusedInNewContext = evidence.filter((item) => {
    const prior = context.priorEvidence.find((candidate) => key(candidate.utterance) === key(item.utterance));
    return Boolean(prior && key(prior.context) !== key(item.context));
  });
  const priorFunctionSet = new Set(context.priorFunctions.map(key));
  const newFunctions = [...new Set(evidence.map((item) => item.communicationFunction).filter((item): item is string => Boolean(item)))]
    .filter((item) => !priorFunctionSet.has(key(item)));
  const notObserved = context.priorEvidence
    .filter((item) => !currentKeys.has(key(item.utterance)))
    .map((item) => item.utterance);
  const currentCounts = new Map<string, number>();
  const priorCounts = new Map<string, number>();
  for (const item of evidence) currentCounts.set(key(item.utterance), (currentCounts.get(key(item.utterance)) ?? 0) + 1);
  for (const item of context.priorEvidence) priorCounts.set(key(item.utterance), (priorCounts.get(key(item.utterance)) ?? 0) + 1);
  const frequencyChanges = [...currentCounts.entries()]
    .filter(([phraseKey]) => priorCounts.has(phraseKey))
    .map(([phraseKey, count]) => `${phraseKey}: ${priorCounts.get(phraseKey)} prior reviewed occurrence${priorCounts.get(phraseKey) === 1 ? "" : "s"} → ${count} in this session`);
  const refs = [
    ...content.evidenceReferences,
    ...(context.priorSessionCount ? [{
      id: "prior-reviewed-sessions",
      kind: "prior_reviewed_session" as const,
      label: `${context.priorSessionCount} prior reviewed session${context.priorSessionCount === 1 ? "" : "s"}`,
      detail: "Comparison uses only meaning-backed, clinician-confirmed Child utterances from earlier reviewed sessions.",
    }] : []),
    ...(context.dictionaryPhrases.length ? [{
      id: "dictionary-history",
      kind: "dictionary_history" as const,
      label: "Communication Dictionary history",
      detail: `${context.dictionaryPhrases.length} active reviewed dictionary entr${context.dictionaryPhrases.length === 1 ? "y" : "ies"} were available for comparison.`,
    }] : []),
  ];
  const longitudinal = context.priorSessionCount
    ? [
      `Compared with ${context.priorSessionCount} prior reviewed session${context.priorSessionCount === 1 ? "" : "s"}:`,
      `• Newly observed in this reviewed session: ${newPhrases.length ? newPhrases.map((item) => `“${item.utterance}”`).join(", ") : "none identified in the comparison window"}.`,
      `• Prior phrases not observed in this session: ${notObserved.length ? [...new Set(notObserved)].slice(0, 8).map((item) => `“${item}”`).join(", ") : "none identified in the comparison window"}.`,
      `• Reused in a different recorded context: ${reusedInNewContext.length ? [...new Set(reusedInNewContext.map((item) => `“${item.utterance}”`))].join(", ") : "none identified in the comparison window"}.`,
      `• First-observed communication functions: ${newFunctions.length ? newFunctions.join(", ") : "none identified in the comparison window"}.`,
      `• Reviewed frequency changes: ${frequencyChanges.length ? frequencyChanges.slice(0, 8).join("; ") : "no repeated phrase comparison available"}.`,
      "",
      DOCUMENTATION_REVIEW_REQUIRED_LABEL,
      "These are cautious comparisons of reviewed records, not conclusions about development or treatment.",
    ].join("\n")
    : "No prior reviewed session was available. This session establishes the first comparison point.";
  return {
    ...content,
    notableLanguageChanges: longitudinal,
    communicationGrowthSnapshot: [
      context.priorSessionCount
        ? `Across the available reviewed history, ${newPhrases.length} phrase${newPhrases.length === 1 ? "" : "s"} were newly observed in this session, ${reusedInNewContext.length} were reused with a different recorded context, and ${newFunctions.length} function${newFunctions.length === 1 ? "" : "s"} appeared for the first time in the comparison window.`
        : "This is the first comparison point because no prior reviewed session was available.",
      "These changes may reflect the recorded sample and should be interpreted with the child’s broader context.",
      "",
      DOCUMENTATION_REVIEW_REQUIRED_LABEL,
    ].join("\n"),
    evidenceReferences: refs,
  };
};

export const generateAiSessionNote = async (evidence: AiSessionEvidence[]) => {
  const response = await openai.chat.completions.create({
    model: "gpt-5.6-terra",
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "childled_session_note",
        strict: true,
        schema: modelDraftSchema,
      },
    },
    messages: [
      {
        role: "system",
        content: [
          "You draft a clinician-reviewable communication session note for ChildLed.",
          "Use only the reviewed Child utterance evidence in the user message.",
          "Do not mention, reconstruct, or infer from any unseen transcript.",
          "Return only the constrained codes and eligible segment IDs defined by the schema.",
          "Do not generate free-form clinical prose, NLA stages, diagnoses, or treatment recommendations.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({ reviewedChildUtterances: evidence }),
      },
    ],
  });
  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("AI session note provider returned no content.");
  return contentFromAiSessionNote(parseAiSessionNote(JSON.parse(raw), evidence), evidence);
};