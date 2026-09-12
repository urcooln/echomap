import assert from "node:assert/strict";
import test from "node:test";
import {
  isPublicChildLedApiRequest,
  requireChildLedApiActor,
} from "../src/lib/api-authorization-middleware";

const actor = {
  userId: "user-1",
  author: "SLP One",
  role: "SLP" as const,
  childIds: [11],
  isAdmin: false,
  organizationId: 2,
  accountStatus: "active" as const,
  onboardingComplete: true,
  expiresAt: Date.now() + 60_000,
};

const runBoundary = (request: Record<string, unknown>) => {
  let nextCalled = false;
  let statusCode = 200;
  let body: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  };
  requireChildLedApiActor(
    request as never,
    response as never,
    (() => {
      nextCalled = true;
    }) as never,
  );
  return { nextCalled, statusCode, body };
};

test("only explicit onboarding routes are public", () => {
  assert.equal(
    isPublicChildLedApiRequest("GET", "/invitations/validate"),
    true,
  );
  assert.equal(isPublicChildLedApiRequest("POST", "/invitations/accept"), true);
  assert.equal(isPublicChildLedApiRequest("GET", "/children"), false);
  assert.equal(
    isPublicChildLedApiRequest("POST", "/sessions/transcription"),
    false,
  );
});

test("protected API routes reject missing or failed ChildLed actors", () => {
  assert.equal(
    runBoundary({ method: "POST", path: "/sessions/transcription" }).statusCode,
    401,
  );
  assert.equal(
    runBoundary({
      method: "POST",
      path: "/sessions/transcription",
      childledActor: actor,
      childledAuthFailure: "not_invited",
    }).statusCode,
    403,
  );
});

test("protected API routes continue only for a valid ChildLed actor", () => {
  assert.equal(
    runBoundary({
      method: "POST",
      path: "/sessions/transcription",
      childledActor: actor,
    }).nextCalled,
    true,
  );
});

test("an invited SLP in onboarding can only use viewer and setup routes", () => {
  const onboardingActor = {
    ...actor,
    accountStatus: "onboarding" as const,
    onboardingComplete: false,
  };
  for (const [method, path] of [
    ["GET", "/auth/viewer"],
    ["GET", "/slp-onboarding"],
    ["POST", "/slp-onboarding"],
  ]) {
    assert.equal(
      runBoundary({ method, path, childledActor: onboardingActor }).nextCalled,
      true,
    );
  }
  assert.equal(
    runBoundary({
      method: "POST",
      path: "/sessions/transcription",
      childledActor: onboardingActor,
    }).statusCode,
    403,
  );
  assert.equal(
    runBoundary({
      method: "GET",
      path: "/children",
      childledActor: onboardingActor,
    }).statusCode,
    403,
  );
});

test("an invited actor can acknowledge the required pilot notice", () => {
  for (const [method, path] of [
    ["GET", "/auth/viewer"],
    ["GET", "/beta-notice"],
    ["POST", "/beta-notice/acknowledge"],
  ]) {
    assert.equal(
      runBoundary({
        method,
        path,
        childledActor: actor,
        childledAuthFailure: "beta_notice_unacknowledged",
      }).nextCalled,
      true,
    );
  }
});
