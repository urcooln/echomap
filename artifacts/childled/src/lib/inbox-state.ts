import type { TeamInbox, TeamMessage } from "@workspace/api-client-react";

type ApiErrorLike = {
  status?: unknown;
};

export const inboxErrorStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as ApiErrorLike).status;
  return typeof status === "number" ? status : undefined;
};

export const inboxQueryKeyForViewer = (
  baseKey: readonly unknown[],
  viewerUserId?: string,
) => [...baseKey, { viewerUserId: viewerUserId ?? "signed-out" }] as const;

export const inboxPlaceholderForViewer = (
  previous: TeamInbox | undefined,
  viewerUserId?: string,
) => (previous?.currentUserId === viewerUserId ? previous : undefined);

export const inboxLoadFailureMessage = (
  error: unknown,
  hasSelectedConversation: boolean,
) => {
  const status = inboxErrorStatus(error);
  if (status === 401) {
    return "Your session could not be verified. Sign in again and reopen the Inbox.";
  }
  if (status === 403 && hasSelectedConversation) {
    return "This conversation is not available to the current account. Return to the Inbox and choose an authorized conversation.";
  }
  if (status === 403) {
    return "This account does not have access to the requested Inbox information.";
  }
  return "Messages could not be loaded. Check your connection and try again.";
};

export const inboxSendFailureMessage = (error: unknown) => {
  const status = inboxErrorStatus(error);
  if (status === 401) {
    return "Your session could not be verified. Your draft is still here.";
  }
  if (status === 403) {
    return "This account cannot send to this conversation. Your draft is still here; return to the Inbox and choose an authorized conversation.";
  }
  return "Message couldn't be sent. Your draft is still here. Try again.";
};

export const appendSentMessage = (
  inbox: TeamInbox,
  message: TeamMessage,
): TeamInbox => {
  if (
    !message.conversationId ||
    message.senderUserId !== inbox.currentUserId ||
    inbox.messages.some((item) => item.id === message.id) ||
    !inbox.conversations.some(
      (conversation) => conversation.id === message.conversationId,
    )
  ) {
    return inbox;
  }
  const conversations = inbox.conversations
    .map((conversation) =>
      conversation.id === message.conversationId
        ? {
            ...conversation,
            messageCount: conversation.messageCount + 1,
            latestMessageAt: message.createdAt,
            latestMessagePreview: message.body.slice(0, 140),
            latestSenderName: message.senderName,
          }
        : conversation,
    )
    .sort((left, right) =>
      (right.latestMessageAt ?? "").localeCompare(left.latestMessageAt ?? ""),
    );
  return {
    ...inbox,
    conversations,
    children: inbox.children.map((child) =>
      child.childId === message.childId
        ? {
            ...child,
            messageCount: child.messageCount + 1,
            latestMessageAt: message.createdAt,
            latestMessagePreview: message.body.slice(0, 140),
          }
        : child,
    ),
    messages: [...inbox.messages, message],
  };
};

export const mergeInboxListWithSelectedConversation = (
  list: TeamInbox | undefined,
  selected: TeamInbox | undefined,
  selectedConversationId?: number,
): TeamInbox | undefined => {
  if (!list) return selected;
  if (
    !selected ||
    !selectedConversationId ||
    selected.currentUserId !== list.currentUserId
  ) {
    return list;
  }
  const selectedConversation = selected.conversations.find(
    (conversation) => conversation.id === selectedConversationId,
  );
  if (!selectedConversation) return list;
  const selectedMessages = selected.messages.filter(
    (message) => message.conversationId === selectedConversationId,
  );
  return {
    ...list,
    conversations: list.conversations.map((conversation) =>
      conversation.id === selectedConversationId
        ? selectedConversation
        : conversation,
    ),
    messages: [
      ...list.messages.filter(
        (message) => message.conversationId !== selectedConversationId,
      ),
      ...selectedMessages,
    ].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
  };
};
