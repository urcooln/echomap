import type { NextFunction, Request, Response } from "express";
import type { ChildLedAuthFailure } from "./auth-context";

const publicApiRoutes = new Set([
  "GET /invitations/validate",
  "POST /invitations/accept",
  "POST /beta-access-requests",
  "POST /development/login",
  "POST /development/logout",
]);

const invitedOnboardingRoutes = new Set([
  "GET /auth/viewer",
  "GET /beta-notice",
  "POST /beta-notice/acknowledge",
]);

const slpOnboardingRoutes = new Set([
  "GET /auth/viewer",
  "GET /slp-onboarding",
  "POST /slp-onboarding",
]);

const careTeamOnboardingRoutes = new Set([
  "GET /auth/viewer",
  "GET /care-team-onboarding",
  "POST /care-team-onboarding",
]);

export const isPublicChildLedApiRequest = (method: string, path: string) =>
  publicApiRoutes.has(`${method.toUpperCase()} ${path}`);

export const childLedAccessFailure = (
  failure: ChildLedAuthFailure | undefined,
) => {
  switch (failure) {
    case "email_unverified":
      return {
        code: failure,
        error: "Verify your email address before accessing ChildLed.",
      };
    case "not_invited":
      return {
        code: failure,
        error:
          "Your Clerk sign-in succeeded, but this account is not connected to an active ChildLed invitation.",
      };
    case "access_disabled":
      return {
        code: failure,
        error: "This ChildLed account or organization is not currently active.",
      };
    case "beta_notice_unacknowledged":
      return {
        code: failure,
        error:
          "Accept the ChildLed Beta Participation & Confidentiality Agreement to continue.",
      };
    case "session_invalid":
      return {
        code: failure,
        error: "We could not verify your session. Please sign in again.",
      };
    default:
      return {
        code: "authentication_required",
        error: "Please sign in to access ChildLed.",
      };
  }
};

/**
 * Default-deny boundary for the ChildLed API. Route handlers still enforce
 * child/resource ownership and role-specific operations after this check.
 */
export const requireChildLedApiActor = (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  if (isPublicChildLedApiRequest(request.method, request.path)) return next();

  const routeKey = `${request.method.toUpperCase()} ${request.path}`;
  if (
    invitedOnboardingRoutes.has(routeKey) &&
    request.childledActor &&
    (!request.childledAuthFailure ||
      request.childledAuthFailure === "beta_notice_unacknowledged")
  ) {
    return next();
  }
  if (request.childledActor?.onboardingComplete === false) {
    const allowedRoutes =
      request.childledActor.role === "SLP"
        ? slpOnboardingRoutes
        : request.childledActor.role === "Parent" ||
            request.childledActor.role === "Teacher"
          ? careTeamOnboardingRoutes
          : new Set<string>();
    if (allowedRoutes.has(routeKey) && !request.childledAuthFailure) {
      return next();
    }
    return response.status(403).json({
      error: "Complete account setup before accessing ChildLed resources.",
    });
  }
  if (request.childledActor && !request.childledAuthFailure) return next();

  const status = request.childledAuthFailure ? 403 : 401;
  return response
    .status(status)
    .json(childLedAccessFailure(request.childledAuthFailure));
};
