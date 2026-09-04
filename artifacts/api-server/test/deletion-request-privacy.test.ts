import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";
import {
  canListDeletionRequest,
  canReviewDeletionRequest,
  canViewDeletionRequest,
  type DeletionRequestAccessRecord,
} from "../src/lib/deletion-request-authorization";

const requester: ResolvedCareTeamActor = {
  userId: "parent-oliver",
  author: "Maya Chen",
  role: "Parent",
  childIds: [101],
  isAdmin: false,
  organizationId: 7,
  expiresAt: Date.now() + 60_000,
};
const otherChildRequester: ResolvedCareTeamActor = {
  ...requester,
  userId: "parent-other",
  author: "Jordan Blake",
  childIds: [202],
};
const otherChildRequest: DeletionRequestAccessRecord = {
  childId: 202,
  requesterUserId: "parent-other",
};
const requesterChildRequest: DeletionRequestAccessRecord = {
  childId: 101,
  requesterUserId: "parent-oliver",
};
const anotherRequesterForSameChild: DeletionRequestAccessRecord = {
  childId: 101,
  requesterUserId: "parent-other",
};
const staffReviewer: ResolvedCareTeamActor = {
  ...requester,
  userId: "slp-oliver",
  author: "Dr. Lena Ortiz",
  role: "SLP",
};
const administrator: ResolvedCareTeamActor = {
  ...requester,
  userId: "admin-oliver",
  author: "Alex Morgan",
  role: "Administrator",
  isAdmin: true,
};

test("unauthenticated users cannot list or inspect deletion requests", () => {
  assert.equal(canListDeletionRequest(undefined, requesterChildRequest), false);
  assert.equal(canViewDeletionRequest(undefined, requesterChildRequest), false);
  assert.equal(
    canReviewDeletionRequest(undefined, requesterChildRequest),
    false,
  );
  assert.equal(
    canViewDeletionRequest(
      { ...requester, expiresAt: Date.now() - 1 },
      requesterChildRequest,
    ),
    false,
  );
});

test("request access is scoped to an assigned child", () => {
  assert.equal(
    canListDeletionRequest(otherChildRequester, otherChildRequest),
    true,
  );
  assert.equal(canListDeletionRequest(requester, otherChildRequest), false);
  assert.equal(canViewDeletionRequest(requester, otherChildRequest), false);
  assert.equal(
    canReviewDeletionRequest(staffReviewer, otherChildRequest),
    false,
  );
});

test("non-requesters cannot list or inspect another requester’s request", () => {
  assert.equal(
    canListDeletionRequest(requester, anotherRequesterForSameChild),
    false,
  );
  assert.equal(
    canViewDeletionRequest(requester, anotherRequesterForSameChild),
    false,
  );
});

test("only an assigned SLP can review a deletion request", () => {
  assert.equal(
    canReviewDeletionRequest(staffReviewer, requesterChildRequest),
    true,
  );
  assert.equal(
    canReviewDeletionRequest(requester, requesterChildRequest),
    false,
  );
  assert.equal(
    canReviewDeletionRequest(administrator, requesterChildRequest),
    false,
  );
});

test("deletion request lists expose only the authorized requester or assigned SLP", () => {
  const requests = [
    { id: 1, ...requesterChildRequest },
    { id: 2, ...anotherRequesterForSameChild },
    { id: 3, ...otherChildRequest },
  ];

  assert.deepEqual(
    requests
      .filter((request) => canListDeletionRequest(requester, request))
      .map((request) => request.id),
    [1],
  );
  assert.deepEqual(
    requests
      .filter((request) => canListDeletionRequest(staffReviewer, request))
      .map((request) => request.id),
    [1, 2],
  );
});

test("audit history visibility follows the same request authorization boundary", () => {
  const audit = [{ id: 91, action: "request_submitted" }];

  assert.deepEqual(
    canViewDeletionRequest(requester, requesterChildRequest) ? audit : [],
    audit,
  );
  assert.deepEqual(
    canViewDeletionRequest(staffReviewer, requesterChildRequest) ? audit : [],
    audit,
  );
  assert.deepEqual(
    canViewDeletionRequest(requester, anotherRequesterForSameChild)
      ? audit
      : [],
    [],
  );
  assert.deepEqual(
    canViewDeletionRequest(requester, otherChildRequest) ? audit : [],
    [],
  );
  assert.deepEqual(
    canViewDeletionRequest(undefined, requesterChildRequest) ? audit : [],
    [],
  );
});

test("processed observation deletion removes typed phrase-observation evidence", () => {
  const routeSource = readFileSync(
    join(process.cwd(), "src/routes/echomap.ts"),
    "utf8",
  );

  assert.match(
    routeSource,
    /if \(selected\.has\("observations"\)\) \{[\s\S]*?await db\.delete\(legacyPhraseObservationRecoveriesTable\)\.where\(eq\(legacyPhraseObservationRecoveriesTable\.childId, request\.childId\)\);[\s\S]*?await db\.delete\(phraseObservationsTable\)\.where\(eq\(phraseObservationsTable\.childId, request\.childId\)\);/,
  );
});
