import assert from 'node:assert/strict';
import test from 'node:test';
import { isTeacherReviewedPhrase } from '../src/lib/teacher-phrase-safety.ts';

const reviewedPhrase = {
  source: 'Clinician review',
  meaning: 'The activity is finished',
  function: 'Protest',
};

test('teacher dictionary includes only fully reviewed phrases', () => {
  assert.equal(isTeacherReviewedPhrase(reviewedPhrase), true);
  assert.equal(isTeacherReviewedPhrase({ ...reviewedPhrase, source: 'Teacher observation — review pending' }), false);
  assert.equal(isTeacherReviewedPhrase({ ...reviewedPhrase, meaning: 'Awaiting clinician review' }), false);
  assert.equal(isTeacherReviewedPhrase({ ...reviewedPhrase, function: 'Not yet reviewed' }), false);
});