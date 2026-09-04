export type TimelineCitation = {
  chunkId: number;
};

export type TimelineInsightForCitation<Citation extends TimelineCitation = TimelineCitation> = {
  status: string;
  evidence: {
    phrase: string | null;
  };
  citations: readonly Citation[];
};

export const normalizeJourneyPhrase = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/gu, " ");

/**
 * Knowledge citations can support a timeline event only when the insight is
 * active and its reviewed evidence contains the same normalized phrase.
 * Phrase-less events intentionally never receive source citations.
 */
export const citationsForTimelineEvidence = <Citation extends TimelineCitation>(
  phrase: string | undefined,
  insights: readonly TimelineInsightForCitation<Citation>[],
) => {
  if (!phrase) return [] as Citation[];

  const normalizedPhrase = normalizeJourneyPhrase(phrase);
  if (!normalizedPhrase) return [] as Citation[];

  return insights
    .filter((insight) => insight.status !== "reverted")
    .filter((insight) => {
      const evidencePhrase = insight.evidence.phrase;
      return evidencePhrase !== null && normalizeJourneyPhrase(evidencePhrase) === normalizedPhrase;
    })
    .flatMap((insight) => insight.citations)
    .filter((citation, index, citations) => (
      citations.findIndex((item) => item.chunkId === citation.chunkId) === index
    ))
    .slice(0, 2);
};