import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { teacherWorkspaceSections } from '../src/lib/teacher-workspace-navigation.ts';

test('keeps every Teacher workspace section in the sticky navigation contract', async () => {
  assert.deepEqual(teacherWorkspaceSections, [
    ['student-overview', 'Overview'],
    ['phrase-dictionary', 'Phrase Dictionary'],
    ['shared-moments', 'Shared Moments'],
    ['team-notes', 'Team Notes'],
    ['aac-information', 'AAC Info'],
    ['communication-profile', 'Communication Profile'],
    ['classroom-supports', 'Classroom Supports'],
  ]);

  const portalSource = await readFile(
    new URL('../src/components/role-portals.tsx', import.meta.url),
    'utf8',
  );
  for (const [id] of teacherWorkspaceSections) {
    assert.match(portalSource, new RegExp(`id=["']${id}["']`));
  }
  assert.match(portalSource, /data-testid="teacher-student-sticky-navigation"/);
  assert.match(portalSource, /aria-current=\{active \? 'location' : undefined\}/);
});