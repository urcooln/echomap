export interface TeacherPhraseReviewFields {
  source: string;
  meaning: string;
  function: string;
}

export function isTeacherReviewedPhrase(phrase: TeacherPhraseReviewFields): boolean {
  return !phrase.source.toLocaleLowerCase().includes('review pending')
    && !phrase.meaning.toLocaleLowerCase().includes('awaiting clinician review')
    && phrase.function !== 'Not yet reviewed';
}