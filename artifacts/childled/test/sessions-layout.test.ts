import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('lets the full Session Hub scroll while preserving active workflow controls', async () => {
  const appSource = await readFile(
    new URL('../src/App.tsx', import.meta.url),
    'utf8',
  );
  const heroTestId = appSource.indexOf('data-testid="recording-hero"');

  assert.notEqual(heroTestId, -1);
  const heroStart = appSource.lastIndexOf('<section', heroTestId);
  const heroEnd = appSource.indexOf('>', heroTestId);
  const heroOpeningTag = appSource.slice(heroStart, heroEnd + 1);

  assert.doesNotMatch(heroOpeningTag, /\b(?:sticky|fixed)\b/);
  assert.match(
    appSource,
    /data-testid="recording-workflow-progress"/,
  );
  assert.match(appSource, /data-testid="button-pause-recording"/);
  assert.match(appSource, /data-testid="button-stop-recording"/);
});
