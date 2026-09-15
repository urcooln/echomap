import { clerkClient } from "@clerk/express";
import { runtimeConfig } from "./runtime-config";
import { invitationRoleMarker } from "./clerk-invitation-metadata";

type ApplicationInvitationInput = {
  emailAddress: string;
  token: string;
  childledInvitationId: number;
  invitedRole: string;
  ignoreExisting?: boolean;
};

export type IssuedApplicationInvitation = {
  clerkInvitationId: string | null;
  invitationPath: string;
};

const localInvitationPath = (token: string) =>
  `/sign-up?token=${encodeURIComponent(token)}`;

export const applicationInvitationRedirectUrl = (
  publicAppOrigin: string,
  token: string,
) => {
  const redirect = new URL("/sign-up", publicAppOrigin);
  redirect.searchParams.set("token", token);
  return redirect.toString();
};

export const issueApplicationInvitation = async ({
  emailAddress,
  token,
  childledInvitationId,
  invitedRole,
  ignoreExisting = true,
}: ApplicationInvitationInput): Promise<IssuedApplicationInvitation> => {
  const fallbackPath = localInvitationPath(token);
  if (!runtimeConfig.clerkInvitations.enabled) {
    return { clerkInvitationId: null, invitationPath: fallbackPath };
  }

  const invitation = await clerkClient.invitations.createInvitation({
    emailAddress,
    expiresInDays: 7,
    ignoreExisting,
    notify: true,
    publicMetadata: {
      childledInvitationId: String(childledInvitationId),
      childledInvitationRole: invitationRoleMarker(invitedRole),
      childledInvitationVersion: "1",
    },
    redirectUrl: applicationInvitationRedirectUrl(
      runtimeConfig.publicAppOrigin!,
      token,
    ),
  });

  if (!invitation.url) {
    await clerkClient.invitations
      .revokeInvitation(invitation.id)
      .catch(() => undefined);
    throw new Error("Clerk did not return an invitation acceptance URL.");
  }

  return {
    clerkInvitationId: invitation.id,
    invitationPath: invitation.url,
  };
};

export const pendingApplicationInvitationIdsForEmail = async (
  emailAddress: string,
) => {
  const ids: string[] = [];
  if (!runtimeConfig.clerkInvitations.enabled) return ids;
  const normalizedEmail = emailAddress.trim().toLowerCase();
  const page = await clerkClient.invitations.getInvitationList({
    status: "pending",
    query: normalizedEmail,
    limit: 100,
  });
  for (const invitation of page.data) {
    if (invitation.emailAddress.trim().toLowerCase() === normalizedEmail) {
      ids.push(invitation.id);
    }
  }
  return ids;
};

export const revokeApplicationInvitation = async (
  clerkInvitationId: string | null | undefined,
) => {
  if (!runtimeConfig.clerkInvitations.enabled || !clerkInvitationId) return;
  await clerkClient.invitations.revokeInvitation(clerkInvitationId);
};

export const pendingApplicationInvitationUrls = async (
  clerkInvitationIds: string[],
) => {
  const requestedIds = new Set(clerkInvitationIds.filter(Boolean));
  const urls = new Map<string, string>();
  if (!runtimeConfig.clerkInvitations.enabled || requestedIds.size === 0) {
    return urls;
  }

  let offset = 0;
  const limit = 100;
  while (urls.size < requestedIds.size) {
    const page = await clerkClient.invitations.getInvitationList({
      status: "pending",
      limit,
      offset,
    });
    for (const invitation of page.data) {
      if (requestedIds.has(invitation.id) && invitation.url) {
        urls.set(invitation.id, invitation.url);
      }
    }
    offset += page.data.length;
    if (page.data.length === 0 || offset >= page.totalCount) break;
  }
  return urls;
};
