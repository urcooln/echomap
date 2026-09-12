export type ClerkInvitationReference = {
  invitationId: number;
  roleMarker: string | null;
};

export const invitationRoleMarker = (role: string) => {
  const normalized = role.trim().toLowerCase();
  return normalized === "clinician" || normalized === "slp"
    ? "slp"
    : normalized;
};

export const clerkInvitationReferenceFromMetadata = (
  metadata: Record<string, unknown>,
): ClerkInvitationReference | null => {
  const rawId = metadata.childledInvitationId;
  const invitationId =
    typeof rawId === "number"
      ? rawId
      : Number.parseInt(String(rawId ?? ""), 10);
  if (!Number.isSafeInteger(invitationId) || invitationId < 1) return null;
  const rawRole = metadata.childledInvitationRole;
  return {
    invitationId,
    roleMarker:
      typeof rawRole === "string" && rawRole.trim()
        ? rawRole.trim().toLowerCase()
        : null,
  };
};
