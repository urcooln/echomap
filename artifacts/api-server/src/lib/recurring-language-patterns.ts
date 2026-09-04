export type RecurringPatternEvidence = {
  phraseId: number;
  phrase: string;
  phraseKey: string;
  count: number;
  observedAt: Date;
  settings: string[];
  sessionId: number | null;
  communicationFunction: string | null;
  evidenceType: "dictionary" | "session" | "observation";
};

export type RecurringPatternWindow = "all" | "30d" | "7d";

export type RecurringPatternPhrase = {
  id: number;
  phrase: string;
  observations: number;
  firstObservedAt: string;
  lastObservedAt: string;
  settings: string[];
  communicationFunctions: string[];
  reviewedSessionCount: number;
};

export type RecurringPatternSummary = {
  id: string;
  fragment: string;
  phraseCount: number;
  totalOccurrences: number;
  firstObservedAt: string;
  lastObservedAt: string;
  examplePhrases: string[];
  settings: string[];
  reviewedSessionCount: number;
  environmentCount: number;
  communicationFunctions: string[];
  communicationFunctionCount: number;
  indicators: Array<
    "Repeated Phrase Use"
    | "Appears Across Multiple Phrases"
    | "Appears Across Multiple Settings"
  >;
};

export type RecurringPatternDetail = RecurringPatternSummary & {
  phrases: RecurringPatternPhrase[];
  observations: Array<{
    phraseId: number;
    phrase: string;
    observedAt: string;
    settings: string[];
    sessionId: number | null;
    communicationFunction: string | null;
    evidenceType: "dictionary" | "session" | "observation";
  }>;
};

const stopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "i", "if", "in", "is", "it", "me", "my", "no", "of", "on", "or", "so",
  "the", "to", "we", "with", "you",
]);

const normalizePatternText = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");

const patternIdFor = (fragment: string) => `pattern-${fragment.replace(/\s+/g, "-")}`;

const candidateFragmentsFor = (phrase: string) => {
  const tokens = normalizePatternText(phrase).split(" ").filter(Boolean);
  const fragments = new Set<string>();
  for (let length = 1; length <= Math.min(4, tokens.length); length += 1) {
    for (let start = 0; start <= tokens.length - length; start += 1) {
      const candidate = tokens.slice(start, start + length);
      if (candidate.every((token) => stopWords.has(token))) continue;
      fragments.add(candidate.join(" "));
    }
  }
  return fragments;
};

const orderedUnique = (values: string[]) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));

export const filterRecurringPatternEvidence = (
  evidence: RecurringPatternEvidence[],
  window: RecurringPatternWindow,
  now: Date,
) => {
  if (window === "all") return evidence;
  const cutoff = new Date(now.getTime() - (window === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000);
  return evidence.filter((item) => item.observedAt >= cutoff);
};

/**
 * Builds observational recurring fragments from already-authorized, verified
 * Child evidence. It intentionally requires at least two distinct phrases and
 * never treats a stopword-only overlap as a pattern.
 */
export const buildRecurringLanguagePatterns = (
  evidence: RecurringPatternEvidence[],
): { summaries: RecurringPatternSummary[]; details: RecurringPatternDetail[] } => {
  const byFragment = new Map<string, Set<string>>();
  const evidenceByPhrase = new Map<string, RecurringPatternEvidence[]>();

  for (const item of evidence) {
    const phraseEvidence = evidenceByPhrase.get(item.phraseKey) ?? [];
    phraseEvidence.push(item);
    evidenceByPhrase.set(item.phraseKey, phraseEvidence);
    for (const fragment of candidateFragmentsFor(item.phrase)) {
      const phraseKeys = byFragment.get(fragment) ?? new Set<string>();
      phraseKeys.add(item.phraseKey);
      byFragment.set(fragment, phraseKeys);
    }
  }

  const selectedFragments: Array<[string, Set<string>]> = [];
  const eligibleFragments = [...byFragment.entries()]
    .filter(([, phraseKeys]) => phraseKeys.size >= 2)
    .sort(([left], [right]) =>
      right.split(" ").length - left.split(" ").length
      || left.localeCompare(right),
    );
  for (const entry of eligibleFragments) {
    const [fragment, phraseKeys] = entry;
    const signature = [...phraseKeys].sort().join("|");
    const isRedundant = selectedFragments.some(([selected, selectedPhraseKeys]) =>
      [...selectedPhraseKeys].sort().join("|") === signature
      && ` ${selected} `.includes(` ${fragment} `),
    );
    if (!isRedundant) selectedFragments.push(entry);
  }

  const details: RecurringPatternDetail[] = [];
  for (const [fragment, phraseKeys] of selectedFragments) {
    const matchingEvidence = [...phraseKeys].flatMap((phraseKey) => evidenceByPhrase.get(phraseKey) ?? []);
    if (!matchingEvidence.length) continue;

    const dates = matchingEvidence
      .map((item) => item.observedAt)
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((left, right) => left.getTime() - right.getTime());
    if (!dates.length) continue;

    const phraseDetails = [...phraseKeys]
      .map((phraseKey) => {
        const phraseEvidence = evidenceByPhrase.get(phraseKey) ?? [];
        const phraseDates = phraseEvidence
          .map((item) => item.observedAt)
          .filter((date) => !Number.isNaN(date.getTime()))
          .sort((left, right) => left.getTime() - right.getTime());
        const first = phraseEvidence[0];
        if (!first || !phraseDates.length) return null;
        return {
          id: first.phraseId,
          phrase: first.phrase,
          observations: phraseEvidence.reduce((total, item) => total + Math.max(1, item.count), 0),
          firstObservedAt: phraseDates[0]!.toISOString(),
          lastObservedAt: phraseDates.at(-1)!.toISOString(),
          settings: orderedUnique(phraseEvidence.flatMap((item) => item.settings)),
          communicationFunctions: orderedUnique(
            phraseEvidence.map((item) => item.communicationFunction ?? ""),
          ),
          reviewedSessionCount: new Set(
            phraseEvidence
              .map((item) => item.sessionId)
              .filter((sessionId): sessionId is number => sessionId !== null),
          ).size,
        };
      })
      .filter((phrase): phrase is RecurringPatternPhrase => phrase !== null)
      .sort((left, right) => left.phrase.localeCompare(right.phrase));
    if (phraseDetails.length < 2) continue;

    const settings = orderedUnique(matchingEvidence.flatMap((item) => item.settings));
    const communicationFunctions = orderedUnique(
      matchingEvidence.map((item) => item.communicationFunction ?? ""),
    );
    const totalOccurrences = matchingEvidence.reduce(
      (total, item) => total + Math.max(1, item.count),
      0,
    );
    const indicators: RecurringPatternSummary["indicators"] = [];
    if (totalOccurrences > phraseDetails.length) indicators.push("Repeated Phrase Use");
    indicators.push("Appears Across Multiple Phrases");
    if (settings.length > 1) indicators.push("Appears Across Multiple Settings");

    const summary: RecurringPatternSummary = {
      id: patternIdFor(fragment),
      fragment,
      phraseCount: phraseDetails.length,
      totalOccurrences,
      firstObservedAt: dates[0]!.toISOString(),
      lastObservedAt: dates.at(-1)!.toISOString(),
      examplePhrases: phraseDetails.slice(0, 3).map((phrase) => phrase.phrase),
      settings,
      reviewedSessionCount: new Set(
        matchingEvidence
          .map((item) => item.sessionId)
          .filter((sessionId): sessionId is number => sessionId !== null),
      ).size,
      environmentCount: settings.length,
      communicationFunctions,
      communicationFunctionCount: communicationFunctions.length,
      indicators,
    };

    details.push({
      ...summary,
      phrases: phraseDetails,
      observations: [...matchingEvidence]
        .sort((left, right) => right.observedAt.getTime() - left.observedAt.getTime())
        .map((item) => ({
          phraseId: item.phraseId,
          phrase: item.phrase,
          observedAt: item.observedAt.toISOString(),
          settings: orderedUnique(item.settings),
          sessionId: item.sessionId,
          communicationFunction: item.communicationFunction,
          evidenceType: item.evidenceType,
        })),
    });
  }

  details.sort((left, right) =>
    right.totalOccurrences - left.totalOccurrences
    || right.phraseCount - left.phraseCount
    || right.lastObservedAt.localeCompare(left.lastObservedAt)
    || left.fragment.localeCompare(right.fragment),
  );
  return { summaries: details.map(({ phrases: _phrases, observations: _observations, ...summary }) => summary), details };
};