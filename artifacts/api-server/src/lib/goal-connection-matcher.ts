/** Deterministic lexical relevance only; this never assesses goal outcomes. */
const stopwords = new Set(["the", "and", "for", "with", "that", "this", "from", "into", "using", "use", "goal", "child", "communication", "support", "supports", "session", "review", "reviewed", "context"]);
const tokens = (value: string) => new Set(value.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu)?.filter((token) => !stopwords.has(token)) ?? []);

export const goalSourceIsRelevant = (goal: { title: string; goalArea: string; description: string }, source: { label: string; detail: string }) => {
  const goalTokens = tokens(`${goal.title} ${goal.goalArea} ${goal.description}`);
  const sourceTokens = tokens(`${source.label} ${source.detail}`);
  let overlap = 0;
  for (const token of sourceTokens) if (goalTokens.has(token)) overlap += 1;
  return overlap >= 1;
};