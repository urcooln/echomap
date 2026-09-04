import type { Request } from "express";
import type { CareTeamRole, ResolvedCareTeamActor } from "./auth-context";
import {
  hasVerifiedCareTeamSession,
  isPreviewableRole,
  type PreviewableRole,
} from "./auth-authorization";

export const ROLE_PREVIEW_COOKIE = "echomap_role_preview";

const previewRoleFromRequest = (request: Request): PreviewableRole | undefined => {
  const value = request.signedCookies?.[ROLE_PREVIEW_COOKIE];
  return isPreviewableRole(value) ? value : undefined;
};

export const realViewerFromRequest = (request: Request): ResolvedCareTeamActor | null => {
  const actor = request.echomapActor;
  return hasVerifiedCareTeamSession(actor) && actor?.organizationId ? actor : null;
};

/**
 * Applies only a server-issued preview cookie, and only after the real actor
 * has already been authenticated as a Super Admin. The preview changes
 * effective authorization, while preserving the owner capability separately.
 */
export const effectiveViewerFromRequest = (request: Request): ResolvedCareTeamActor | null => {
  const actor = realViewerFromRequest(request);
  if (!actor) return null;
  const previewRole = actor.isSuperAdmin ? previewRoleFromRequest(request) : undefined;
  if (!previewRole) return actor;

  return {
    ...actor,
    role: previewRole as CareTeamRole,
    isAdmin: previewRole === "Administrator",
    previewRole,
  };
};
