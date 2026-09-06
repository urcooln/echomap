import assert from 'node:assert/strict';
import test from 'node:test';
import { formatGoalConnectionsForExport } from '../src/lib/goal-connection-export.ts';

test('exports the immutable goal snapshot stored with a finalized connection', () => {
  const text = formatGoalConnectionsForExport([{
    goalId: 14,
    goalTitle: 'Request help during transitions',
    goalArea: 'Self advocacy',
    goalVersion: 3,
    sourceKind: 'dictionary_phrase',
    sourceId: 22,
    sourceLabel: 'Reviewed dictionary phrase',
    sourceDetail: '“Help please” · Requests assistance',
    evidenceClass: 'reviewed_clinical_evidence',
    included: true,
  }]);

  assert.match(text, /Request help during transitions/);
  assert.match(text, /Reviewed dictionary phrase/);
  assert.doesNotMatch(text, /Goal #14/);
});