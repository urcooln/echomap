import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

import {
  authLogoutStorageKey,
  authReturnPathFor,
  authReturnPathStorageKey,
  consumeAuthLogout,
  consumeAuthReturnPath,
  markAuthLogout,
  rememberAuthReturnPath,
  roleOverviewPath,
} from '../src/lib/role-routing.ts';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

const sessionStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { sessionStorage },
});

beforeEach(() => {
  sessionStorage.clear();
});

describe('role-specific overview routing', () => {
  test('maps every supported care-team role to its canonical Overview', () => {
    assert.deepEqual(
      {
        SLP: roleOverviewPath('SLP'),
        Parent: roleOverviewPath('Parent'),
        Teacher: roleOverviewPath('Teacher'),
        Administrator: roleOverviewPath('Administrator'),
      },
      {
        SLP: '/overview',
        Parent: '/family-overview',
        Teacher: '/teacher-overview',
        Administrator: '/admin-overview',
      },
    );
  });

  test('keeps explicit future clinical roles out of unrelated portals', () => {
    assert.equal(roleOverviewPath('OT'), '/ot-overview');
    assert.equal(roleOverviewPath('PT'), '/pt-overview');
    assert.equal(roleOverviewPath('BCBA'), '/bcba-overview');
    assert.equal(roleOverviewPath('Unknown'), undefined);
  });
});

describe('protected login return paths', () => {
  test('preserves a child-profile deep link and its childId query once', () => {
    const deepLink = '/children?childId=42';

    assert.equal(authReturnPathFor(deepLink), deepLink);
    rememberAuthReturnPath(deepLink);
    assert.equal(sessionStorage.getItem(authReturnPathStorageKey), deepLink);
    assert.equal(consumeAuthReturnPath(), deepLink);
    assert.equal(consumeAuthReturnPath(), undefined);
  });

  test('does not remember sign-in, root, overview, or external destinations', () => {
    assert.equal(authReturnPathFor('/'), undefined);
    assert.equal(authReturnPathFor('/overview'), undefined);
    assert.equal(authReturnPathFor('/family-overview?childId=42'), undefined);
    assert.equal(authReturnPathFor('/sign-in'), undefined);
    assert.equal(authReturnPathFor('//outside.example/children'), undefined);
    assert.equal(authReturnPathFor('https://outside.example/children'), undefined);
  });

  test('logout clears a pending deep link before the next login', () => {
    rememberAuthReturnPath('/children?childId=42');
    markAuthLogout();

    assert.equal(sessionStorage.getItem(authReturnPathStorageKey), null);
    assert.equal(sessionStorage.getItem(authLogoutStorageKey), 'true');
    assert.equal(consumeAuthLogout(), true);
    assert.equal(consumeAuthLogout(), false);
    assert.equal(consumeAuthReturnPath(), undefined);
  });
});