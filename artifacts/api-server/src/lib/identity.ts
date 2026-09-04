import type { Request } from "express";

export const portableRoleValues = ["clinician", "parent", "teacher", "admin"] as const;
export type PortableRole = (typeof portableRoleValues)[number];

export type ProviderIdentity = {
  provider: string;
  subject: string;
  displayName: string;
  email?: string;
};

export type AuthenticatedActor = ProviderIdentity & {
  userId: string;
  organizationId: number;
  organizationRole: PortableRole;
  childIds: number[];
};

/**
 * The HTTP server resolves identity through this boundary. Implementations may
 * use a verified OIDC access token, a session cookie, or a test double; route
 * authorization never trusts browser-supplied roles or child IDs.
 */
export interface IdentityAdapter {
  authenticate(request: Request): Promise<ProviderIdentity | null>;
}

export const isPortableRole = (value: string): value is PortableRole =>
  (portableRoleValues as readonly string[]).includes(value);