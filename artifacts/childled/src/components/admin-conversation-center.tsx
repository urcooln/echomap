import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListChildren,
  useListAdminTeamConversations,
  useGetAdminChildPermissions,
  useUpdateAdminChildPermission,
  getGetAdminChildPermissionsQueryKey,
} from '@workspace/api-client-react';
import type { AdminTeamConversationMessage, AdminChildPermission } from '@workspace/api-client-react';
import {
  Search,
  Shield,
  Users,
  MessageSquare,
  Calendar,
  Filter,
  AlertCircle,
  UserRound,
  BookOpen,
  Activity,
  CircleHelp,
  Bell,
  RefreshCcw,
} from 'lucide-react';

function formatDateTime(dateString: string) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return dateString;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';
}

function MessageIcon({ type }: { type: AdminTeamConversationMessage['messageType'] }) {
  switch (type) {
    case 'message':
      return <MessageSquare size={16} />;
    case 'question':
      return <CircleHelp size={16} />;
    case 'update':
      return <Activity size={16} />;
    case 'notification':
      return <Bell size={16} />;
    default:
      return <MessageSquare size={16} />;
  }
}

function ConversationsTab() {
  const [filters, setFilters] = useState({
    student: '',
    phrase: '',
    sender: '',
    date: '',
    keyword: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({
    student: '',
    phrase: '',
    sender: '',
    date: '',
    keyword: '',
  });

  const activeParams = Object.fromEntries(
    Object.entries(appliedFilters).filter(([_, v]) => v.trim() !== '')
  );

  const { data: searchResults, isLoading, isError } = useListAdminTeamConversations(activeParams);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedFilters(filters);
  };

  const handleClear = () => {
    const empty = { student: '', phrase: '', sender: '', date: '', keyword: '' };
    setFilters(empty);
    setAppliedFilters(empty);
  };

  const hasActiveFilters = Object.values(appliedFilters).some((v) => v !== '');

  return (
    <div className="grid gap-8 lg:grid-cols-4">
      {/* Sidebar Filters */}
      <div className="lg:col-span-1">
        <form
          onSubmit={handleApply}
          className="rounded-3xl border border-border bg-card p-4 soft-shadow lg:sticky lg:top-20 lg:p-6"
          data-testid="form-search-filters"
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="serif flex items-center gap-2 text-xl font-semibold">
              <Filter size={18} className="text-primary" /> Filters
            </h2>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClear}
                data-testid="button-clear-filters"
                className="text-xs font-semibold text-muted-foreground hover:text-foreground focus-ring rounded"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="filter-student" className="text-xs font-semibold text-muted-foreground">
                Student Name
              </label>
              <div className="relative">
                <UserRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
                <input
                  id="filter-student"
                  type="text"
                  data-testid="input-filter-student"
                  value={filters.student}
                  onChange={(e) => setFilters({ ...filters, student: e.target.value })}
                  placeholder="Filter by student..."
                  className="w-full rounded-xl border border-border/50 bg-secondary/30 py-2 pl-9 pr-3 text-sm focus-ring"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="filter-keyword" className="text-xs font-semibold text-muted-foreground">
                Keyword
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
                <input
                  id="filter-keyword"
                  type="text"
                  data-testid="input-filter-keyword"
                  value={filters.keyword}
                  onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                  placeholder="Search in body..."
                  className="w-full rounded-xl border border-border/50 bg-secondary/30 py-2 pl-9 pr-3 text-sm focus-ring"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="filter-phrase" className="text-xs font-semibold text-muted-foreground">
                Specific Phrase
              </label>
              <div className="relative">
                <BookOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
                <input
                  id="filter-phrase"
                  type="text"
                  data-testid="input-filter-phrase"
                  value={filters.phrase}
                  onChange={(e) => setFilters({ ...filters, phrase: e.target.value })}
                  placeholder="Filter by gestalt..."
                  className="w-full rounded-xl border border-border/50 bg-secondary/30 py-2 pl-9 pr-3 text-sm focus-ring"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="filter-sender" className="text-xs font-semibold text-muted-foreground">
                Sender Name
              </label>
              <div className="relative">
                <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
                <input
                  id="filter-sender"
                  type="text"
                  data-testid="input-filter-sender"
                  value={filters.sender}
                  onChange={(e) => setFilters({ ...filters, sender: e.target.value })}
                  placeholder="Filter by sender..."
                  className="w-full rounded-xl border border-border/50 bg-secondary/30 py-2 pl-9 pr-3 text-sm focus-ring"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="filter-date" className="text-xs font-semibold text-muted-foreground">
                Date
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
                <input
                  id="filter-date"
                  type="date"
                  data-testid="input-filter-date"
                  value={filters.date}
                  onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                  className="w-full rounded-xl border border-border/50 bg-secondary/30 py-2 pl-9 pr-3 text-sm focus-ring min-h-[38px] appearance-none"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            data-testid="button-apply-filters"
              className="mt-6 min-h-11 w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 hover:shadow-md focus-ring"
          >
            Apply Filters
          </button>
        </form>
      </div>

      {/* Main Results Area */}
      <div className="lg:col-span-3">
        {isLoading ? (
          <div className="space-y-4" data-testid="status-loading-conversations">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center text-destructive">
            <AlertCircle className="mx-auto mb-2 opacity-80" size={24} />
            <p className="font-semibold">Unable to load conversations</p>
            <p className="mt-1 text-sm opacity-80">Please check your connection and try again.</p>
          </div>
        ) : searchResults?.messages.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border py-20 text-center"
            data-testid="empty-state-conversations"
          >
            <div className="mb-4 grid size-12 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
              <Search size={24} />
            </div>
            <h3 className="serif text-xl font-semibold">No conversations found</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {hasActiveFilters
                ? 'Try adjusting your filters to see more results across your organization.'
                : 'There are no team conversations currently available in your organization.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleClear}
                data-testid="button-clear-filters-empty"
                className="mt-6 rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 focus-ring"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mb-2 text-sm font-semibold text-muted-foreground">
              Showing {searchResults?.messages.length} of {searchResults?.total} messages
            </div>
            {searchResults?.messages.map((message) => (
              <div
                key={message.id}
                data-testid={`conversation-item-${message.id}`}
                className="brand-card rounded-2xl border bg-card p-5 soft-shadow transition-colors hover:border-primary/20"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">
                      <UserRound size={12} className="opacity-70" />
                      {message.childName}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary/50 px-2 py-1 text-xs font-semibold text-muted-foreground">
                      <Shield size={12} className="opacity-70" />
                      {message.audience.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatDateTime(message.createdAt)}
                  </span>
                </div>

                <div className="flex gap-3 sm:gap-4">
                  <div className="mt-1 shrink-0">
                    <div className="grid size-10 place-items-center rounded-full bg-secondary text-xs font-bold text-foreground shadow-sm ring-2 ring-card">
                      {getInitials(message.senderName)}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {message.senderName}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {message.senderRole}
                      </span>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-secondary/10 p-4">
                      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <MessageIcon type={message.messageType} />
                        {message.messageType}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {message.body}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PermissionRow({
  member,
  childId,
}: {
  member: AdminChildPermission;
  childId: number;
}) {
  const queryClient = useQueryClient();
  const updatePermission = useUpdateAdminChildPermission();

  const handleToggle = () => {
    updatePermission.mutate(
      {
        userId: member.userId,
        data: { childId, assigned: !member.assigned },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetAdminChildPermissionsQueryKey({ childId }),
          });
        },
      }
    );
  };

  return (
    <div className="flex flex-col items-stretch gap-4 rounded-xl border border-border/50 bg-secondary/10 p-4 transition-colors hover:bg-secondary/20 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-xs font-bold text-foreground shadow-sm border border-border/50">
          {getInitials(member.name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{member.name}</p>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-primary">{member.role}</span>
            {member.email && (
              <>
                <span className="opacity-50">•</span>
                <span className="break-all">{member.email}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {updatePermission.isError && (
          <span className="text-xs text-destructive flex items-center gap-1" data-testid={`error-permission-${member.userId}`}>
            <AlertCircle size={12} /> Error
          </span>
        )}
        <label className="relative inline-flex cursor-pointer items-center focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 rounded-full focus-ring">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={member.assigned}
            onChange={handleToggle}
            disabled={updatePermission.isPending}
            data-testid={`toggle-assign-${member.userId}`}
            aria-label={`Assign ${member.name}`}
          />
          <div className="h-6 w-11 rounded-full bg-muted peer-checked:bg-primary transition-colors peer-disabled:opacity-50"></div>
          <div className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-full"></div>
        </label>
      </div>
    </div>
  );
}

function PermissionsManager({ childId, childName }: { childId: number; childName: string }) {
  const { data: permissionsData, isLoading, isError, refetch } = useGetAdminChildPermissions({ childId });

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="status-loading-permissions">
        <div className="skeleton h-8 w-1/3 rounded-lg" />
        <div className="skeleton h-20 w-full rounded-xl" />
        <div className="skeleton h-20 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !permissionsData) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center text-destructive">
        <AlertCircle className="mx-auto mb-2 opacity-80" size={24} />
        <p className="font-semibold">Unable to load permissions</p>
        <button
          onClick={() => refetch()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20"
        >
          <RefreshCcw size={14} /> Retry
        </button>
      </div>
    );
  }

  const { members } = permissionsData;
  const assignedCount = members.filter((m) => m.assigned).length;

  return (
    <div className="animate-rise delay-2">
      <div className="mb-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="serif text-xl font-semibold text-foreground">
            Team Access: {childName}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage which organization members have access to this student's workspace.
          </p>
        </div>
        <div className="self-start rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground sm:self-auto">
          {assignedCount} member{assignedCount !== 1 ? 's' : ''} assigned
        </div>
      </div>

      {members.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <Users className="mx-auto mb-3 opacity-50" size={24} />
          <p className="text-sm font-medium text-foreground">No organization members found</p>
          <p className="mt-1 text-xs">Invite members to your organization to assign them.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
            <PermissionRow key={member.userId} member={member} childId={childId} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssignmentsTab() {
  const { data: children, isLoading: childrenLoading, isError } = useListChildren();
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);

  useEffect(() => {
    if (children && children.length > 0 && selectedChildId === null) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  if (childrenLoading) {
    return (
      <div className="grid gap-8 lg:grid-cols-4" data-testid="status-loading-assignments">
        <div className="lg:col-span-1">
          <div className="skeleton h-96 w-full rounded-3xl" />
        </div>
        <div className="lg:col-span-3">
          <div className="skeleton h-64 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (isError || !children) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center text-destructive">
        <AlertCircle className="mx-auto mb-2 opacity-80" size={24} />
        <p className="font-semibold">Unable to load students</p>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border py-20 text-center" data-testid="empty-state-assignments">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-secondary/50 text-muted-foreground">
          <UserRound size={24} />
        </div>
        <h3 className="serif text-xl font-semibold">No students in organization</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Add students to your organization to begin managing their team assignments.
        </p>
      </div>
    );
  }

  const selectedChild = children.find((c) => c.id === selectedChildId);

  return (
    <div className="grid gap-8 lg:grid-cols-4">
      {/* Student List Sidebar */}
      <div className="lg:col-span-1">
        <div className="max-h-[42dvh] overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card p-4 soft-shadow lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)]">
          <h2 className="mb-4 px-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Select Student
          </h2>
          <div className="space-y-1">
            {children.map((child) => {
              const isSelected = child.id === selectedChildId;
              return (
                <button
                  key={child.id}
                  onClick={() => setSelectedChildId(child.id)}
                  data-testid={`button-select-child-${child.id}`}
                  className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors focus-ring ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-[0_4px_14px_-6px_hsl(var(--brand-forest-950)/.9)]'
                      : 'text-foreground hover:bg-secondary/60'
                  }`}
                >
                  <span className="truncate font-medium text-sm">{child.name}</span>
                  <Shield size={14} className={isSelected ? 'opacity-100' : 'opacity-30'} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Permissions Main Area */}
      <div className="lg:col-span-3">
        <div className="rounded-3xl border border-border bg-card p-4 soft-shadow sm:p-8">
          {selectedChildId && selectedChild ? (
            <PermissionsManager childId={selectedChildId} childName={selectedChild.name} />
          ) : (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              Select a student to manage their team assignments.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminConversationCenter() {
  const [activeTab, setActiveTab] = useState<'conversations' | 'assignments'>('conversations');

  return (
    <div className="mx-auto max-w-[1400px] animate-rise delay-1">
      <div className="mb-8">
        <p className="mono mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Organization Administration
        </p>
        <h1 className="serif text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Communication Oversight
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Review organization-wide private care-team communications and manage which staff members are
          assigned to each student workspace. This tool respects strict privacy boundaries within your
          organization.
        </p>
      </div>

      <div className="mb-6 flex max-w-full gap-2 overflow-x-auto border-b border-border/50 pb-px sm:mb-8" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'conversations'}
          data-testid="tab-conversations"
          onClick={() => setActiveTab('conversations')}
          className={`px-5 py-3 text-sm font-semibold transition-colors focus-ring border-b-2 ${
            activeTab === 'conversations'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Conversations
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'assignments'}
          data-testid="tab-assignments"
          onClick={() => setActiveTab('assignments')}
          className={`px-5 py-3 text-sm font-semibold transition-colors focus-ring border-b-2 ${
            activeTab === 'assignments'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Team Assignments
        </button>
      </div>

      {activeTab === 'conversations' ? <ConversationsTab /> : <AssignmentsTab />}
    </div>
  );
}

export default AdminConversationCenter;
