import type { ResolvedCareTeamActor } from "./auth-context";
import { hasVerifiedCareTeamSession } from "./auth-authorization";

export type DeletionRequestAccessRecord = {
  childId: number;
  requesterUserId: string;
};

export const canViewDeletionRequest = (
  actor: ResolvedCareTeamActor | undefined,
  request: DeletionRequestAccessRecord,
) => {
  if (!actor || !hasVerifiedCareTeamSession(actor)) return false;
  return (
    actor.childIds.includes(request.childId) &&
    (actor.role === "SLP" || actor.userId === request.requesterUserId)
  );
};

export const canReviewDeletionRequest = (
  actor: ResolvedCareTeamActor | undefined,
  request: DeletionRequestAccessRecord,
) => {
  if (!actor || !hasVerifiedCareTeamSession(actor)) return false;
  return actor.role === "SLP" && actor.childIds.includes(request.childId);
};

export const canListDeletionRequest = (
  actor: ResolvedCareTeamActor | undefined,
  request: DeletionRequestAccessRecord,
) => canViewDeletionRequest(actor, request);
