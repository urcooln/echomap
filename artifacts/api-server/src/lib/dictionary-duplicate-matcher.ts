import { matchPhraseKey, normalizePhrase } from "./phrase-identity";

export const duplicateSuggestionReasonValues = [
  "exact",
  "capitalization",
  "punctuation",
  "whitespace",
  "minor_spelling",
] as const;

export type DuplicateSuggestionReason = (typeof duplicateSuggestionReasonValues)[number];

export type DuplicatePhraseMatch = {
  reason: DuplicateSuggestionReason;
  score: number;
  reasonLabel: string;
};

const editDistance = (left: string, right: string) => {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => index);
  for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
    let diagonal = rows[0]!;
    rows[0] = rightIndex;
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const previous = rows[leftIndex]!;
      rows[leftIndex] = Math.min(
        rows[leftIndex]! + 1,
        rows[leftIndex - 1]! + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = previous;
    }
  }
  return rows[left.length]!;
};

const words = (value: string) => normalizePhrase(value).split(" ").filter(Boolean);

const reasonLabel: Record<DuplicateSuggestionReason, string> = {
  exact: "Exact duplicate",
  capitalization: "Capitalization difference",
  punctuation: "Punctuation difference",
  whitespace: "Whitespace difference",
  minor_spelling: "Minor spelling difference",
};

export const duplicatePhraseMatch = (leftPhrase: string, rightPhrase: string): DuplicatePhraseMatch | null => {
  const leftTrimmed = leftPhrase.trim();
  const rightTrimmed = rightPhrase.trim();
  if (!leftTrimmed || !rightTrimmed) return null;

  let reason: DuplicateSuggestionReason | undefined;
  if (leftTrimmed === rightTrimmed) {
    reason = "exact";
  } else if (leftTrimmed.toLocaleLowerCase() === rightTrimmed.toLocaleLowerCase()) {
    reason = "capitalization";
  } else if (normalizePhrase(leftTrimmed) === normalizePhrase(rightTrimmed)) {
    const withoutWhitespaceLeft = leftTrimmed.replace(/\s+/g, "");
    const withoutWhitespaceRight = rightTrimmed.replace(/\s+/g, "");
    reason = withoutWhitespaceLeft.toLocaleLowerCase() === withoutWhitespaceRight.toLocaleLowerCase()
      ? "whitespace"
      : "punctuation";
  }

  const leftKey = matchPhraseKey(leftTrimmed);
  const rightKey = matchPhraseKey(rightTrimmed);
  if (!leftKey || !rightKey) return null;
  if (!reason) {
    const leftWords = words(leftTrimmed);
    const rightWords = words(rightTrimmed);
    if (leftWords.length !== rightWords.length || leftWords.length === 0) return null;
    const tokenDistances = leftWords.map((word, index) => editDistance(word, rightWords[index]!));
    const totalDistance = tokenDistances.reduce((sum, distance) => sum + distance, 0);
    const maximumEdits = leftKey.length <= 6 ? 1 : Math.min(2, Math.floor(leftKey.length * 0.16));
    if (
      totalDistance === 0
      || totalDistance > maximumEdits
      || tokenDistances.some((distance) => distance > 1)
      || Math.abs(leftKey.length - rightKey.length) > maximumEdits
    ) return null;
    reason = "minor_spelling";
  }

  const distance = editDistance(leftKey, rightKey);
  return {
    reason,
    score: Number((1 - distance / Math.max(leftKey.length, rightKey.length, 1)).toFixed(3)),
    reasonLabel: reasonLabel[reason],
  };
};

export const isConservativeDuplicate = (leftPhrase: string, rightPhrase: string) =>
  duplicatePhraseMatch(leftPhrase, rightPhrase) !== null;