export type ReviewedSessionPhraseSummary = {
  phrase: string;
  meaning: string;
  communicationFunction: string;
  context: string;
  emotionalState: string;
  note: string;
  frequency?: number;
};

export type PrioritizedChildLanguageReview = {
  reviewRank: number;
  disposition: string;
};

export const nextPrioritizedChildLanguageReview = <
  T extends PrioritizedChildLanguageReview,
>(
  utterances: readonly T[],
) =>
  utterances.reduce<T | undefined>((next, utterance) => {
    if (utterance.disposition !== "pending") return next;
    if (!next || utterance.reviewRank < next.reviewRank) return utterance;
    return next;
  }, undefined);

export const hasUnpreparedChildTranscriptPhrase = ({
  phrases,
  ignoredPhraseIds,
  capturedPhraseIds,
  inboxPhraseIds,
}: {
  phrases: readonly { id: number; childAttributed: boolean }[];
  ignoredPhraseIds: readonly number[];
  capturedPhraseIds: readonly number[];
  inboxPhraseIds: readonly number[];
}) => {
  const ignored = new Set(ignoredPhraseIds);
  const prepared = new Set([...capturedPhraseIds, ...inboxPhraseIds]);
  return phrases.some(
    (phrase) =>
      phrase.childAttributed &&
      !ignored.has(phrase.id) &&
      !prepared.has(phrase.id),
  );
};

export const buildRecordedSessionSummary = ({
  sessionLabel,
  selectedPhrases,
  clinicalObservations,
  goalProgress,
  nextSteps,
}: {
  sessionLabel: string;
  selectedPhrases: ReviewedSessionPhraseSummary[];
  clinicalObservations: string;
  goalProgress: string[];
  nextSteps: string;
}) => {
  const sections = [
    sessionLabel,
    "",
    "Reviewed child communication:",
    selectedPhrases.length
      ? selectedPhrases
          .map((item, index) =>
            [
              `${index + 1}. "${item.phrase}"${item.frequency && item.frequency > 1 ? ` (heard ${item.frequency} times)` : ""}`,
              `   Working meaning: ${item.meaning || "To be explored with the team."}`,
              `   Function: ${item.communicationFunction || "Unknown"} | Setting: ${item.context || "Not recorded"} | Emotional state: ${item.emotionalState || "Unknown"}`,
              item.note ? `   Clinical context: ${item.note}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n\n")
      : "No reviewed child utterances were selected.",
    "",
    "Goal progress:",
    goalProgress.length
      ? goalProgress.join("\n")
      : "No communication goals were marked as addressed.",
  ];
  if (clinicalObservations.trim()) {
    sections.push("", "Clinical observations:", clinicalObservations.trim());
  }
  if (nextSteps.trim()) {
    sections.push("", "Next steps:", nextSteps.trim());
  }
  return sections.join("\n");
};
