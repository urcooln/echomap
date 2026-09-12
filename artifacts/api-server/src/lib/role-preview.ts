import type { Request } from "express";
import type { ResolvedCareTeamActor } from "./auth-context";
import {
  hasVerifiedCareTeamSession,
  isPreviewableRole,
  type PreviewableRole,
} from "./auth-authorization";

export const ROLE_PREVIEW_COOKIE = "childled_role_preview";

const previewRoleFromRequest = (request: Request): PreviewableRole | undefined => {
  const value = request.signedCookies?.[ROLE_PREVIEW_COOKIE];
  return isPreviewableRole(value) ? value : undefined;
};

export const realViewerFromRequest = (request: Request): ResolvedCareTeamActor | null => {
  const actor = request.childledActor;
  return hasVerifiedCareTeamSession(actor) && actor?.organizationId ? actor : null;
};

export const developmentDemoPersonaActor = (
  actor: ResolvedCareTeamActor,
  role: PreviewableRole,
): ResolvedCareTeamActor | null => {
  if (!actor.isDevelopmentDemo || !actor.isSuperAdmin) return null;
  const persona = actor.developmentDemoPersonas?.[role];
  if (!persona) return null;
  return {
    ...actor,
    ...persona,
    previewRole: role,
  };
};

/**
 * Resolves a server-issued preview cookie to a seeded identity only after the
 * dedicated development demo session has been authenticated. Real Clerk users
 * never receive an alternate persona, even if a preview cookie is present.
 */
export const effectiveViewerFromRequest = (request: Request): ResolvedCareTeamActor | null => {
  const actor = realViewerFromRequest(request);
  if (!actor) return null;
  const previewRole =
    actor.isSuperAdmin && actor.isDevelopmentDemo
      ? previewRoleFromRequest(request)
      : undefined;
  if (!previewRole) return actor;
  return developmentDemoPersonaActor(actor, previewRole) ?? actor;
};
