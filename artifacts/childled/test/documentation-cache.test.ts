import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  ClinicalDocumentation,
  ClinicalDocumentationList,
} from '@workspace/api-client-react';
import { replaceClinicalDocumentationInList } from '../src/lib/documentation-cache.ts';

const document = {
  id: 7,
  childId: 3,
  sourceSessionId: 11,
  format: 'session_note',
  status: 'draft',
  title: 'Session summary',
  content: {},
  generated: true,
  approvedAt: null,
  approvedBy: null,
  createdAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
} as ClinicalDocumentation;

const list = {
  children: [],
  soapNotes: [],
  documents: [document],
} as ClinicalDocumentationList;

test('keeps saved summary edits when the note is reopened from the rendered list', () => {
  const saved = {
    ...document,
    title: 'Clinician-edited summary',
    generated: false,
    content: { ...document.content, clinicianNotes: 'Reviewed and edited.' },
  } as ClinicalDocumentation;

  const updatedList = replaceClinicalDocumentationInList(list, saved);

  assert.equal(updatedList?.documents[0]?.title, 'Clinician-edited summary');
  assert.equal(updatedList?.documents[0]?.generated, false);
  assert.equal(updatedList?.documents[0]?.content.clinicianNotes, 'Reviewed and edited.');
});

test('shows a finalized summary after switching away and reopening it', () => {
  const finalized = {
    ...document,
    status: 'finalized',
    approvedAt: '2026-09-03T01:00:00.000Z',
    approvedBy: 'Reviewing Clinician',
  } as ClinicalDocumentation;

  const updatedList = replaceClinicalDocumentationInList(list, finalized);

  assert.equal(updatedList?.documents[0]?.status, 'finalized');
  assert.equal(updatedList?.documents[0]?.approvedBy, 'Reviewing Clinician');
});