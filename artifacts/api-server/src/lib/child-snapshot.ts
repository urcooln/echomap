export type SnapshotTrend = "up" | "down" | "stable";

export type SnapshotExample = {
  context: string;
  meaning: string;
  sessionDate: string;
};

export type SnapshotPhrase = {
  phrase: string;
  gestaltId: number | null;
  occurrences: number;
  contexts: string[];
  function: string;
  meaning: string;
  trend: SnapshotTrend;
  examples: SnapshotExample[];
};

export type SnapshotFunction = {
  label: string;
  count: number;
  percentage: number;
};

export type SnapshotMitigation = {
  label: string;
  phrase: string;
  evidenceCount: number;
  contexts: string[];
};

export type SnapshotChangeExample = {
  phrase: string;
  meaning: string;
  context: string;
  sessionDate: string;
};

export type SnapshotNewGestalt = {
  phrase: string;
  firstObservedDate: string;
  sessionDate: string;
};

export type SnapshotNewFunction = {
  label: string;
  examples: SnapshotChangeExample[];
};

export type SnapshotPossibleMitigation = {
  originalPhrase: string;
  observedVariation: string;
  confidence: "Low" | "Moderate";
  context: string;
  sessionDate: string;
};

export type SnapshotSessionChange = {
  clinicalSummary: string;
  comparisonState: "onboarding" | "first_session" | "compared";
  latestSessionDate: string | null;
  previousSessionDate: string | null;
  newGestalts: SnapshotNewGestalt[];
  newFunctions: SnapshotNewFunction[];
  possibleMitigations: SnapshotPossibleMitigation[];
};

export type ChildSnapshot = {
  totalGestaltsCollected: number;
  newGestaltsThisWeek: number;
  newGestaltsLastWeek: number;
  newGestaltsTrend: SnapshotTrend;
  totalReviewedChildUtterances: number;
  functionDistribution: SnapshotFunction[];
  frequentPhrases: SnapshotPhrase[];
  emergingMitigations: SnapshotMitigation[];
  hasEnoughData: boolean;
  trendWindowLabel: string;
  sessionChange: SnapshotSessionChange;
};

export type SnapshotGestaltRecord = {
  id: number;
  phrase: string;
  meaning: string;
  communicationFunction: string;
  contexts: string[];
  createdAt: Date;
};

export type SnapshotOccurrenceRecord = {
  sessionId: number;
  phrase: string;
  meaning: string;
  communicationFunction: string;
  context: string;
  gestaltId: number | null;
  originalPhrase: string | null;
  sessionDate: Date;
  frequency: number;
};

const normalizeKey = (value: string) => value.trim().toLocaleLowerCase();
const normalizePhrase = (value: string) =>
  value.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
const weekInMilliseconds = 7 * 24 * 60 * 60 * 1000;

const phraseOverlap = (left: string, right: string) => {
  const leftWords = normalizePhrase(left).split(" ").filter(Boolean);
  const rightWords = normalizePhrase(right).split(" ").filter(Boolean);
  const shared = leftWords.filter((word) => rightWords.includes(word)).length;
  if (Math.min(leftWords.length, rightWords.length) < 2 || shared < 2) return 0;
  return shared / Math.min(leftWords.length, rightWords.length);
};

export const trendForChange = (current: number, previous: number): SnapshotTrend => {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "stable";
};

export const childAttributedOnly = <T extends { childAttributed: boolean }>(phrases: T[]) =>
  phrases.filter((phrase) => phrase.childAttributed);

export const countReviewedChildSessions = <T extends { childAttributed: boolean; sessionId: number }>(
  phrases: T[],
) => new Set(childAttributedOnly(phrases).map((phrase) => phrase.sessionId)).size;

const clinicianReadableFunction = (value: string) => {
  const key = normalizeKey(value);
  const labels: Record<string, string> = {
    request: "Requesting",
    requesting: "Requesting",
    comment: "Commenting",
    commenting: "Commenting",
    "shared joy": "Shared joy",
    protest: "Protesting",
    protesting: "Protesting",
    regulation: "Self-regulation",
    "self-regulation": "Self-regulation",
    social: "Social interaction",
    "social interaction": "Social interaction",
  };
  return labels[key] ?? value;
};

const plural = (count: number, singular: string, multiple = `${singular}s`) =>
  `${count} ${count === 1 ? singular : multiple}`;

function buildSessionChange(
  occurrences: SnapshotOccurrenceRecord[],
  childName: string,
): SnapshotSessionChange {
  const sessions = [...new Map(
    occurrences
      .filter((occurrence) => occurrence.sessionDate.getTime() > 0)
      .sort((left, right) => right.sessionDate.getTime() - left.sessionDate.getTime())
      .map((occurrence) => [occurrence.sessionId, occurrence.sessionDate]),
  )].map(([id, sessionDate]) => ({ id, sessionDate }));

  const latest = sessions[0];
  const prior = sessions[1];
  const emptyChange = {
    latestSessionDate: latest?.sessionDate.toISOString() ?? null,
    previousSessionDate: prior?.sessionDate.toISOString() ?? null,
    newGestalts: [] as SnapshotNewGestalt[],
    newFunctions: [] as SnapshotNewFunction[],
    possibleMitigations: [] as SnapshotPossibleMitigation[],
  };

  if (!latest) {
    return {
      ...emptyChange,
      comparisonState: "onboarding",
      clinicalSummary: "Record a reviewed session to begin identifying changes in this child’s communication.",
    };
  }

  const currentOccurrences = occurrences.filter((occurrence) => occurrence.sessionId === latest.id);
  const immediatePriorOccurrences = prior
    ? occurrences.filter((occurrence) => occurrence.sessionId === prior.id)
    : [];
  const earliestByGestalt = new Map<number, SnapshotOccurrenceRecord>();
  for (const occurrence of [...occurrences].sort(
    (left, right) => left.sessionDate.getTime() - right.sessionDate.getTime(),
  )) {
    if (occurrence.gestaltId != null && !earliestByGestalt.has(occurrence.gestaltId)) {
      earliestByGestalt.set(occurrence.gestaltId, occurrence);
    }
  }
  const immediatePriorGestaltIds = new Set(
    immediatePriorOccurrences
      .map((occurrence) => occurrence.gestaltId)
      .filter((id): id is number => id != null),
  );

  const newGestalts = [...new Map(
    currentOccurrences
      .filter((occurrence) => (
        occurrence.gestaltId != null
        && !immediatePriorGestaltIds.has(occurrence.gestaltId)
        && earliestByGestalt.get(occurrence.gestaltId)?.sessionId === latest.id
      ))
      .map((occurrence) => {
        const firstObserved = earliestByGestalt.get(occurrence.gestaltId!);
        return [occurrence.gestaltId!, {
          phrase: occurrence.originalPhrase || occurrence.phrase,
          firstObservedDate: firstObserved?.sessionDate.toISOString() ?? latest.sessionDate.toISOString(),
          sessionDate: latest.sessionDate.toISOString(),
        }];
      }),
  ).values()].slice(0, 4);

  const priorFunctionKeys = new Set(
    immediatePriorOccurrences
      .map((occurrence) => normalizeKey(occurrence.communicationFunction))
      .filter((value) => value && value !== "unknown" && value !== "not documented"),
  );
  const newFunctions = [...new Map(
    currentOccurrences
      .filter((occurrence) => {
        const key = normalizeKey(occurrence.communicationFunction);
        return key && key !== "unknown" && key !== "not documented" && !priorFunctionKeys.has(key);
      })
      .map((occurrence) => [normalizeKey(occurrence.communicationFunction), occurrence]),
  ).entries()].map(([key]) => {
    const examples = currentOccurrences
      .filter((occurrence) => normalizeKey(occurrence.communicationFunction) === key)
      .slice(0, 2)
      .map((occurrence) => ({
        phrase: occurrence.phrase,
        meaning: occurrence.meaning || "Meaning not documented",
        context: occurrence.context || "Context not documented",
        sessionDate: latest.sessionDate.toISOString(),
      }));
    return {
      label: clinicianReadableFunction(currentOccurrences.find((occurrence) => normalizeKey(occurrence.communicationFunction) === key)?.communicationFunction ?? key),
      examples,
    };
  }).slice(0, 4);

  const possibleMitigations = [...new Map(
    currentOccurrences.flatMap((occurrence) => {
      const priorMatch = immediatePriorOccurrences
        .map((previous) => ({ previous, overlap: phraseOverlap(previous.phrase, occurrence.phrase) }))
        .filter((candidate) => normalizePhrase(candidate.previous.phrase) !== normalizePhrase(occurrence.phrase) && candidate.overlap >= 0.75)
        .sort((left, right) => right.overlap - left.overlap)[0];
      if (!priorMatch) return [];
      const variationEvidenceCount = currentOccurrences
        .filter((item) => normalizePhrase(item.phrase) === normalizePhrase(occurrence.phrase))
        .reduce((total, item) => total + Math.max(1, item.frequency), 0);
      const originalPhrase = priorMatch.previous.phrase;
      return [[`${normalizePhrase(originalPhrase)}:${normalizePhrase(occurrence.phrase)}`, {
        originalPhrase,
        observedVariation: occurrence.phrase,
        confidence: (variationEvidenceCount > 1 ? "Moderate" : "Low") as SnapshotPossibleMitigation["confidence"],
        context: occurrence.context || "Context not documented",
        sessionDate: latest.sessionDate.toISOString(),
      }] as [string, SnapshotPossibleMitigation]];
    }),
  ).values()].slice(0, 3);

  if (!prior) {
    const details = [
      newGestalts.length ? plural(newGestalts.length, "new gestalt") : "",
      newFunctions.length ? plural(newFunctions.length, "communication function") : "",
    ].filter(Boolean);
    return {
      ...emptyChange,
      comparisonState: "first_session",
      newGestalts,
      newFunctions,
      possibleMitigations,
      clinicalSummary: `${childName}’s first reviewed session ${details.length ? `includes ${details.join(" and ")}` : "is ready for clinical review"}.`,
    };
  }

  const summaryDetails = [
    newGestalts.length ? plural(newGestalts.length, "new gestalt") : "",
    possibleMitigations.length ? plural(possibleMitigations.length, "possible mitigation") : "",
    newFunctions.length ? `new ${newFunctions.map((entry) => entry.label.toLocaleLowerCase()).join(" and ")}` : "",
  ].filter(Boolean);
  return {
    ...emptyChange,
    comparisonState: "compared",
    newGestalts,
    newFunctions,
    possibleMitigations,
    clinicalSummary: summaryDetails.length
      ? `${childName} demonstrated ${summaryDetails.join(", ")} since the previous session.`
      : `Language patterns remained stable since the previous session, with no newly observed gestalts or communication functions.`,
  };
}

export function buildChildSnapshot(
  gestalts: SnapshotGestaltRecord[],
  occurrences: SnapshotOccurrenceRecord[],
  now = new Date(),
  childName = "This child",
): ChildSnapshot {
  const thisWeekStart = new Date(now.getTime() - weekInMilliseconds);
  const lastWeekStart = new Date(thisWeekStart.getTime() - weekInMilliseconds);

  const newThisWeek = gestalts.filter(
    (gestalt) => gestalt.createdAt >= thisWeekStart && gestalt.createdAt <= now,
  ).length;
  const newLastWeek = gestalts.filter(
    (gestalt) => gestalt.createdAt >= lastWeekStart && gestalt.createdAt < thisWeekStart,
  ).length;

  const phraseMap = new Map<string, {
    phrase: string;
    gestaltId: number | null;
    occurrences: number;
    contexts: Set<string>;
    functions: Map<string, number>;
    meanings: Map<string, number>;
    examples: SnapshotExample[];
    currentCount: number;
    previousCount: number;
  }>();

  const functionCounts = new Map<string, number>();
  for (const occurrence of [...occurrences].sort(
    (left, right) => right.sessionDate.getTime() - left.sessionDate.getTime(),
  )) {
    const key = normalizeKey(occurrence.phrase);
    const item = phraseMap.get(key) ?? {
      phrase: occurrence.phrase,
      gestaltId: occurrence.gestaltId,
      occurrences: 0,
      contexts: new Set<string>(),
      functions: new Map<string, number>(),
      meanings: new Map<string, number>(),
      examples: [],
      currentCount: 0,
      previousCount: 0,
    };
    const count = Math.max(1, occurrence.frequency);
    item.occurrences += count;
    item.gestaltId ??= occurrence.gestaltId;
    if (occurrence.context) item.contexts.add(occurrence.context);
    if (occurrence.communicationFunction) {
      item.functions.set(
        occurrence.communicationFunction,
        (item.functions.get(occurrence.communicationFunction) ?? 0) + count,
      );
      functionCounts.set(
        occurrence.communicationFunction,
        (functionCounts.get(occurrence.communicationFunction) ?? 0) + count,
      );
    }
    if (occurrence.meaning) {
      item.meanings.set(occurrence.meaning, (item.meanings.get(occurrence.meaning) ?? 0) + count);
    }
    if (occurrence.sessionDate >= thisWeekStart && occurrence.sessionDate <= now) {
      item.currentCount += count;
    } else if (occurrence.sessionDate >= lastWeekStart && occurrence.sessionDate < thisWeekStart) {
      item.previousCount += count;
    }
    if (item.examples.length < 4) {
      item.examples.push({
        context: occurrence.context || "Context not documented",
        meaning: occurrence.meaning || "Meaning not documented",
        sessionDate: occurrence.sessionDate.toISOString(),
      });
    }
    phraseMap.set(key, item);
  }

  const totalFunctionCount = [...functionCounts.values()].reduce((sum, count) => sum + count, 0);
  const functionDistribution = [...functionCounts.entries()]
    .sort(([, left], [, right]) => right - left)
    .map(([label, count]) => ({
      label,
      count,
      percentage: totalFunctionCount ? Math.round((count / totalFunctionCount) * 100) : 0,
    }));

  const frequentPhrases = [...phraseMap.values()]
    .sort((left, right) => right.occurrences - left.occurrences || left.phrase.localeCompare(right.phrase))
    .slice(0, 5)
    .map((item) => ({
      phrase: item.phrase,
      gestaltId: item.gestaltId,
      occurrences: item.occurrences,
      contexts: [...item.contexts].slice(0, 5),
      function: [...item.functions.entries()].sort(([, left], [, right]) => right - left)[0]?.[0] ?? "Not documented",
      meaning: [...item.meanings.entries()].sort(([, left], [, right]) => right - left)[0]?.[0] ?? "Meaning not documented",
      trend: trendForChange(item.currentCount, item.previousCount),
      examples: item.examples,
    }));

  const mitigationPattern = /mitigat|flexib|combine|recombin|personaliz|modify|adapt|partial|mix/i;
  const emergingMitigations = frequentPhrases
    .filter((phrase) => mitigationPattern.test(`${phrase.phrase} ${phrase.meaning} ${phrase.function}`))
    .slice(0, 3)
    .map((phrase) => ({
      label: "Possible flexible language pattern",
      phrase: phrase.phrase,
      evidenceCount: phrase.occurrences,
      contexts: phrase.contexts,
    }));

  return {
    totalGestaltsCollected: gestalts.length,
    newGestaltsThisWeek: newThisWeek,
    newGestaltsLastWeek: newLastWeek,
    newGestaltsTrend: trendForChange(newThisWeek, newLastWeek),
    totalReviewedChildUtterances: occurrences.length,
    functionDistribution,
    frequentPhrases,
    emergingMitigations,
    hasEnoughData: gestalts.length > 0 || occurrences.length > 0,
    trendWindowLabel: "Compared with the previous 7 days",
    sessionChange: buildSessionChange(occurrences, childName),
  };
}