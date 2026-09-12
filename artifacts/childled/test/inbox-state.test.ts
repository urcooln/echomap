import assert from "node:assert/strict";
import test from "node:test";
import type { TeamInbox, TeamMessage } from "@workspace/api-client-react";
import {
  appendSentMessage,
  inboxLoadFailureMessage,
  inboxPlaceholderForViewer,
  inboxQueryKeyForViewer,
  inboxSendFailureMessage,
  mergeInboxListWithSelectedConversation,
} from "../src/lib/inbox-state.ts";

const inbox: TeamInbox = {
  currentUserId: "parent-user",
  childId: 2,
  conversations: [
    {
      id: 10,
      childId: 2,
      childName: "Oliver Bennett",
      participants: [],
      unreadCount: 0,
      messageCount: 1,
      latestMessageAt: "2026-09-12T12:00:00.000Z",
      latestMessagePreview: "Earlier message",
      latestSenderName: "Dr. Lena Ortiz",
    },
  ],
  children: [
    {
      childId: 2,
      childName: "Oliver Bennett",
      unreadCount: 0,
      messageCount: 1,
      latestMessageAt: "2026-09-12T12:00:00.000Z",
      latestMessagePreview: "Earlier message",
    },
  ],
  members: [],
  messages: [],
  totalUnread: 0,
};

test("Inbox cache and placeholders are isolated by active user ID", () => {
  assert.notDeepEqual(
    inboxQueryKeyForViewer(["/api/team-inbox"], "parent-user"),
    inboxQueryKeyForViewer(["/api/team-inbox"], "slp-user"),
  );
  assert.equal(inboxPlaceholderForViewer(inbox, "parent-user"), inbox);
  assert.equal(inboxPlaceholderForViewer(inbox, "slp-user"), undefined);
});

test("a successful reply appears immediately without changing conversation selection", () => {
  const message: TeamMessage = {
    id: 22,
    conversationId: 10,
    childId: 2,
    childName: "Oliver Bennett",
    senderUserId: "parent-user",
    senderName: "Maya Chen",
    senderRole: "Parent",
    messageType: "message",
    audience: "entire_team",
    body: "PARENT TEST",
    read: true,
    createdAt: "2026-09-12T12:05:00.000Z",
  };
  const updated = appendSentMessage(inbox, message);
  assert.equal(updated.messages.at(-1)?.body, "PARENT TEST");
  assert.equal(updated.conversations[0]?.id, 10);
  assert.equal(updated.conversations[0]?.messageCount, 2);
  assert.equal(updated.conversations[0]?.latestSenderName, "Maya Chen");
  assert.equal(updated.children[0]?.messageCount, 2);
});

test("Inbox errors distinguish authorization failures and preserve retry guidance", () => {
  const forbidden = { status: 403 };
  assert.match(
    inboxLoadFailureMessage(forbidden, true),
    /not available to the current account/i,
  );
  assert.match(inboxSendFailureMessage(forbidden), /draft is still here/i);
  assert.match(inboxSendFailureMessage(new Error("offline")), /try again/i);
});

test("selected thread data does not replace the desktop conversation list", () => {
  const secondConversation = {
    ...inbox.conversations[0],
    id: 11,
    childName: "Second Student",
  };
  const list = {
    ...inbox,
    conversations: [...inbox.conversations, secondConversation],
  };
  const selectedMessage: TeamMessage = {
    id: 23,
    conversationId: 10,
    childId: 2,
    childName: "Oliver Bennett",
    senderUserId: "slp-user",
    senderName: "Dr. Lena Ortiz",
    senderRole: "SLP",
    messageType: "message",
    audience: "entire_team",
    body: "Selected thread message",
    read: false,
    createdAt: "2026-09-12T12:06:00.000Z",
  };
  const selected = {
    ...inbox,
    conversations: [inbox.conversations[0]],
    messages: [selectedMessage],
  };

  const merged = mergeInboxListWithSelectedConversation(list, selected, 10);
  assert.deepEqual(
    merged?.conversations.map((conversation) => conversation.id),
    [10, 11],
  );
  assert.equal(merged?.messages.at(-1)?.body, "Selected thread message");

  const previousThreadPlaceholder = mergeInboxListWithSelectedConversation(
    list,
    selected,
    11,
  );
  assert.equal(previousThreadPlaceholder, list);
});
