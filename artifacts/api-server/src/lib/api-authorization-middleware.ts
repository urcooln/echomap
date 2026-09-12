import type { NextFunction, Request, Response } from "express";

const publicApiRoutes = new Set([
  "GET /invitations/validate",
  "POST /invitations/accept",
  "POST /beta-access-requests",
  "POST /development/login",
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

export const isPublicChildLedApiRequest = (method: string, path: string) =>
  publicApiRoutes.has(`${method.toUpperCase()} ${path}`);

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
    request.childledActor?.role === "SLP" &&
    request.childledActor.onboardingComplete === false
  ) {
    if (slpOnboardingRoutes.has(routeKey) && !request.childledAuthFailure) {
      return next();
    }
    return response.status(403).json({
      error: "Complete SLP account setup before accessing ChildLed resources.",
    });
  }
  if (
    invitedOnboardingRoutes.has(routeKey) &&
    request.childledActor &&
    (!request.childledAuthFailure ||
      request.childledAuthFailure === "beta_notice_unacknowledged")
  ) {
    return next();
  }

  if (request.childledActor && !request.childledAuthFailure) return next();

  const status = request.childledAuthFailure ? 403 : 401;
  return response.status(status).json({
    error:
      status === 401
        ? "Please sign in to access ChildLed."
        : "This account does not have active ChildLed access.",
  });
};
