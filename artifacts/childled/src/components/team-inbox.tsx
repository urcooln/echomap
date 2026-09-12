import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Send,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type {
  TeamInbox,
  TeamInboxConversation,
  TeamMessage,
  TeamMessageInput,
} from "@workspace/api-client-react";

export type InboxMessage = TeamMessage;

export interface TeamInboxPageProps {
  selectedConversationId?: number;
  selectedChildId?: number;
  searchTerm: string;
  inbox?: TeamInbox;
  loading: boolean;
  loadError?: string;
  sending: boolean;
  markingRead: boolean;
  sendError?: string;
  onSelectConversation: (conversationId?: number, childId?: number) => void;
  onSearch: (search: string) => void;
  onRetry: () => void;
  onMarkRead: (messageIds: number[]) => void;
  onSend: (
    input: TeamMessageInput,
    callbacks?: { onSuccess?: (message: TeamMessage) => void },
  ) => void;
  onOpenProfile: (childId: number) => void;
}

function formatConversationTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function participantLabel(
  conversation: TeamInboxConversation,
  currentUserId: string,
) {
  const others = conversation.participants.filter(
    (participant) => participant.userId !== currentUserId,
  );
  if (!others.length) return "Care team";
  if (others.length === 1) return `${others[0].name} · ${others[0].role}`;
  return `${others[0].name} +${others.length - 1}`;
}

function LoadingState() {
  return (
    <div
      className="grid min-h-[32rem] gap-5 lg:grid-cols-[21rem_minmax(0,1fr)]"
      data-testid="status-loading"
    >
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="skeleton h-11 rounded-xl" />
        {[1, 2, 3].map((item) => (
          <div key={item} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
      <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
        <div className="skeleton h-14 rounded-xl" />
        <div className="skeleton h-24 w-3/4 rounded-xl" />
        <div className="skeleton ml-auto h-24 w-3/4 rounded-xl" />
      </div>
    </div>
  );
}

function ConversationLoadingState() {
  return (
    <section className="min-h-[32rem] rounded-2xl border border-border bg-card p-5 soft-shadow">
      <div className="skeleton h-14 rounded-xl" />
      <div className="mt-6 space-y-4">
        <div className="skeleton h-24 w-3/4 rounded-xl" />
        <div className="skeleton ml-auto h-24 w-3/4 rounded-xl" />
      </div>
    </section>
  );
}

function ConversationLoadError({
  message,
  onBack,
  onRetry,
}: {
  message: string;
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <section
      className="grid min-h-[32rem] place-items-center rounded-2xl border border-border bg-card p-6 text-center soft-shadow"
      data-testid="inbox-conversation-error"
    >
      <div className="max-w-sm">
        <MessageCircle size={30} className="mx-auto text-muted-foreground/60" />
        <h2 className="serif mt-4 text-2xl font-semibold">
          Conversation unavailable
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {message}
        </p>
        <div className="mt-5 flex flex-col-reverse justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onBack}
            className="focus-ring min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary"
          >
            Back to Inbox
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="focus-ring min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            data-testid="button-retry-conversation"
          >
            Try again
          </button>
        </div>
      </div>
    </section>
  );
}

function ConversationList({
  conversations,
  currentUserId,
  selectedConversationId,
  unreadOnly,
  search,
  onSearchChange,
  onSubmitSearch,
  onUnreadChange,
  onSelect,
  onCompose,
  hiddenOnMobile,
}: {
  conversations: TeamInboxConversation[];
  currentUserId: string;
  selectedConversationId?: number;
  unreadOnly: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSubmitSearch: () => void;
  onUnreadChange: (value: boolean) => void;
  onSelect: (conversation: TeamInboxConversation) => void;
  onCompose: () => void;
  hiddenOnMobile: boolean;
}) {
  const visible = unreadOnly
    ? conversations.filter((conversation) => conversation.unreadCount > 0)
    : conversations;
  return (
    <aside
      className={`${hiddenOnMobile ? "hidden lg:flex" : "flex"} min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-border bg-card soft-shadow lg:h-[calc(100dvh-13rem)] lg:max-h-[48rem]`}
      data-testid="inbox-conversation-list"
    >
      <div className="border-b border-border p-3 sm:p-4">
        <button
          type="button"
          onClick={onCompose}
          className="focus-ring mb-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          data-testid="button-new-conversation"
        >
          <Plus size={17} /> New message
        </button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitSearch();
          }}
          className="relative"
        >
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search messages"
            aria-label="Search messages, children, or participants"
            data-testid="input-inbox-search"
            className="focus-ring min-h-11 w-full rounded-xl border border-border bg-background pl-9 pr-9 text-sm"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground"
            >
              <X size={15} />
            </button>
          ) : null}
        </form>
        <div className="mt-3 grid grid-cols-2 rounded-xl bg-secondary/60 p-1">
          {[false, true].map((value) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => onUnreadChange(value)}
              className={`focus-ring min-h-9 rounded-lg px-3 text-xs font-semibold ${unreadOnly === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              data-testid={`filter-${value ? "unread" : "all"}`}
            >
              {value ? "Unread" : "All"}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {visible.length ? (
          <div className="space-y-1">
            {visible.map((conversation) => {
              const selected = conversation.id === selectedConversationId;
              return (
                <button
                  type="button"
                  key={conversation.id}
                  onClick={() => onSelect(conversation)}
                  data-testid={`button-inbox-conversation-${conversation.id}`}
                  className={`focus-ring flex min-h-[5.5rem] w-full gap-3 rounded-xl px-3 py-3 text-left transition ${selected ? "bg-primary text-primary-foreground" : conversation.unreadCount ? "bg-accent/10 hover:bg-accent/15" : "hover:bg-secondary/70"}`}
                >
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold ${selected ? "bg-primary-foreground/15" : "bg-secondary text-primary"}`}
                  >
                    {initials(conversation.childName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-bold">
                        {conversation.childName}
                      </span>
                      <time
                        className={`shrink-0 text-[10px] ${selected ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                      >
                        {formatConversationTime(conversation.latestMessageAt)}
                      </time>
                    </span>
                    <span
                      className={`mt-0.5 block truncate text-xs ${selected ? "text-primary-foreground/75" : "text-muted-foreground"}`}
                    >
                      {participantLabel(conversation, currentUserId)}
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <span
                        className={`min-w-0 flex-1 truncate text-xs ${conversation.unreadCount ? "font-semibold" : "font-normal"} ${selected ? "text-primary-foreground/85" : "text-foreground/80"}`}
                      >
                        {conversation.latestSenderName
                          ? `${conversation.latestSenderName}: `
                          : ""}
                        {conversation.latestMessagePreview || "No messages yet"}
                      </span>
                      {conversation.unreadCount ? (
                        <span
                          className={`inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${selected ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}`}
                        >
                          {conversation.unreadCount > 99
                            ? "99+"
                            : conversation.unreadCount}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center px-5 text-center">
            <div>
              <MessageCircle
                size={26}
                className="mx-auto text-muted-foreground/60"
              />
              <p className="mt-3 text-sm font-semibold">
                {unreadOnly ? "No unread messages" : "No messages yet"}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {unreadOnly
                  ? "New care-team messages will appear here."
                  : "Messages with your students’ care teams will appear here."}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function NewConversation({
  inbox,
  sending,
  error,
  onCancel,
  onSend,
}: {
  inbox: TeamInbox;
  sending: boolean;
  error?: string;
  onCancel: () => void;
  onSend: TeamInboxPageProps["onSend"];
}) {
  const [childId, setChildId] = useState(inbox.children[0]?.childId ?? 0);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const recipients = useMemo(
    () => inbox.members.filter((member) => member.childId === childId),
    [childId, inbox.members],
  );

  useEffect(() => {
    const slpIds = recipients
      .filter((recipient) => recipient.role === "SLP")
      .map((recipient) => recipient.userId);
    setRecipientIds(slpIds);
  }, [recipients]);

  return (
    <section className="flex min-h-[32rem] flex-col rounded-2xl border border-border bg-card soft-shadow lg:h-[calc(100dvh-13rem)] lg:max-h-[48rem]">
      <header className="flex items-center gap-3 border-b border-border p-4 sm:p-5">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Back to conversations"
          className="focus-ring grid size-11 shrink-0 place-items-center rounded-xl hover:bg-secondary lg:hidden"
        >
          <ArrowLeft size={19} />
        </button>
        <div>
          <p className="mono text-[10px] font-bold uppercase text-muted-foreground">
            Care-team message
          </p>
          <h2 className="serif mt-1 text-2xl font-semibold">New message</h2>
        </div>
      </header>
      <form
        className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!childId || !recipientIds.length || !body.trim()) return;
          onSend(
            {
              childId,
              recipientUserIds: recipientIds,
              body: body.trim(),
              messageType: "message",
            },
            { onSuccess: () => setBody("") },
          );
        }}
      >
        <label className="grid gap-2 text-sm font-semibold">
          Student
          <select
            value={childId || ""}
            onChange={(event) => setChildId(Number(event.target.value))}
            className="focus-ring min-h-12 w-full rounded-xl border border-border bg-background px-3"
            data-testid="select-message-child"
          >
            {inbox.children.map((child) => (
              <option key={child.childId} value={child.childId}>
                {child.childName}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-semibold">To</legend>
          {recipients.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {recipients.map((recipient) => {
                const checked = recipientIds.includes(recipient.userId);
                return (
                  <label
                    key={recipient.userId}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${checked ? "border-primary bg-secondary/70" : "border-border bg-background"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setRecipientIds((current) =>
                          checked
                            ? current.filter((id) => id !== recipient.userId)
                            : [...current, recipient.userId],
                        )
                      }
                      className="size-5 accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {recipient.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {recipient.role}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No authorized recipients are assigned to this student yet.
            </p>
          )}
        </fieldset>
        <label className="grid flex-1 gap-2 text-sm font-semibold">
          Message
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a message…"
            className="focus-ring min-h-36 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm font-normal"
            data-testid="textarea-new-message"
          />
        </label>
        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring min-h-11 rounded-xl px-4 text-sm font-semibold hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending || !childId || !recipientIds.length || !body.trim()}
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            data-testid="button-send-new-message"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Send
          </button>
        </div>
      </form>
    </section>
  );
}

function ConversationThread({
  conversation,
  messages,
  currentUserId,
  sending,
  error,
  refreshError,
  onRetry,
  onBack,
  onOpenProfile,
  onSend,
}: {
  conversation: TeamInboxConversation;
  messages: TeamMessage[];
  currentUserId: string;
  sending: boolean;
  error?: string;
  refreshError?: string;
  onRetry: () => void;
  onBack: () => void;
  onOpenProfile: (childId: number) => void;
  onSend: TeamInboxPageProps["onSend"];
}) {
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const others = conversation.participants.filter(
    (participant) => participant.userId !== currentUserId,
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conversation.id, messages.length]);

  return (
    <section
      className="flex min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-border bg-card soft-shadow lg:h-[calc(100dvh-13rem)] lg:max-h-[48rem]"
      data-testid="inbox-conversation-thread"
    >
      <header className="flex items-center gap-3 border-b border-border p-3 sm:p-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="focus-ring grid size-11 shrink-0 place-items-center rounded-xl hover:bg-secondary lg:hidden"
          data-testid="button-back-to-inbox"
        >
          <ArrowLeft size={19} />
        </button>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-primary">
          {initials(conversation.childName)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold">{conversation.childName}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {others.length
              ? others.map((participant) => `${participant.name} (${participant.role})`).join(", ")
              : "Care team"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenProfile(conversation.childId)}
          className="focus-ring grid size-11 shrink-0 place-items-center rounded-xl border border-border hover:bg-secondary"
          aria-label={`View ${conversation.childName}'s profile`}
          title="View student profile"
        >
          <UserRound size={18} />
        </button>
      </header>
      {refreshError ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive sm:px-4"
          role="status"
        >
          <span>{refreshError} The open conversation and your draft were preserved.</span>
          <button
            type="button"
            onClick={onRetry}
            className="focus-ring min-h-9 rounded-lg px-3 font-semibold hover:bg-destructive/10"
          >
            Try again
          </button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-secondary/20 p-3 sm:p-5">
        {messages.length ? (
          <div className="space-y-4">
            {messages.map((message) => {
              const mine = message.senderUserId === currentUserId;
              return (
                <article
                  key={message.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  data-testid={`thread-message-${message.id}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[75%] ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border bg-card text-foreground"}`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="text-xs font-bold">{mine ? "You" : message.senderName}</span>
                      {!mine ? <span className="text-[10px] text-muted-foreground">{message.senderRole}</span> : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                    <time
                      dateTime={message.createdAt}
                      className={`mt-1.5 block text-right text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                    >
                      {formatMessageTime(message.createdAt)}
                    </time>
                  </div>
                </article>
              );
            })}
            <div ref={endRef} />
          </div>
        ) : (
          <div className="grid h-full min-h-52 place-items-center text-center">
            <div>
              <MessageCircle size={27} className="mx-auto text-muted-foreground/60" />
              <p className="mt-3 text-sm font-semibold">No messages yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Start the conversation below.</p>
            </div>
          </div>
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!body.trim() || sending) return;
          onSend(
            {
              childId: conversation.childId,
              conversationId: conversation.id,
              body: body.trim(),
              messageType: "message",
            },
            { onSuccess: () => setBody("") },
          );
        }}
        className="border-t border-border bg-card p-3 sm:p-4"
      >
        <label htmlFor="thread-reply" className="sr-only">Write a message</label>
        <div className="flex items-end gap-2">
          <textarea
            id="thread-reply"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a message…"
            rows={1}
            className="focus-ring min-h-11 max-h-32 min-w-0 flex-1 resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            data-testid="textarea-thread-reply"
          />
          <button
            type="submit"
            disabled={!body.trim() || sending}
            className="focus-ring grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
            aria-label="Send message"
            title="Send message"
            data-testid="button-send-thread-reply"
          >
            {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          </button>
        </div>
        {error ? <p className="mt-2 text-xs font-medium text-destructive">{error}</p> : null}
      </form>
    </section>
  );
}

function EmptyThread({ onCompose }: { onCompose: () => void }) {
  return (
    <section className="hidden min-h-[32rem] place-items-center rounded-2xl border border-border bg-card p-6 text-center soft-shadow lg:grid lg:h-[calc(100dvh-13rem)] lg:max-h-[48rem]">
      <div className="max-w-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
          <Users size={22} />
        </span>
        <h2 className="serif mt-4 text-2xl font-semibold">Select a conversation</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Open a thread to read and reply, or start a message with an authorized member of a student’s care team.
        </p>
        <button
          type="button"
          onClick={onCompose}
          className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <Plus size={17} /> New message
        </button>
      </div>
    </section>
  );
}

export function TeamInboxPage({
  selectedConversationId,
  selectedChildId,
  searchTerm,
  inbox,
  loading,
  loadError,
  sending,
  markingRead,
  sendError,
  onSelectConversation,
  onSearch,
  onRetry,
  onMarkRead,
  onSend,
  onOpenProfile,
}: TeamInboxPageProps) {
  const [search, setSearch] = useState(searchTerm);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [composing, setComposing] = useState(false);
  useEffect(() => setSearch(searchTerm), [searchTerm]);

  const activeConversation = useMemo(
    () =>
      inbox?.conversations.find(
        (conversation) => conversation.id === selectedConversationId,
      ),
    [inbox?.conversations, selectedConversationId],
  );
  const activeMessages = useMemo(
    () =>
      (inbox?.messages ?? []).filter(
        (message) => message.conversationId === activeConversation?.id,
      ),
    [activeConversation?.id, inbox?.messages],
  );
  const unreadMessageIds = activeMessages
    .filter(
      (message) =>
        !message.read && message.senderUserId !== inbox?.currentUserId,
    )
    .map((message) => message.id);
  const unreadSignature = unreadMessageIds.join(":");

  useEffect(() => {
    if (activeConversation && unreadMessageIds.length && !markingRead) {
      onMarkRead(unreadMessageIds);
    }
    // The ID signature prevents another call after the read-state refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation?.id, unreadSignature]);

  if (loading && !inbox) return <LoadingState />;
  if (loadError && !inbox) {
    return (
      <div className="mx-auto max-w-3xl animate-rise">
        <ConversationLoadError
          message={loadError}
          onBack={() => onSelectConversation(undefined)}
          onRetry={onRetry}
        />
      </div>
    );
  }
  const data: TeamInbox = inbox ?? {
    currentUserId: "",
    childId: selectedChildId ?? null,
    conversations: [],
    children: [],
    members: [],
    messages: [],
    totalUnread: 0,
  };
  const showDetail = Boolean(
    selectedConversationId || activeConversation || composing,
  );

  return (
    <div className="mx-auto max-w-7xl animate-rise" data-testid="team-inbox-page">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono text-[10px] font-bold uppercase text-muted-foreground">
            Care coordination
          </p>
          <h1 className="serif mt-1 text-3xl font-semibold md:text-4xl">
            Inbox
          </h1>
        </div>
        {data.totalUnread ? (
          <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground">
            {data.totalUnread} unread conversation{data.totalUnread === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Check size={15} className="text-primary" /> All caught up
          </span>
        )}
      </header>
      <div className="grid gap-5 lg:grid-cols-[21rem_minmax(0,1fr)]">
        <ConversationList
          conversations={data.conversations}
          currentUserId={data.currentUserId}
          selectedConversationId={selectedConversationId}
          unreadOnly={unreadOnly}
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            if (!value) onSearch("");
          }}
          onSubmitSearch={() => onSearch(search.trim())}
          onUnreadChange={setUnreadOnly}
          onSelect={(conversation) => {
            setComposing(false);
            onSelectConversation(conversation.id, conversation.childId);
          }}
          onCompose={() => setComposing(true)}
          hiddenOnMobile={showDetail}
        />
        {composing ? (
          <NewConversation
            inbox={data}
            sending={sending}
            error={sendError}
            onCancel={() => setComposing(false)}
            onSend={(input, callbacks) =>
              onSend(input, {
                onSuccess: (message) => {
                  callbacks?.onSuccess?.(message);
                  setComposing(false);
                  if (message.conversationId) {
                    onSelectConversation(
                      message.conversationId,
                      message.childId,
                    );
                  }
                },
              })
            }
          />
        ) : activeConversation ? (
          <ConversationThread
            conversation={activeConversation}
            messages={activeMessages}
            currentUserId={data.currentUserId}
            sending={sending}
            error={sendError}
            refreshError={loadError}
            onRetry={onRetry}
            onBack={() => onSelectConversation(undefined)}
            onOpenProfile={onOpenProfile}
            onSend={onSend}
          />
        ) : selectedConversationId && loading ? (
          <ConversationLoadingState />
        ) : selectedConversationId ? (
          <ConversationLoadError
            message={
              loadError ??
              "This conversation is no longer available or you do not have access to it."
            }
            onBack={() => onSelectConversation(undefined)}
            onRetry={onRetry}
          />
        ) : (
          <EmptyThread onCompose={() => setComposing(true)} />
        )}
      </div>
    </div>
  );
}
