import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Bell,
  Check,
  CircleHelp,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';

export type MessageType = 'message' | 'question' | 'update' | 'notification';

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  initials: string;
}

export interface InboxMessage {
  id: number;
  childId: number;
  childName: string;
  senderName: string;
  senderRole: string;
  messageType: MessageType;
  audience: 'entire_team';
  body: string;
  read: boolean;
  createdAt: string;
}

export interface InboxConversation {
  childId: number;
  childName: string;
  unreadCount: number;
  messageCount: number;
  latestMessageAt: string | null;
  latestMessagePreview: string | null;
}

export interface TeamInbox {
  childId: number | null;
  children: InboxConversation[];
  members: TeamMember[];
  messages: InboxMessage[];
  totalUnread: number;
}

export interface TeamInboxPageProps {
  selectedChildId?: number;
  searchTerm: string;
  inbox?: TeamInbox;
  loading: boolean;
  sending: boolean;
  markingRead: boolean;
  sendError?: string;
  onSelectChild: (childId?: number) => void;
  onSearch: (search: string) => void;
  onMarkRead: (messageIds: number[]) => void;
  onSend: (input: { childId: number; body: string }) => void;
}

const TABS = ['All', 'Messages', 'Questions', 'Updates', 'Notifications'] as const;
type TabType = typeof TABS[number];

function formatDate(dateString: string) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return dateString;
  const now = new Date();
  const isToday =
    parsed.getDate() === now.getDate() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getFullYear() === now.getFullYear();
  if (isToday) {
    return `Today at ${parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return <div className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-foreground shadow-sm ring-2 ring-card">{initials}</div>;
}

function LoadingState() {
  return (
    <div className="grid gap-6 lg:grid-cols-[285px_minmax(0,1fr)]" data-testid="status-loading">
      <div className="space-y-3 rounded-3xl border border-border bg-card p-4 soft-shadow">
        {[1, 2, 3].map((item) => <div key={item} className="skeleton h-20 rounded-2xl" />)}
      </div>
      <div className="space-y-5 rounded-3xl border border-border bg-card p-6 soft-shadow">
        <div className="skeleton h-10 w-full rounded-xl" />
        {[1, 2, 3].map((item) => <div key={item} className="flex gap-4"><div className="skeleton size-10 shrink-0 rounded-full" /><div className="skeleton h-24 flex-1 rounded-2xl" /></div>)}
      </div>
    </div>
  );
}

function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return <span data-testid="badge-unread-count" className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">{count > 99 ? '99+' : count}</span>;
}

function ConversationList({
  conversations,
  selectedChildId,
  onSelectChild,
}: {
  conversations: InboxConversation[];
  selectedChildId?: number;
  onSelectChild: (childId?: number) => void;
}) {
  return (
    <aside className="rounded-3xl border border-border bg-card p-3 soft-shadow" data-testid="inbox-conversation-list">
      <div className="mb-3 flex items-center justify-between gap-3 px-2 pt-2">
        <div>
          <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Conversations</p>
          <p className="mt-1 text-xs text-muted-foreground">Each thread is shared with one child’s team.</p>
        </div>
      </div>
      <div className="space-y-1">
        <button
          type="button"
          data-testid="button-inbox-all-conversations"
          onClick={() => onSelectChild(undefined)}
          className={`focus-ring flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${selectedChildId === undefined ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/70'}`}
        >
          <span className={`grid size-9 place-items-center rounded-xl ${selectedChildId === undefined ? 'bg-primary-foreground/15' : 'bg-secondary text-primary'}`}><MessageCircle size={17} /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">All messages</span><span className={`mt-0.5 block text-xs ${selectedChildId === undefined ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>Across your authorized care teams</span></span>
          <UnreadBadge count={conversations.reduce((total, conversation) => total + conversation.unreadCount, 0)} />
        </button>
        {conversations.map((conversation) => {
          const active = conversation.childId === selectedChildId;
          return (
            <button
              key={conversation.childId}
              type="button"
              data-testid={`button-inbox-conversation-${conversation.childId}`}
              onClick={() => onSelectChild(conversation.childId)}
              className={`focus-ring flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/70'}`}
            >
              <Avatar name={conversation.childName} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{conversation.childName}</span>{conversation.unreadCount > 0 && <span className={`size-2 shrink-0 rounded-full ${active ? 'bg-accent' : 'bg-primary'}`} aria-label={`${conversation.unreadCount} unread`} />}</span>
                <span className={`mt-0.5 block truncate text-xs ${active ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{conversation.latestMessagePreview || 'No messages yet'}</span>
              </span>
              <UnreadBadge count={conversation.unreadCount} />
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function MessageItem({
  message,
  childName,
  onMarkRead,
  markingRead,
}: {
  message: InboxMessage;
  childName: string;
  onMarkRead: (messageId: number) => void;
  markingRead: boolean;
}) {
  const typeConfig = {
    message: { icon: MessageCircle, bg: 'bg-secondary/10 border-border/50', label: '' },
    question: { icon: CircleHelp, bg: 'bg-accent/5 border-accent/20', label: 'text-accent' },
    update: { icon: Activity, bg: 'bg-primary/5 border-primary/20', label: 'text-primary' },
    notification: { icon: Bell, bg: 'bg-secondary border-transparent', label: 'text-muted-foreground' },
  };
  const config = typeConfig[message.messageType];
  const Icon = config.icon;
  return (
    <article data-testid={`message-item-${message.id}`} className={`flex gap-4 rounded-2xl p-2 transition ${message.read ? '' : 'bg-accent/5'}`}>
      <Avatar name={message.senderName} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-foreground">{message.senderName}</span>
            <span className="text-xs text-muted-foreground">{message.senderRole}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{childName}</span>
            {!message.read && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">Unread</span>}
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">{formatDate(message.createdAt)}</span>
        </div>
        <div className={`rounded-2xl rounded-tl-sm border p-4 sm:p-5 ${config.bg}`}>
          {message.messageType !== 'message' && <div className={`mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${config.label}`}><Icon size={14} />{message.messageType}</div>}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{message.body}</p>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/50 pt-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users size={13} /> Entire care team</span>
            {!message.read && <button type="button" data-testid={`button-mark-message-read-${message.id}`} onClick={() => onMarkRead(message.id)} disabled={markingRead} className="focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-secondary disabled:opacity-50"><Check size={13} /> Mark read</button>}
          </div>
        </div>
      </div>
    </article>
  );
}

function Composer({
  children,
  selectedChildId,
  sending,
  error,
  onSend,
}: {
  children: InboxConversation[];
  selectedChildId?: number;
  sending: boolean;
  error?: string;
  onSend: (input: { childId: number; body: string }) => void;
}) {
  const [text, setText] = useState('');
  const [childId, setChildId] = useState<number | undefined>(selectedChildId);
  useEffect(() => setChildId(selectedChildId ?? children[0]?.childId), [selectedChildId, children]);
  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!text.trim() || !childId || sending) return;
    onSend({ childId, body: text.trim() });
    setText('');
  };
  return (
    <section className="rounded-3xl border border-border bg-card p-4 soft-shadow sm:p-6" data-testid="composer-container">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Quick compose</p><h2 className="serif mt-1 text-xl font-semibold">Message a care team</h2></div>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="text-sm font-semibold text-foreground" htmlFor="message-child">Share with</label>
        <select id="message-child" data-testid="select-compose-child" value={childId ?? ''} onChange={(event) => setChildId(Number(event.target.value))} className="focus-ring w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" disabled={sending || !children.length}>
          {children.length ? children.map((child) => <option key={child.childId} value={child.childId}>{child.childName}'s entire care team</option>) : <option value="">No authorized child teams</option>}
        </select>
        <label htmlFor="message-input" className="sr-only">Message the entire team</label>
        <textarea id="message-input" data-testid="input-message-body" value={text} onChange={(event) => setText(event.target.value)} placeholder="Share an update, ask a question, or celebrate progress…" className="focus-ring min-h-[112px] w-full resize-none rounded-xl border border-border/50 bg-secondary/30 p-4 text-sm placeholder:text-muted-foreground hover:border-border focus:bg-background" disabled={sending || !children.length} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground"><Users size={14} className="text-primary/70" /> Shared with the entire selected care team</span>
          <div className="flex items-center gap-3">
            {error && <span className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive"><AlertCircle size={14} /> Failed to send</span>}
            <button type="submit" data-testid="button-send-message" disabled={!text.trim() || !childId || sending} className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_20px_-14px_hsl(var(--brand-forest-950)/.9)] transition hover:-translate-y-0.5 hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50">
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send message
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

export function TeamInboxPage({
  selectedChildId,
  searchTerm,
  inbox,
  loading,
  sending,
  markingRead,
  sendError,
  onSelectChild,
  onSearch,
  onMarkRead,
  onSend,
}: TeamInboxPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('All');
  const [search, setSearch] = useState(searchTerm);
  useEffect(() => setSearch(searchTerm), [searchTerm]);
  const childNameById = useMemo(() => new Map((inbox?.children ?? []).map((child) => [child.childId, child.childName])), [inbox?.children]);
  const filteredMessages = useMemo(() => (inbox?.messages ?? []).filter((message) => activeTab === 'All' || message.messageType === activeTab.slice(0, -1).toLowerCase()), [activeTab, inbox?.messages]);
  const unreadInView = filteredMessages.filter((message) => !message.read).map((message) => message.id);
  const chooseConversation = (childId?: number) => {
    const unread = (inbox?.messages ?? []).filter((message) => message.childId === childId && !message.read).map((message) => message.id);
    if (unread.length) onMarkRead(unread);
    onSelectChild(childId);
  };
  if (loading && !inbox) return <LoadingState />;
  return (
    <div className="mx-auto max-w-7xl animate-rise" data-testid="team-inbox-page">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Care coordination</p>
          <h1 className="serif text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Messages</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A private Inbox for your authorized child care teams. Every conversation stays attached to one child.</p>
        </div>
        <div className="rounded-2xl border border-primary/15 bg-secondary/40 px-4 py-3 text-sm"><span className="font-semibold text-primary">{inbox?.totalUnread ?? 0}</span> <span className="text-muted-foreground">unread message{(inbox?.totalUnread ?? 0) === 1 ? '' : 's'}</span></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[285px_minmax(0,1fr)]">
        <ConversationList conversations={inbox?.children ?? []} selectedChildId={selectedChildId} onSelectChild={chooseConversation} />
        <div className="min-w-0 space-y-6">
          <section className="rounded-3xl border border-border bg-card p-4 soft-shadow sm:p-6">
            <form onSubmit={(event) => { event.preventDefault(); onSearch(search.trim()); }} className="flex gap-2">
              <label htmlFor="inbox-search" className="sr-only">Search messages</label>
              <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} /><input id="inbox-search" data-testid="input-inbox-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages, child, or sender" className="focus-ring w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-9 text-sm" /><button type="button" aria-label="Clear message search" onClick={() => { setSearch(''); onSearch(''); }} className={`focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-secondary ${search ? '' : 'invisible'}`}><X size={15} /></button></div>
              <button type="submit" data-testid="button-search-inbox" className="focus-ring rounded-xl bg-secondary px-4 text-sm font-semibold text-primary hover:bg-secondary/75">Search</button>
            </form>
            <div role="tablist" aria-label="Message filters" className="mt-5 flex gap-2 overflow-x-auto border-b border-border/50 pb-4">
              {TABS.map((tab) => <button key={tab} role="tab" aria-selected={activeTab === tab} data-testid={`tab-filter-${tab.toLowerCase()}`} onClick={() => setActiveTab(tab)} className={`focus-ring whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>{tab}</button>)}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{selectedChildId ? `Showing ${childNameById.get(selectedChildId) ?? 'selected child'}’s team messages` : 'Showing messages across your authorized children'}</p>
              {unreadInView.length > 0 && <button type="button" data-testid="button-mark-visible-read" onClick={() => onMarkRead(unreadInView)} disabled={markingRead} className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary hover:bg-secondary disabled:opacity-50"><Check size={14} /> Mark visible read</button>}
            </div>
            <div className="mt-6 space-y-5" data-testid="inbox-message-list">
              {filteredMessages.length ? filteredMessages.map((message) => <MessageItem key={message.id} message={message} childName={childNameById.get(message.childId) ?? 'Child care team'} onMarkRead={(messageId) => onMarkRead([messageId])} markingRead={markingRead} />) : <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground"><MessageCircle className="mx-auto mb-3 opacity-50" size={25} /><p className="text-sm font-semibold text-foreground">No messages found</p><p className="mt-1 text-xs">{searchTerm ? 'Try another search term.' : 'When the team shares a message, it will appear here.'}</p></div>}
            </div>
          </section>
          <Composer children={inbox?.children ?? []} selectedChildId={selectedChildId} sending={sending} error={sendError} onSend={onSend} />
        </div>
      </div>
    </div>
  );
}

export interface CaseloadTeamInboxProps {
  title?: string;
  inbox?: TeamInbox;
  loading: boolean;
  error?: string;
  sending: boolean;
  markingRead: boolean;
  searchTerm: string;
  selectedChildId?: number;
  selectedRole?: string;
  onSelectChild: (childId?: number) => void;
  onSelectRole: (role?: string) => void;
  onSearch: (search: string) => void;
  onMarkRead: (messageIds: number[]) => void;
  onReply: (input: { childId: number; body: string }) => void;
  onOpenProfile: (childId: number) => void;
}

const CASELOAD_ROLE_OPTIONS = ['SLP', 'Parent', 'Teacher', 'OT', 'Administrator'] as const;

function CompactMessageItem({
  message,
  childName,
  markingRead,
  onMarkRead,
  onReply,
  onOpenProfile,
  sending,
  error
}: {
  message: InboxMessage;
  childName: string;
  markingRead: boolean;
  onMarkRead: (id: number) => void;
  onReply: (input: { childId: number; body: string }) => void;
  onOpenProfile: (childId: number) => void;
  sending: boolean;
  error?: string;
}) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || sending) return;
    onReply({ childId: message.childId, body: replyText.trim() });
    setReplyText('');
    setIsReplying(false);
  };

  const typeConfig = {
    message: { icon: MessageCircle, bg: 'bg-secondary/10 border-border/50', label: '' },
    question: { icon: CircleHelp, bg: 'bg-accent/5 border-accent/20', label: 'text-accent' },
    update: { icon: Activity, bg: 'bg-primary/5 border-primary/20', label: 'text-primary' },
    notification: { icon: Bell, bg: 'bg-secondary border-transparent', label: 'text-muted-foreground' },
  };
  const config = typeConfig[message.messageType];
  const Icon = config.icon;

  return (
    <article data-testid={`compact-message-${message.id}`} className={`flex flex-col gap-3 rounded-2xl border p-4 transition ${message.read ? 'bg-card border-border/50 hover:border-border' : 'bg-accent/5 border-accent/20 hover:border-accent/40'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Avatar name={message.senderName} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-sm font-semibold truncate text-foreground">{message.senderName}</span>
              <span className="text-xs text-muted-foreground">{message.senderRole}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => onOpenProfile(message.childId)}
                className="focus-ring rounded bg-secondary px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/10 transition truncate max-w-[140px]"
                data-testid={`link-child-profile-${message.id}`}
              >
                {childName}
              </button>
              <span className="text-xs font-medium text-muted-foreground">{formatDate(message.createdAt)}</span>
              {!message.read && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-foreground uppercase tracking-wider">Unread</span>}
            </div>
          </div>
        </div>
        {message.messageType !== 'message' && (
          <div className={`shrink-0 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${config.label}`}>
            <Icon size={14} />
            <span className="hidden sm:inline">{message.messageType}</span>
          </div>
        )}
      </div>

      <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap sm:pl-13">
        {message.body}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-1 border-t border-border/50 sm:pl-13">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users size={13} className="opacity-70" /> Team visible
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsReplying(!isReplying)}
            className={`focus-ring inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${isReplying ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
            data-testid={`button-reply-${message.id}`}
          >
            <MessageCircle size={14} /> Reply
          </button>
          {!message.read && (
            <button
              type="button"
              data-testid={`button-mark-read-${message.id}`}
              onClick={() => onMarkRead(message.id)}
              disabled={markingRead}
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-secondary disabled:opacity-50 transition"
            >
              <Check size={14} /> Mark read
            </button>
          )}
        </div>
      </div>

      {isReplying && (
        <form onSubmit={handleReplySubmit} className="mt-2 sm:pl-13 flex flex-col gap-3 animate-rise">
          <label htmlFor={`reply-input-${message.id}`} className="sr-only">Reply to {message.senderName}</label>
          <textarea
            id={`reply-input-${message.id}`}
            autoFocus
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder={`Reply to ${message.senderName}...`}
            className="focus-ring min-h-[80px] w-full resize-none rounded-xl border border-border/50 bg-secondary/30 p-3 text-sm placeholder:text-muted-foreground hover:border-border focus:bg-background"
            disabled={sending}
            data-testid={`input-reply-${message.id}`}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground hidden sm:inline">Shared with {childName}'s team</span>
            <div className="flex items-center justify-end gap-2 flex-1">
              {error && <span className="text-xs text-destructive flex items-center gap-1 font-medium bg-destructive/10 px-2 py-1 rounded-md"><AlertCircle size={12}/> Error</span>}
              <button
                type="button"
                onClick={() => setIsReplying(false)}
                className="focus-ring px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg transition hover:bg-secondary"
                data-testid={`button-cancel-reply-${message.id}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!replyText.trim() || sending}
                className="focus-ring inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm transition hover:-translate-y-0.5"
                data-testid={`button-send-reply-${message.id}`}
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send
              </button>
            </div>
          </div>
        </form>
      )}
    </article>
  );
}

export function CaseloadTeamInbox({
  title = 'Team Inbox',
  inbox,
  loading,
  error,
  sending,
  markingRead,
  searchTerm,
  selectedChildId,
  selectedRole,
  onSelectChild,
  onSelectRole,
  onSearch,
  onMarkRead,
  onReply,
  onOpenProfile,
}: CaseloadTeamInboxProps) {
  const [localSearch, setLocalSearch] = useState(searchTerm);
  useEffect(() => setLocalSearch(searchTerm), [searchTerm]);

  const childNameById = useMemo(() => new Map((inbox?.children ?? []).map((child) => [child.childId, child.childName])), [inbox?.children]);

  const filteredMessages = useMemo(() => {
    return (inbox?.messages ?? []).filter(m => {
      if (selectedChildId && m.childId !== selectedChildId) return false;
      if (selectedRole && m.senderRole !== selectedRole) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return m.body.toLowerCase().includes(term) || m.senderName.toLowerCase().includes(term) || (childNameById.get(m.childId) ?? '').toLowerCase().includes(term);
      }
      return true;
    });
  }, [inbox?.messages, selectedChildId, selectedRole, searchTerm, childNameById]);

  if (loading && !inbox) {
    return (
      <div className="flex flex-col rounded-3xl border border-border bg-card soft-shadow h-[500px] p-6" data-testid="caseload-inbox-loading">
        <div className="flex items-center justify-between mb-6">
          <div className="skeleton h-8 w-48 rounded-lg" />
          <div className="flex gap-2">
            <div className="skeleton h-8 w-32 rounded-lg" />
            <div className="skeleton h-8 w-32 rounded-lg" />
          </div>
        </div>
        <div className="skeleton h-10 w-full rounded-xl mb-6" />
        <div className="space-y-4 flex-1 overflow-hidden">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-32 w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-col rounded-3xl border border-border bg-card soft-shadow h-[600px] max-h-[80vh]" data-testid="caseload-team-inbox">
      <header className="border-b border-border/50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="serif text-xl font-semibold text-foreground">{title}</h2>
            {inbox && inbox.totalUnread > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground tracking-wider uppercase" data-testid="badge-total-unread">{inbox.totalUnread} new</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedChildId ?? ''}
              onChange={e => onSelectChild(e.target.value ? Number(e.target.value) : undefined)}
              className="focus-ring rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium transition hover:border-border/80"
              data-testid="select-caseload-child"
            >
              <option value="">All children</option>
              {inbox?.children.map(c => <option key={c.childId} value={c.childId}>{c.childName}</option>)}
            </select>

            <select
              value={selectedRole ?? ''}
              onChange={e => onSelectRole(e.target.value ? e.target.value : undefined)}
              className="focus-ring rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium transition hover:border-border/80"
              data-testid="select-caseload-role"
            >
              <option value="">All roles</option>
              {CASELOAD_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSearch(localSearch.trim()); }} className="flex gap-2">
          <label htmlFor="caseload-search" className="sr-only">Search messages</label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              id="caseload-search"
              data-testid="input-caseload-search"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search messages, child, or sender..."
              className="focus-ring w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-9 text-sm transition hover:border-border/80"
            />
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => { setLocalSearch(''); onSearch(''); }}
              className={`focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-secondary ${localSearch ? '' : 'invisible'}`}
            >
              <X size={14} />
            </button>
          </div>
          <button type="submit" data-testid="button-caseload-search" className="focus-ring rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary/75 transition">
            Search
          </button>
        </form>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {error && !inbox?.messages && (
          <div className="rounded-xl bg-destructive/5 p-4 text-sm text-destructive border border-destructive/20 mb-4" data-testid="caseload-inbox-error">
            <p className="font-semibold flex items-center gap-2"><AlertCircle size={16} /> Failed to load messages</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {filteredMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground p-8 animate-rise" data-testid="caseload-inbox-empty">
            <div className="grid size-16 place-items-center rounded-2xl bg-secondary text-primary/40 mb-4"><MessageCircle size={28} /></div>
            <p className="serif text-lg font-semibold text-foreground">No messages found</p>
            <p className="mt-2 text-sm max-w-[250px] leading-relaxed">
              {searchTerm || selectedChildId || selectedRole
                ? 'Try adjusting your filters or search term to see more.'
                : 'When care teams share updates, they will appear here.'}
            </p>
          </div>
        ) : (
          filteredMessages.map(message => (
            <CompactMessageItem
              key={message.id}
              message={message}
              childName={message.childName || childNameById.get(message.childId) || 'Child'}
              markingRead={markingRead}
              onMarkRead={(id) => onMarkRead([id])}
              onReply={onReply}
              onOpenProfile={onOpenProfile}
              sending={sending}
              error={error}
            />
          ))
        )}
      </div>
    </section>
  );
}