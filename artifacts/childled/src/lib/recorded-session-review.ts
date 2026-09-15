export type ReviewedSessionPhraseSummary = {
  phrase: string;
  meaning: string;
  communicationFunction: string;
  context: string;
  emotionalState: string;
  note: string;
  frequency?: number;
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
