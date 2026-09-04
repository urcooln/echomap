export type CareTeamRole = "SLP" | "Parent" | "Teacher" | "Administrator";

export type ResolvedCareTeamActor = {
  userId: string;
  author: string;
  role: CareTeamRole;
  childIds: number[];
  isAdmin: boolean;
  /** A server-resolved owner capability; never derived from browser input. */
  isSuperAdmin?: boolean;
  /** A local-only capability used by the preview demo; never set in production. */
  isDevelopmentDemo?: boolean;
  /** The role currently simulated by an authenticated Super Admin. */
  previewRole?: CareTeamRole;
  expiresAt: number;
  organizationId?: number;
};

export type EchoMapAuthFailure = "email_unverified" | "not_invited" | "session_invalid" | "access_disabled" | "beta_notice_unacknowledged";

declare global {
  namespace Express {
    interface Request {
      echomapActor?: ResolvedCareTeamActor;
      echomapAuthFailure?: EchoMapAuthFailure;
    }
  }
}