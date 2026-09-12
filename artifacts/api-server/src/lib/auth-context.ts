export type CareTeamRole = "SLP" | "Parent" | "Teacher" | "Administrator";

export type DevelopmentDemoPersonaActor = {
  userId: string;
  author: string;
  role: CareTeamRole;
  childIds: number[];
  isAdmin: boolean;
};

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
  /** Server-owned seeded identities available to the dedicated demo session. */
  developmentDemoPersonas?: Partial<
    Record<CareTeamRole, DevelopmentDemoPersonaActor>
  >;
  expiresAt: number;
  organizationId?: number;
  accountStatus?: "onboarding" | "active";
  onboardingComplete?: boolean;
};

export type ChildLedAuthFailure =
  | "email_unverified"
  | "not_invited"
  | "session_invalid"
  | "access_disabled"
  | "beta_notice_unacknowledged";

declare global {
  namespace Express {
    interface Request {
      childledActor?: ResolvedCareTeamActor;
      childledAuthFailure?: ChildLedAuthFailure;
    }
  }
}
