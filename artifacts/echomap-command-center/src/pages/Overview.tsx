import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  AlertCircle, ArrowUpRight, CalendarDays, Check,
  ChevronDown, Clock3, ListFilter, Mic2, Search, Sparkles, Users, Inbox, X, MessageCircle, BarChart2
} from 'lucide-react';
import { useGetViewer, useListChildren, useGetTeamInbox, useGetDashboard, getListChildrenQueryKey, getGetTeamInboxQueryKey, getGetViewerQueryKey, getGetDashboardQueryKey } from '@workspace/api-client-react';

function Avatar({ name, color = '#d9b35c', small = false }: { name?: string; color?: string; small?: boolean }) {
  const initials = name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'EM';
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-bold text-[11px] ${small ? 'size-8' : 'size-10'}`} style={{ background: color, color: 'hsl(161 42% 12%)' }}>
      {initials}
    </span>
  );
}

function Pill({ children, warm = false }: { children: React.ReactNode; warm?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${warm ? 'bg-[hsl(46_73%_88%)] text-[hsl(161_42%_12%)]' : 'bg-[hsl(132_28%_91%)] text-[hsl(161_34%_27%)]'}`}>
      {children}
    </span>
  );
}

export default function Overview() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'Family' | 'Teacher' | 'Clinician'>('all');
  const [sortNewest, setSortNewest] = useState(true);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);

  const { data: viewer } = useGetViewer({ query: { queryKey: getGetViewerQueryKey() } });
  const { data: childrenData, isLoading: isLoadingChildren } = useListChildren({ query: { queryKey: getListChildrenQueryKey() } });
  const children = childrenData ?? [];
  const selectedChildId = activeChildId ?? children[0]?.id ?? 0;

  useEffect(() => {
    if (!activeChildId && children[0]) setActiveChildId(children[0].id);
  }, [activeChildId, children]);

  const { data: dashboardData, isLoading: isLoadingDashboard } = useGetDashboard(
    { childId: selectedChildId },
    { query: { enabled: Boolean(selectedChildId), queryKey: getGetDashboardQueryKey({ childId: selectedChildId }) } }
  );
  const { data: teamInbox, isLoading: isLoadingInbox } = useGetTeamInbox(
    { childId: selectedChildId },
    { query: { enabled: Boolean(selectedChildId), queryKey: getGetTeamInboxQueryKey({ childId: selectedChildId }) } }
  );

  const colors = ['#d9b35c', '#a7c5a0', '#d6a69a', '#9bb9c4', '#c2afd0'];
  
  const changes = useMemo(() => {
    const phraseUpdates = (dashboardData?.recentlyAdded ?? []).map((gestalt, index) => ({
      id: `phrase-${gestalt.id}`,
      child: dashboardData?.child.name ?? 'Selected child',
      tone: colors[index % colors.length],
      source: 'Clinician' as const,
      time: new Date(gestalt.dateAdded).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      reason: 'New phrase to review',
      phrase: gestalt.phrase,
      function: gestalt.function,
      detail: gestalt.contexts[0] ?? 'Added to the shared communication dictionary.',
    }));
    const messageUpdates = (teamInbox?.messages ?? []).map((message, index) => ({
      id: `message-${message.id}`,
      child: dashboardData?.child.name ?? 'Selected child',
      tone: colors[(index + phraseUpdates.length) % colors.length],
      source: message.senderRole === 'Parent' ? 'Family' as const : message.senderRole === 'Teacher' ? 'Teacher' as const : 'Clinician' as const,
      time: new Date(message.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      reason: message.messageType === 'question' ? 'Team question' : 'Shared update',
      phrase: message.body,
      function: message.messageType,
      detail: `${message.senderName} · ${message.senderRole}`,
    }));
    return [...phraseUpdates, ...messageUpdates];
  }, [dashboardData, teamInbox]);

  const visibleChanges = useMemo(() => {
    const normalized = query.toLowerCase();
    return changes
      .filter((item) => !dismissed.includes(item.id))
      .filter((item) => filter === 'all' || item.source === filter)
      .filter((item) => `${item.child} ${item.phrase} ${item.function}`.toLowerCase().includes(normalized))
      .sort((a, b) => sortNewest ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id));
  }, [query, filter, sortNewest, dismissed, changes]);

  const unreviewedCount = changes.length - reviewed.length - dismissed.length;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-10 w-full animate-in fade-in duration-500">
      <section className="cc-rise flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="cc-mono mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">{today}</p>
          <h1 className="cc-serif text-4xl font-semibold tracking-tight text-primary md:text-5xl">
            Good morning, {viewer?.name?.split(' ')[0] || 'Clinician'}.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Here’s the clearest place to begin with your caseload today.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link 
            href="/team" 
            data-testid="link-action-team-inbox"
            className="cc-focus inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/20 bg-background px-4 text-sm font-bold text-primary shadow-sm hover:bg-secondary transition-colors"
          >
            <Inbox size={17} /> Team inbox
          </Link>
          <Link 
            href="/session" 
            data-testid="link-action-log-observation"
            className="cc-focus inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-sidebar-accent transition-colors"
          >
            <Mic2 size={17} /> Log an observation
          </Link>
        </div>
      </section>

      <section className="cc-rise grid gap-3 sm:grid-cols-3 delay-75">
        <div className="cc-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="mb-3 flex items-center justify-between">
            <span className="cc-mono text-[9px] font-bold uppercase tracking-[.16em] text-muted-foreground">Needs attention</span>
            <AlertCircle size={17} className="text-accent" />
          </div>
          <div>
            <strong data-testid="stat-unreviewed" className="cc-serif text-3xl text-primary">{unreviewedCount}</strong>
            <p className="mt-1 text-xs text-muted-foreground">updates across {children.length} children</p>
          </div>
        </div>
        <div className="cc-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="mb-3 flex items-center justify-between">
            <span className="cc-mono text-[9px] font-bold uppercase tracking-[.16em] text-muted-foreground">Team pulse</span>
            <Users size={17} className="text-muted-foreground" />
          </div>
          <div>
            <strong data-testid="stat-team-pulse" className="cc-serif text-3xl text-primary">{teamInbox?.messages.length ?? 0}</strong>
            <p className="mt-1 text-xs text-muted-foreground">shared moments this week</p>
          </div>
        </div>
        <div className="cc-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="mb-3 flex items-center justify-between">
            <span className="cc-mono text-[9px] font-bold uppercase tracking-[.16em] text-muted-foreground">Dashboard Status</span>
            <BarChart2 size={17} className="text-muted-foreground" />
          </div>
          <div>
            {isLoadingDashboard ? (
              <div className="h-9 skeleton rounded w-16" />
            ) : (
              <strong data-testid="stat-focus" className="cc-serif text-3xl text-primary">{dashboardData ? 'Ready' : '—'}</strong>
            )}
            <p className="mt-1 text-xs text-muted-foreground">analytics online</p>
          </div>
        </div>
      </section>

      <section className="cc-rise overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground shadow-xl shadow-primary/20 md:p-7 delay-150">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-accent">
              <span className="grid size-6 place-items-center rounded-full bg-accent/20"><Sparkles size={13} /></span>
              <span className="cc-mono text-[9px] font-bold uppercase tracking-[.2em]">Recent changes</span>
            </div>
            <h2 className="cc-serif text-3xl">Start with what moved.</h2>
            <p className="mt-1 text-sm text-primary-foreground/60">
              Unreviewed observations from your care team, held gently for your eyes.
            </p>
          </div>
          <button 
            data-testid="button-mark-visible-reviewed"
            className="cc-focus inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary-foreground/20 px-3 text-xs font-bold hover:bg-primary-foreground/10 transition-colors" 
            onClick={() => setReviewed([...reviewed, ...visibleChanges.map(x => x.id)])}
          >
            <Check size={15} /> Mark visible reviewed
          </button>
        </div>
        
        <div className="mb-5 flex flex-wrap gap-2">
          <label className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute left-3 top-3.5 text-primary-foreground/50" />
            <input 
              data-testid="input-search-changes"
              className="cc-focus min-h-11 w-full rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 pl-10 pr-3 text-sm text-primary-foreground placeholder:text-primary-foreground/50" 
              placeholder="Search children or phrases" 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
            />
          </label>
          <div className="flex rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 p-1" role="group" aria-label="Filter updates">
            {(['all', 'Family', 'Teacher', 'Clinician'] as const).map(x => (
              <button 
                key={x} 
                data-testid={`button-filter-${x.toLowerCase()}`}
                className={`cc-focus rounded-lg px-3 py-2 text-xs font-bold transition-colors ${filter === x ? 'bg-accent text-accent-foreground' : 'text-primary-foreground/70 hover:text-primary-foreground'}`} 
                aria-pressed={filter === x} 
                onClick={() => setFilter(x)}
              >
                {x === 'all' ? 'All' : x}
              </button>
            ))}
          </div>
          <button 
            data-testid="button-toggle-sort"
            className="cc-focus rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 p-3 text-primary-foreground/70 hover:text-primary-foreground transition-colors" 
            aria-label="Change sort order" 
            onClick={() => setSortNewest(!sortNewest)}
          >
            <ListFilter size={17} />
          </button>
        </div>
        
        {visibleChanges.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-primary-foreground/25 px-5 py-10 text-center">
            <Search className="mx-auto mb-3 text-accent" size={25} />
            <p className="cc-serif text-xl">Nothing matches that search.</p>
            <p className="mt-1 text-sm text-primary-foreground/60">Try a child’s name, phrase, or team role.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {visibleChanges.map(item => (
              <article key={item.id} data-testid={`card-change-${item.id}`} className={`rounded-2xl border p-4 transition-all duration-300 ${reviewed.includes(item.id) ? 'border-primary-foreground/10 opacity-60' : 'border-primary-foreground/20 bg-primary-foreground/5'}`}>
                <div className="flex gap-3">
                  <Avatar name={item.child} color={item.tone} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold">{item.child}</h3>
                        <p className="mt-0.5 text-[11px] text-primary-foreground/60">{item.source} · {item.time}</p>
                      </div>
                      <Pill warm>{reviewed.includes(item.id) ? 'Reviewed' : item.reason}</Pill>
                    </div>
                    <p className="cc-serif mt-4 text-xl">“{item.phrase}”</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-primary-foreground/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-accent">{item.function}</span>
                      <span className="text-xs text-primary-foreground/60">{item.detail}</span>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button 
                        data-testid={`button-review-${item.id}`}
                        className="cc-focus min-h-9 rounded-lg bg-accent px-3 text-xs font-bold text-accent-foreground hover:bg-accent/90 transition-colors" 
                        onClick={() => setReviewed(r => r.includes(item.id) ? r.filter(id => id !== item.id) : [...r, item.id])}
                      >
                        {reviewed.includes(item.id) ? 'Mark unreviewed' : 'Review update'}
                      </button>
                      <button 
                        data-testid={`button-dismiss-${item.id}`}
                        className="cc-focus min-h-9 rounded-lg px-2 text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground transition-colors" 
                        aria-label={`Dismiss ${item.child} update`} 
                        onClick={() => setDismissed(d => [...d, item.id])}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr] pb-10">
        <section className="cc-rise delay-200">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="cc-mono text-[9px] font-bold uppercase tracking-[.18em] text-muted-foreground">Caseload</p>
              <h2 className="cc-serif mt-1 text-2xl font-semibold text-primary">Your children</h2>
            </div>
              <button data-testid="button-select-next-child" onClick={() => {
                const currentIndex = children.findIndex((child) => child.id === selectedChildId);
                setActiveChildId(children[(currentIndex + 1) % children.length]?.id ?? null);
              }} disabled={!children.length} className="cc-focus text-xs font-bold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
              View all <ArrowUpRight className="ml-1 inline" size={14} />
            </button>
          </div>
          
          <div className="cc-card overflow-hidden rounded-2xl">
            {isLoadingChildren ? (
              <div className="p-4 space-y-4">
                <div className="h-10 skeleton rounded-lg" />
                <div className="h-10 skeleton rounded-lg" />
                <div className="h-10 skeleton rounded-lg" />
              </div>
            ) : children.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No children assigned to your caseload yet.
              </div>
            ) : (
              children.map((child, i) => (
                <Link 
                  key={child.id}
                  href={`/child/${child.id}`}
                  data-testid={`link-child-${child.id}`}
                  className="cc-focus flex min-h-[74px] w-full items-center gap-3 border-b border-card-border px-4 text-left last:border-0 hover:bg-secondary/50 transition-colors"
                >
                  <Avatar name={child.name} color={colors[i % colors.length]} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm">{child.name}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{child.communicationStyle || 'Building foundation'}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <Pill warm={i % 2 === 0}>{i % 2 === 0 ? 'Review' : 'On track'}</Pill>
                    <p className="mt-1 text-[10px] text-muted-foreground">{i === 0 ? '18 min ago' : i === 1 ? '1 hr ago' : 'Yesterday'}</p>
                  </div>
                  <ChevronDown size={16} className="-rotate-90 text-muted-foreground/60" />
                </Link>
              ))
            )}
          </div>
        </section>

        <div className="space-y-6 cc-rise delay-300">
          <section className="cc-card rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="cc-mono text-[9px] font-bold uppercase tracking-[.18em] text-muted-foreground">Daily focus</p>
                <h2 className="cc-serif mt-1 text-2xl font-semibold text-primary">Two good next steps</h2>
              </div>
              <Clock3 className="text-muted-foreground" size={18} />
            </div>
            <div className="space-y-3">
              <Link 
                href="/session"
                className="cc-focus flex min-h-[62px] w-full items-center gap-3 rounded-xl bg-[hsl(var(--accent-soft))] p-3 text-left hover:brightness-[0.97] transition-all"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Mic2 size={16} />
                </span>
                <span className="flex-1">
                  <strong className="block text-sm text-primary">Prep for {children[0]?.name?.split(' ')[0] || 'Maya'}'s session</strong>
                  <span className="text-xs text-muted-foreground">10:30 AM · 1 update to bring in</span>
                </span>
                <ArrowUpRight size={16} className="text-primary" />
              </Link>
              
              <Link 
                href="/team"
                className="cc-focus flex min-h-[62px] w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-secondary/80 transition-all border border-card-border"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-secondary text-primary">
                  <MessageCircle size={16} />
                </span>
                <span className="flex-1">
                  <strong className="block text-sm">Reply to {children[1]?.name?.split(' ')[0] || 'Oliver'}'s teacher</strong>
                  <span className="text-xs text-muted-foreground">A question from Ms. Kim</span>
                </span>
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </section>

          <section className="rounded-2xl bg-sidebar-accent p-5 text-sidebar-accent-foreground">
            <div className="flex items-center gap-2 text-accent">
              <Inbox size={17} />
              <span className="cc-mono text-[9px] font-bold uppercase tracking-[.18em]">Team activity</span>
            </div>
            
            {isLoadingInbox ? (
              <div className="mt-4 space-y-2">
                <div className="h-4 skeleton rounded" />
                <div className="h-4 skeleton rounded w-2/3" />
              </div>
            ) : teamInbox?.messages?.length ? (
              <>
                <p className="cc-serif mt-3 text-xl leading-snug">“{teamInbox.messages[0].body}”</p>
                <div className="mt-4 flex items-center gap-2">
                  <Avatar name={teamInbox.messages[0].senderName} color="#d9b35c" small />
                  <span className="text-xs text-sidebar-accent-foreground/70">
                    {teamInbox.messages[0].senderName} · {teamInbox.messages[0].senderRole} · Recent
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className="cc-serif mt-3 text-xl leading-snug">No team activity is available for this child yet.</p>
                <p className="mt-3 text-xs text-sidebar-accent-foreground/70">Updates from the authorized child care team will appear here.</p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}