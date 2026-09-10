import type { CareTeamRole, ResolvedCareTeamActor } from "./auth-context";
import { runtimeConfig } from "./runtime-config";

export const PREVIEWABLE_ROLES = [
  "SLP",
  "Parent",
  "Teacher",
  "Administrator",
] as const;
export type PreviewableRole = (typeof PREVIEWABLE_ROLES)[number];

export const isPreviewableRole = (value: unknown): value is PreviewableRole =>
  typeof value === "string" &&
  (PREVIEWABLE_ROLES as readonly string[]).includes(value);

/**
 * Super Admin is an owner capability, not an organization role. Production
 * identities must be explicitly allowlisted; only the explicitly enabled demo
 * workspace receives this capability automatically.
 */
export const isSuperAdminIdentity = ({
  userId,
  isAdmin,
  isDevelopmentDemo = false,
  configuredUserIds = process.env.CHILDLED_SUPER_ADMIN_USER_IDS,
  developmentDemoEnabled = runtimeConfig.demoLogin.enabled,
}: {
  userId: string;
  isAdmin: boolean;
  isDevelopmentDemo?: boolean;
  configuredUserIds?: string;
  developmentDemoEnabled?: boolean;
}) => {
  if (!isAdmin) return false;
  if (isDevelopmentDemo && developmentDemoEnabled) return true;
  const allowed = (configuredUserIds ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(userId);
};

export const hasVerifiedCareTeamSession = (
  actor: ResolvedCareTeamActor | undefined,
  now = Date.now(),
) => Boolean(actor && actor.expiresAt > now);

export const canAccessAssignedChild = (
  actor: ResolvedCareTeamActor | undefined,
  childId: number,
) => hasVerifiedCareTeamSession(actor) && actor!.childIds.includes(childId);

export const canManageClinicalData = (role: CareTeamRole) => role === "SLP";

export const canSubmitDictionaryPhrase = (role: CareTeamRole) =>
  role === "SLP" || role === "Parent" || role === "Teacher";

export const canContributeSharedChildContext = (role: CareTeamRole) =>
  role === "SLP" || role === "Parent" || role === "Teacher";

export const hasVerifiedEmailAddress = (
  emails: Array<{ verification?: { status?: string | null } | null }>,
) => emails.some((email) => email.verification?.status === "verified");
