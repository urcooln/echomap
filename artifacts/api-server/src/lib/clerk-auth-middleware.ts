import type { NextFunction, Request, Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { and, eq, isNull } from "drizzle-orm";
import {
  childCareTeamMembershipsTable,
  childProfilesTable,
  betaControlsTable,
  betaNoticeAcknowledgementsTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  usersTable,
} from "@workspace/db";
import { isPortableRole, type PortableRole } from "./identity";
import { logger } from "./logger";
import { hasVerifiedEmailAddress, isSuperAdminIdentity } from "./auth-authorization";

const roleMap: Record<PortableRole, "SLP" | "Parent" | "Teacher" | "Administrator"> = {
  clinician: "SLP",
  parent: "Parent",
  teacher: "Teacher",
  admin: "Administrator",
};

const requestedOrganizationId = (request: Request) => {
  const value = Number(request.get("x-childled-organization-id"));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

/**
 * Resolves a Clerk-authenticated request to an explicitly invited ChildLed care
 * team member. The browser never supplies roles, organizations, or child IDs.
 */
export const attachClerkActor = async (request: Request, _response: Response, next: NextFunction) => {
  const auth = getAuth(request);
  if (!auth.userId) return next();

  try {
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    if (!hasVerifiedEmailAddress(clerkUser.emailAddresses)) {
      request.childledAuthFailure = "email_unverified";
      return next();
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(and(
        eq(usersTable.identityProvider, "clerk"),
        eq(usersTable.providerSubject, auth.userId),
        isNull(usersTable.archivedAt),
      ))
      .limit(1);
    if (!user) {
      request.childledAuthFailure = "not_invited";
      return next();
    }
    if (user.disabledAt) {
      request.childledAuthFailure = "access_disabled";
      return next();
    }

    const memberships = await db
      .select()
      .from(organizationMembershipsTable)
      .where(and(eq(organizationMembershipsTable.userId, user.id), eq(organizationMembershipsTable.active, true)));
    const organizationId = requestedOrganizationId(request) ?? (memberships.length === 1 ? memberships[0]?.organizationId ?? null : null);
    const membership = organizationId
      ? memberships.find((candidate) => candidate.organizationId === organizationId)
      : null;
    if (!membership || !isPortableRole(membership.role)) {
      request.childledAuthFailure = "not_invited";
      return next();
    }
    const isAdmin = membership.role === "admin";
    const isSuperAdmin = isSuperAdminIdentity({ userId: user.id, isAdmin });
    if (!user.betaApprovedAt && !isSuperAdmin) {
      request.childledAuthFailure = "not_invited";
      return next();
    }
    const [organization] = await db.select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, membership.organizationId))
      .limit(1);
    if (
      !organization
      || organization.archivedAt
      || (!isSuperAdmin && (organization.disabledAt || !organization.betaApprovedAt))
    ) {
      request.childledAuthFailure = "access_disabled";
      return next();
    }
    const [controls] = await db.select().from(betaControlsTable).where(eq(betaControlsTable.id, 1)).limit(1);
    if ((!controls || !controls.enabled) && !isSuperAdmin) {
      request.childledAuthFailure = "access_disabled";
      return next();
    }

    const childIds = (await db
      .select({ childId: childCareTeamMembershipsTable.childId })
      .from(childCareTeamMembershipsTable)
      .innerJoin(
        childProfilesTable,
        and(
          eq(childCareTeamMembershipsTable.childId, childProfilesTable.id),
          eq(childProfilesTable.organizationId, membership.organizationId),
          isNull(childProfilesTable.archivedAt),
        ),
      )
      .where(and(
        eq(childCareTeamMembershipsTable.userId, user.id),
        eq(childCareTeamMembershipsTable.active, true),
      )))
      .map((child) => child.childId);

    request.childledActor = {
      userId: user.id,
      author: user.displayName,
      role: roleMap[membership.role],
      childIds,
      isAdmin,
      isSuperAdmin,
      organizationId: membership.organizationId,
      expiresAt: typeof auth.sessionClaims?.exp === "number"
        ? auth.sessionClaims.exp * 1000
        : Date.now() + 60_000,
    };
    if (controls) {
      const [acknowledgement] = await db.select({ userId: betaNoticeAcknowledgementsTable.userId })
        .from(betaNoticeAcknowledgementsTable)
        .where(and(
          eq(betaNoticeAcknowledgementsTable.userId, user.id),
          eq(betaNoticeAcknowledgementsTable.noticeVersion, controls.currentNoticeVersion),
        ))
        .limit(1);
      if (!acknowledgement) request.childledAuthFailure = "beta_notice_unacknowledged";
    }
  } catch (error) {
    request.childledAuthFailure = "session_invalid";
    logger.warn({ err: error }, "Clerk actor resolution failed");
  }
  return next();
};