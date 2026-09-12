import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";
import {
  developmentDemoPersonaActor,
  effectiveViewerFromRequest,
  ROLE_PREVIEW_COOKIE,
} from "../src/lib/role-preview";

const demoOwner: ResolvedCareTeamActor = {
  userId: "demo-admin",
  author: "Demo Administrator",
  role: "Administrator",
  childIds: [1, 2],
  isAdmin: true,
  isSuperAdmin: true,
  isDevelopmentDemo: true,
  organizationId: 10,
  expiresAt: Date.now() + 60_000,
  developmentDemoPersonas: {
    Administrator: {
      userId: "demo-admin",
      author: "Demo Administrator",
      role: "Administrator",
      childIds: [1, 2],
      isAdmin: true,
    },
    SLP: {
      userId: "demo-slp",
      author: "Dr. Lena Ortiz",
      role: "SLP",
      childIds: [1],
      isAdmin: false,
    },
    Teacher: {
      userId: "demo-teacher",
      author: "Jordan Blake",
      role: "Teacher",
      childIds: [1],
      isAdmin: false,
    },
    Parent: {
      userId: "demo-parent",
      author: "Maya Chen",
      role: "Parent",
      childIds: [1],
      isAdmin: false,
    },
  },
};

test("development role preview resolves the selected seeded identity and scope", () => {
  const teacher = developmentDemoPersonaActor(demoOwner, "Teacher");
  assert.ok(teacher);
  assert.equal(teacher.userId, "demo-teacher");
  assert.equal(teacher.author, "Jordan Blake");
  assert.equal(teacher.role, "Teacher");
  assert.deepEqual(teacher.childIds, [1]);
  assert.equal(teacher.isAdmin, false);
  assert.equal(teacher.previewRole, "Teacher");
  assert.equal(teacher.isSuperAdmin, true);
});

test("effective viewer applies the signed preview role to the full persona", () => {
  const request = {
    childledActor: demoOwner,
    signedCookies: { [ROLE_PREVIEW_COOKIE]: "Parent" },
  } as unknown as Request;
  const parent = effectiveViewerFromRequest(request);
  assert.ok(parent);
  assert.equal(parent.userId, "demo-parent");
  assert.equal(parent.author, "Maya Chen");
  assert.equal(parent.role, "Parent");
  assert.deepEqual(parent.childIds, [1]);
});

test("a real Clerk super admin cannot activate a development persona", () => {
  const realActor: ResolvedCareTeamActor = {
    ...demoOwner,
    userId: "clerk-user",
    author: "Real Administrator",
    isDevelopmentDemo: false,
  };
  const request = {
    childledActor: realActor,
    signedCookies: { [ROLE_PREVIEW_COOKIE]: "SLP" },
  } as unknown as Request;
  const viewer = effectiveViewerFromRequest(request);
  assert.equal(viewer?.userId, "clerk-user");
  assert.equal(viewer?.author, "Real Administrator");
  assert.equal(viewer?.role, "Administrator");
  assert.equal(viewer?.previewRole, undefined);
  assert.equal(developmentDemoPersonaActor(realActor, "SLP"), null);
});
