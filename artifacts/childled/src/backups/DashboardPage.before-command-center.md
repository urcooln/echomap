# DashboardPage restore checkpoint

This file is the exact pre-Command-Center implementation of the SLP home screen. It is intentionally stored as Markdown so it cannot be bundled into the running application.

To restore, replace the `DashboardPage` function in `artifacts/childled/src/App.tsx` with the function below. The surrounding Clerk authentication, routes, navigation, API queries, and child-profile functionality remain unchanged.

```tsx
function DashboardPage({ dashboard, loading, child, childrenList, selectedId, onChangeChild, onAddChild, onObserve, focusInsights, focusInsightsLoading, canGenerateFocusAreas, generatingFocusAreas, focusAreaError, onGenerateFocusAreas }: {
  dashboard?: Dashboard; loading: boolean; child?: Child; childrenList: Child[]; selectedId?: number; onChangeChild: (id: number) => void; onAddChild: () => void; onObserve: () => void; focusInsights?: ClinicalKnowledgeInsight[]; focusInsightsLoading: boolean; canGenerateFocusAreas: boolean; generatingFocusAreas: boolean; focusAreaError?: string; onGenerateFocusAreas?: () => void;
}) {
  if (loading) return <LoadingBlocks />;
  const data = dashboard;
  const activeChild = data?.child ?? child;
  const clinicalSummary = data?.snapshot?.sessionChange.clinicalSummary
    ?? `Record a reviewed session to begin identifying changes in ${activeChild?.name ?? 'this child'}’s communication.`;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-5 animate-rise">
        <div className="max-w-4xl"><p className="mono mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Clinical intelligence · {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p><h1 data-testid="clinical-summary" className="serif text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{clinicalSummary}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">A quick view of confirmed Child communication evidence, designed to make the next clinical conversation easier.</p></div>
        <ChildSwitcher children={childrenList} selectedId={selectedId} onChange={onChangeChild} onAdd={onAddChild} />
      </div>
      <ClinicalChangeSection snapshot={data?.snapshot} />
      <ChildSnapshotSection snapshot={data?.snapshot} childId={activeChild?.id} />
      <SuggestedFocusAreas insights={focusInsights} loading={focusInsightsLoading} canGenerate={canGenerateFocusAreas} generating={generatingFocusAreas} error={focusAreaError} onGenerate={onGenerateFocusAreas} />
      <div className="grid gap-5 md:grid-cols-[1.35fr_.65fr]">
        <section className="rounded-2xl border border-border bg-card p-6 soft-shadow animate-rise delay-3">
          <div className="mb-6 flex items-center justify-between"><div><p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Recently added</p><h2 className="serif mt-1 text-2xl font-semibold">New echoes</h2></div><Link href="/dictionary" data-testid="link-view-all-gestalts" className="text-xs font-bold text-primary focus-ring hover:underline">View all</Link></div>
          {data?.recentlyAdded?.length ? <div className="space-y-1">{data.recentlyAdded.slice(0, 4).map((gestalt) => <PhraseRow key={gestalt.id} gestalt={gestalt} />)}</div> : <EmptyState icon={Mic} title="Start with what you hear" body="Begin a reviewed session to add the first phrase to this child’s shared dictionary." action={<Link href="/session" data-testid="button-empty-add-phrase" className="inline-flex focus-ring items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-primary"><Mic size={16} /> Review a session phrase</Link>} />}
        </section>
        <section className="rounded-2xl border border-border bg-secondary/55 p-6 animate-rise delay-4"><div className="mb-5 flex items-center justify-between"><div><p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">At a glance</p><h2 className="serif mt-1 text-2xl font-semibold">Their language</h2></div><BookOpen className="text-primary" size={20} /></div><div className="grid grid-cols-2 gap-3"><Stat label="Mapped phrases" value={activeChild?.gestaltCount ?? data?.recentlyAdded?.length ?? 0} /><Stat label="Team members" value={activeChild?.team?.length ?? 0} /></div><div className="mt-6 border-t border-primary/10 pt-5"><p className="text-xs leading-5 text-muted-foreground">Most phrases are invitations to connect, not problems to solve.</p><Link href="/children" data-testid="link-view-profile" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">View communication profile <ArrowRight size={14} /></Link></div></section>
      </div>
      <div className="grid gap-5 md:grid-cols-2 animate-rise delay-4">
        <section className="rounded-2xl border border-border bg-card p-6 soft-shadow"><div className="mb-5 flex items-center justify-between"><div><p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Team pulse</p><h2 className="serif mt-1 text-2xl font-semibold">What’s moving</h2></div><Link href="/activity" data-testid="link-view-activity" className="grid size-8 focus-ring place-items-center rounded-lg bg-muted text-muted-foreground"><ArrowRight size={16} /></Link></div>{data?.activity?.length ? <div className="space-y-4">{data.activity.slice(0, 3).map((item) => <ActivityRow key={item.id} item={item} />)}</div> : <p className="text-sm text-muted-foreground">Your team’s first notes will appear here.</p>}</section>
        <section className="rounded-2xl border border-border bg-card p-6 soft-shadow"><div className="mb-5 flex items-center justify-between"><div><p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Observations</p><h2 className="serif mt-1 text-2xl font-semibold">Small moments</h2></div><Button variant="outline" className="px-3 py-2 text-xs" onClick={onObserve} data-testid="button-add-observation"><Plus size={14} /> Note</Button></div>{data?.observations?.length ? <div className="space-y-4">{data.observations.slice(0, 2).map((item) => <ObservationCard key={item.id} observation={item} />)}</div> : <EmptyState icon={Lightbulb} title="Notice something?" body="Capture the context around a moment so the next person can recognize it too." action={<Button variant="outline" onClick={onObserve} data-testid="button-empty-observe">Add an observation</Button>} />}</section>
      </div>
    </div>
  );
}
```