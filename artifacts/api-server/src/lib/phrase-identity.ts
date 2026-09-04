/**
 * Database-normalized phrase text preserves word boundaries for display and
 * diagnostics. The matching key intentionally removes those boundaries too,
 * so legacy values such as "blast off!" and "blast off" identify one phrase.
 */
export const normalizePhrase = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");

export const matchPhraseKey = (value: string) =>
  normalizePhrase(value).replace(/\s+/g, "");