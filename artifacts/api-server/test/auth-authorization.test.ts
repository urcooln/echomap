import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessAssignedChild,
  canContributeSharedChildContext,
  canManageClinicalData,
  canSubmitDictionaryPhrase,
  hasVerifiedEmailAddress,
  hasVerifiedCareTeamSession,
  isPreviewableRole,
  isSuperAdminIdentity,
} from "../src/lib/auth-authorization";

const parent = {
  userId: "member-1",
  author: "Parent Person",
  role: "Parent" as const,
  childIds: [11],
  isAdmin: false,
  organizationId: 1,
  expiresAt: Date.now() + 60_000,
};

test("unauthenticated and expired sessions cannot use protected child data", () => {
  assert.equal(hasVerifiedCareTeamSession(undefined, 9_000), false);
  assert.equal(hasVerifiedCareTeamSession({ ...parent, expiresAt: 9_000 }, 9_000), false);
  assert.equal(canAccessAssignedChild({ ...parent, expiresAt: 9_000 }, 11), false);
});

test("child access is limited to explicitly assigned memberships", () => {
  assert.equal(canAccessAssignedChild(parent, 11), true);
  assert.equal(canAccessAssignedChild(parent, 12), false);
  assert.equal(canAccessAssignedChild({ ...parent, role: "Administrator" }, 12), false);
});

test("a Clerk account needs a verified email before its local profile is considered", () => {
  assert.equal(hasVerifiedEmailAddress([{ verification: { status: "unverified" } }]), false);
  assert.equal(hasVerifiedEmailAddress([{ verification: { status: "verified" } }]), true);
});

test("only SLPs can use clinical authoring routes", () => {
  assert.equal(canManageClinicalData("SLP"), true);
  assert.equal(canManageClinicalData("Parent"), false);
  assert.equal(canManageClinicalData("Teacher"), false);
  assert.equal(canManageClinicalData("Administrator"), false);
});

test("SLPs, parents, and teachers can submit shared dictionary phrases", () => {
  assert.equal(canSubmitDictionaryPhrase("SLP"), true);
  assert.equal(canSubmitDictionaryPhrase("Parent"), true);
  assert.equal(canSubmitDictionaryPhrase("Teacher"), true);
  assert.equal(canSubmitDictionaryPhrase("Administrator"), false);
});

test("SLPs, parents, and teachers can contribute shared child context", () => {
  assert.equal(canContributeSharedChildContext("SLP"), true);
  assert.equal(canContributeSharedChildContext("Parent"), true);
  assert.equal(canContributeSharedChildContext("Teacher"), true);
  assert.equal(canContributeSharedChildContext("Administrator"), false);
});

test("Super Admin capability is limited to explicit owners and the enabled demo", () => {
  assert.equal(isSuperAdminIdentity({ userId: "owner-1", isAdmin: true, configuredUserIds: "owner-1, owner-2" }), true);
  assert.equal(isSuperAdminIdentity({ userId: "admin-1", isAdmin: true, configuredUserIds: "owner-1" }), false);
  assert.equal(isSuperAdminIdentity({ userId: "owner-1", isAdmin: false, configuredUserIds: "owner-1" }), false);
  assert.equal(isSuperAdminIdentity({ userId: "local-demo", isAdmin: true, isDevelopmentDemo: true }), true);
});

test("only supported care-team roles may be selected for an owner preview", () => {
  assert.equal(isPreviewableRole("SLP"), true);
  assert.equal(isPreviewableRole("Parent"), true);
  assert.equal(isPreviewableRole("Teacher"), true);
  assert.equal(isPreviewableRole("Administrator"), true);
  assert.equal(isPreviewableRole("Super Admin"), false);
  assert.equal(isPreviewableRole(""), false);
});
