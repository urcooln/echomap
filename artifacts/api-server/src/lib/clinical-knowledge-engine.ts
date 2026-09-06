import type {
  KnowledgeCitation,
  KnowledgeEvidenceSnapshot,
} from "@workspace/db";

export const CLINICAL_KNOWLEDGE_PROVIDER = "ChildLed cited-retrieval";
export const CLINICAL_KNOWLEDGE_MODEL = "deterministic-v1";
export const CLINICAL_INSIGHTS_ENGINE_VERSION = "routine-auto-apply-v1";

export const knowledgeInsightCategories = [
  "gestalt_identification",
  "communication_function",
  "mitigation_observation",
  "nla_stage_indicator",
  "parent_coaching",
  "soap_insight",
  "longitudinal_growth",
] as const;

export type KnowledgeInsightCategory = (typeof knowledgeInsightCategories)[number];
export type InsightConfidence = "high" | "medium" | "low";
export type InsightDisposition = "applied" | "monitoring" | "draft" | "exception";
export type InsightReviewReason =
  | "low_confidence"
  | "competing_interpretations"
  | "possible_mitigation"
  | "possible_stage_transition"
  | "unknown_function"
  | null;
export type SearchableKnowledgeChunk = {
  id: number;
  sourceId: number;
  sourceVersionId: number;
  sourceTitle: string;
  page: number | null;
  section: string | null;
  text: string;
};
export type ClinicalEvidence = {
  phrase: string | null;
  functions: string[];
  contexts: string[];
  reviewedPhraseCount: number;
  reviewedObservationCount: number;
  sessionId: number | null;
};
export type ReviewedPhraseEvidence = {
  phrase: string;
  childAttributed: boolean;
};
export type InsightDraft = {
  category: KnowledgeInsightCategory;
  confidence: InsightConfidence;
  confidenceScore: number;
  suggestion: string;
  rationale: string;
  citations: KnowledgeCitation[];
  evidenceSnapshot: KnowledgeEvidenceSnapshot;
};

export type RoutedInsightDraft = InsightDraft & {
  disposition: InsightDisposition;
  reviewReason: InsightReviewReason;
  alternatives: string[];
};

export const insightRunRecoveryState = ({
  status,
  attempt,
  leaseExpired,
  maxAttempts,
}: {
  status: string;
  attempt: number;
  leaseExpired: boolean;
  maxAttempts: number;
}) => {
  if (status === "running" && leaseExpired) {
    return attempt >= maxAttempts ? "attempts_exhausted" : "lease_expired";
  }
  if ((status === "queued" || status === "failed") && attempt < maxAttempts) return "retry";
  return "none";
};

/**
 * A reverted applied fact may archive only the inventory row that this engine
 * run created, and only once no other active automatic fact still references
 * it. A later clinician-owned update always wins over automatic provenance.
 */
export const shouldArchiveEngineOwnedGestalt = ({
  engineCreatedGestalt,
  gestaltSource,
  activeReferences,
}: {
  engineCreatedGestalt: boolean;
  gestaltSource: string | null;
  activeReferences: number;
}) => engineCreatedGestalt
  && gestaltSource === "Clinical Insights Engine"
  && activeReferences === 0;

const termSet = (value: string) =>
  new Set(
    value
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{1,}/gu)
      ?.filter((word) => word.length > 2) ?? [],
  );

const comparablePhrase = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/gu, " ");

/**
 * A supplied phrase is only a search constraint: the phrase persisted in an
 * insight must come from an immutable, reviewed Child-evidence record.
 */
export const reviewedPhraseSelection = <T extends ReviewedPhraseEvidence>(
  phrases: T[],
  requestedPhrase?: string,
) => {
  const reviewed = phrases.filter((phrase) => phrase.childAttributed);
  if (!requestedPhrase) return reviewed;
  const requested = comparablePhrase(requestedPhrase);
  return reviewed.filter((phrase) => comparablePhrase(phrase.phrase) === requested);
};

export const retrieveRelevantKnowledge = (
  query: string,
  chunks: SearchableKnowledgeChunk[],
  count = 3,
) => {
  const queryTerms = termSet(query);
  if (!queryTerms.size) return [];
  return chunks
    .map((chunk) => {
      const words = termSet(chunk.text);
      const overlap = [...queryTerms].filter((word) => words.has(word)).length;
      const headingBoost = chunk.section
        ? [...queryTerms].filter((word) => termSet(chunk.section ?? "").has(word)).length
        : 0;
      return { chunk, score: overlap * 3 + headingBoost * 2 };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.chunk.id - right.chunk.id)
    .slice(0, count)
    .map(({ chunk }) => chunk);
};

const confidenceFor = (chunks: SearchableKnowledgeChunk[], evidence: ClinicalEvidence): InsightConfidence => {
  if (chunks.length >= 2 && evidence.reviewedPhraseCount >= 2) return "high";
  if (chunks.length >= 1 && evidence.reviewedPhraseCount >= 1) return "medium";
  return "low";
};

const unknownFunction = (evidence: ClinicalEvidence) =>
  !evidence.functions.some((value) => value.trim() && !/^(unknown|not documented|n\/a)$/i.test(value.trim()));

/**
 * The policy is intentionally narrower than retrieval. Retrieval can produce
 * useful context for a draft, but only routine phrase/function findings with
 * high confidence may mutate the child record.
 */
export const routeInsightDraft = (
  draft: InsightDraft,
  evidence: ClinicalEvidence,
): RoutedInsightDraft => {
  if (draft.category === "mitigation_observation") {
    return { ...draft, disposition: "exception", reviewReason: "possible_mitigation", alternatives: ["Routine phrase pattern", "Possible flexible language pattern"] };
  }
  if (draft.category === "nla_stage_indicator") {
    return { ...draft, disposition: "exception", reviewReason: "possible_stage_transition", alternatives: ["No stage conclusion", "Possible stage indicator only"] };
  }
  if (draft.category === "gestalt_identification" || draft.category === "communication_function") {
    if (unknownFunction(evidence)) {
      return { ...draft, disposition: "exception", reviewReason: "unknown_function", alternatives: ["Function not yet documented", "Different communication function"] };
    }
    if (draft.confidence === "high") {
      return { ...draft, disposition: "applied", reviewReason: null, alternatives: [] };
    }
    if (draft.confidence === "medium") {
      return { ...draft, disposition: "monitoring", reviewReason: null, alternatives: [] };
    }
    return { ...draft, disposition: "exception", reviewReason: "low_confidence", alternatives: ["Routine phrase/function finding", "Insufficient evidence to interpret"] };
  }
  if (draft.confidence === "low") {
    return { ...draft, disposition: "exception", reviewReason: "low_confidence", alternatives: ["Continue observing", "Insufficient cited evidence"] };
  }
  return { ...draft, disposition: "draft", reviewReason: null, alternatives: [] };
};

export const routeInsightDrafts = (
  drafts: InsightDraft[],
  evidence: ClinicalEvidence,
) => drafts.map((draft) => routeInsightDraft(draft, evidence));

export const confidenceScoreFor = (confidence: InsightConfidence) =>
  confidence === "high" ? 90 : confidence === "medium" ? 65 : 35;

const citationFor = (chunk: SearchableKnowledgeChunk): KnowledgeCitation => ({
  sourceId: chunk.sourceId,
  sourceVersionId: chunk.sourceVersionId,
  chunkId: chunk.id,
  sourceTitle: chunk.sourceTitle,
  page: chunk.page,
  section: chunk.section,
});

const firstReference = (chunks: SearchableKnowledgeChunk[]) =>
  chunks[0]?.section ? `“${chunks[0].section}”` : "the cited knowledge source";

const evidenceLabel = (evidence: ClinicalEvidence) =>
  evidence.phrase
    ? `the reviewed phrase “${evidence.phrase}”`
    : `${evidence.reviewedPhraseCount} reviewed phrase${evidence.reviewedPhraseCount === 1 ? "" : "s"}`;

const suggestionFor = (
  category: KnowledgeInsightCategory,
  evidence: ClinicalEvidence,
  reference: string,
) => {
  const phrase = evidenceLabel(evidence);
  const functions = evidence.functions.length ? evidence.functions.join(", ") : "no confirmed function yet";
  const contexts = evidence.contexts.length ? evidence.contexts.join(", ") : "the recorded contexts";
  const suggestions: Record<KnowledgeInsightCategory, string> = {
    gestalt_identification: `Review whether ${phrase} is functioning as a whole gestalt in context, using ${reference} as a comparison point. Keep the clinician’s interpretation rather than treating this as an identification.`,
    communication_function: `Consider whether ${phrase} may be serving a communication function related to ${functions}. Compare the documented use in ${contexts} with the cited source before confirming a function.`,
    mitigation_observation: `Observe whether changes in partner language, timing, sensory load, or transition support affect how ${phrase} is used. This is an observation prompt, not a prescriptive intervention.`,
    nla_stage_indicator: `Possible NLA indicator only: review the form, flexibility, and context of ${phrase} alongside ${reference}. Do not assign a definitive stage from this suggestion.`,
    parent_coaching: `Offer the care team a reflective coaching prompt: notice the situation around ${phrase}, acknowledge the message, and record what happened next. Adapt wording to the family and clinician’s plan.`,
    soap_insight: `SOAP draft prompt: document the reviewed evidence around ${phrase}, the observed function/context, and what remains uncertain. Edit this into the clinician’s own assessment rather than copying it as a conclusion.`,
    longitudinal_growth: `Compare the current reviewed evidence with earlier sessions for changes in phrase variety, flexibility, function, and context. Treat any change as a trend to review, not proof of a stage transition.`,
  };
  return suggestions[category];
};

const categoryTerms: Record<KnowledgeInsightCategory, string> = {
  gestalt_identification: "gestalt delayed echolalia whole language chunks language sample",
  communication_function: "communication function intent meaning validation connection request protest",
  mitigation_observation: "mitigation flexible chunks recombination partner language sensory transition support",
  nla_stage_indicator: "NLA stage possible indicator mitigation recombination spontaneous language sample",
  parent_coaching: "parent coaching caregiver acknowledge message child led play co regulation",
  soap_insight: "SOAP clinical documentation objective assessment plan progress note",
  longitudinal_growth: "longitudinal growth phrase variety flexibility communication functions trend",
};

export const buildKnowledgeInsightDrafts = (
  evidence: ClinicalEvidence,
  corpus: SearchableKnowledgeChunk[],
) => {
  const evidenceSnapshot: KnowledgeEvidenceSnapshot = {
    reviewedPhraseCount: evidence.reviewedPhraseCount,
    reviewedObservationCount: evidence.reviewedObservationCount,
    sessionId: evidence.sessionId,
    phrase: evidence.phrase,
    evidenceVersion: `reviewed-evidence-v1:${evidence.sessionId ?? "dictionary"}:${evidence.reviewedPhraseCount}`,
  };
  const evidenceTerms = [evidence.phrase, ...evidence.functions, ...evidence.contexts]
    .filter(Boolean)
    .join(" ");
  return knowledgeInsightCategories.flatMap((category) => {
    const retrieved = retrieveRelevantKnowledge(
      `${evidenceTerms} ${categoryTerms[category]}`,
      corpus,
    );
    if (!retrieved.length) return [];
    const confidence = confidenceFor(retrieved, evidence);
    const citations = retrieved.map(citationFor);
    return [{
      category,
      confidence,
      confidenceScore: confidenceScoreFor(confidence),
      suggestion: suggestionFor(category, evidence, firstReference(retrieved)),
      rationale: `Grounded in ${evidenceLabel(evidence)} and ${retrieved.length} cited source excerpt${retrieved.length === 1 ? "" : "s"}. ${confidence === "low" ? "Low confidence: clinician review is required before using this prompt." : "This is an evidence-based suggestion for clinician review, not a diagnosis, definitive stage assignment, or treatment recommendation."}`,
      citations,
      evidenceSnapshot,
    }];
  });
};