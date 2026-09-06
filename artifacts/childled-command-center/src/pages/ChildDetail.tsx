import { useParams, Link } from 'wouter';
import { useGetChild, useListGestalts, useGetPhraseTrends, useGetFrequentScripts, getGetChildQueryKey, getListGestaltsQueryKey, getGetPhraseTrendsQueryKey, getGetFrequentScriptsQueryKey } from '@workspace/api-client-react';
import { BookOpen, Mic2, ArrowLeft, TrendingUp, BarChart2 } from 'lucide-react';

export default function ChildDetail() {
  const params = useParams();
  const id = Number(params.id);

  const { data: child, isLoading } = useGetChild({ childId: id }, {
    query: { enabled: !!id, queryKey: getGetChildQueryKey({ childId: id }) }
  });

  const { data: gestaltsData, isLoading: isLoadingGestalts } = useListGestalts({ childId: id }, {
    query: { enabled: !!id, queryKey: getListGestaltsQueryKey({ childId: id }) }
  });

  const { data: trendsData, isLoading: isLoadingTrends } = useGetPhraseTrends({ childId: id }, {
    query: { enabled: !!id, queryKey: getGetPhraseTrendsQueryKey({ childId: id }) }
  });

  const { data: scriptsData, isLoading: isLoadingScripts } = useGetFrequentScripts({ childId: id, window: 'all' }, {
    query: { enabled: !!id, queryKey: getGetFrequentScriptsQueryKey({ childId: id, window: 'all' }) }
  });

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        <div className="h-32 skeleton rounded-3xl"></div>
        <div className="h-64 skeleton rounded-3xl"></div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="cc-card p-10 text-center rounded-3xl">
        <h2 className="cc-serif text-2xl">Child not found</h2>
        <p className="mt-2 text-muted-foreground text-sm">They may have been removed or you don't have access.</p>
        <Link href="/overview" className="mt-6 inline-flex cc-focus rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-bold">Return to overview</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex items-center gap-4">
        <Link href="/overview" className="cc-focus rounded-full p-2 text-muted-foreground hover:bg-secondary transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <p className="cc-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Communication Profile</p>
          <h1 className="cc-serif text-4xl font-bold text-primary mt-1">{child.name}</h1>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <section className="cc-card p-6 md:p-8 rounded-3xl">
            <h2 className="cc-serif text-2xl text-primary mb-6">Language Map Snapshot</h2>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-card-border bg-background p-4">
                <p className="cc-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Confirmed Phrases</p>
                <strong className="cc-serif text-3xl">{child.gestaltCount}</strong>
              </div>
              <div className="rounded-2xl border border-card-border bg-background p-4">
                <p className="cc-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Communication Style</p>
                <strong className="text-sm font-semibold">{child.communicationStyle || 'Building Foundation'}</strong>
              </div>
              <div className="rounded-2xl border border-card-border bg-background p-4">
                <p className="cc-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Grade</p>
                <strong className="text-sm font-semibold">{child.grade} at {child.school}</strong>
              </div>
            </div>

            <div className="mt-8 flex gap-3 flex-wrap">
              <Link href="/session" data-testid="button-record-session" className="cc-focus inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-90 transition-all">
                <Mic2 size={16} /> Record Session
              </Link>
              <Link href="/dictionary" data-testid="button-open-dictionary" className="cc-focus inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-background px-4 py-2.5 text-sm font-bold text-primary shadow-sm hover:bg-secondary transition-all">
                <BookOpen size={16} /> Open Dictionary
              </Link>
            </div>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="cc-card p-6 rounded-3xl">
              <div className="flex items-center gap-2 mb-4 text-primary">
                <TrendingUp size={18} />
                <h3 className="cc-serif text-xl">Recent Phrase Trends</h3>
              </div>
              
              {isLoadingTrends ? (
                <div className="space-y-2">
                  <div className="h-12 skeleton rounded-xl" />
                  <div className="h-12 skeleton rounded-xl" />
                </div>
              ) : !trendsData?.trends?.length ? (
                <p className="text-sm text-muted-foreground italic text-center py-4 bg-background/50 rounded-xl">No phrase trends over the last 30 days.</p>
              ) : (
                <div className="space-y-3">
                  {trendsData.trends.slice(0, 3).map((trend, i) => (
                    <div key={i} className="rounded-xl border border-card-border bg-background p-3 flex items-center justify-between">
                      <p className="font-semibold text-sm truncate pr-2">"{trend.phrase}"</p>
                      <span className="cc-mono text-[10px] font-bold text-accent bg-accent/10 px-2 py-1 rounded">
                        {trend.totalOccurrences}x
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            
            <section className="cc-card p-6 rounded-3xl">
              <div className="flex items-center gap-2 mb-4 text-primary">
                <BarChart2 size={18} />
                <h3 className="cc-serif text-xl">Frequent Scripts</h3>
              </div>
              
              {isLoadingScripts ? (
                <div className="space-y-2">
                  <div className="h-12 skeleton rounded-xl" />
                  <div className="h-12 skeleton rounded-xl" />
                </div>
              ) : !scriptsData?.phrases?.length ? (
                <p className="text-sm text-muted-foreground italic text-center py-4 bg-background/50 rounded-xl">No frequent scripts confirmed yet.</p>
              ) : (
                <div className="space-y-3">
                  {scriptsData.phrases.slice(0, 3).map((script, i) => (
                    <div key={i} className="rounded-xl border border-card-border bg-background p-3">
                      <p className="font-semibold text-sm mb-1 truncate">"{script.phrase}"</p>
                      <p className="text-xs text-muted-foreground truncate">{script.meaning}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="cc-card p-6 md:p-8 rounded-3xl">
            <h2 className="cc-serif text-2xl text-primary mb-6">Recent Dictionary Entries</h2>
            
            {isLoadingGestalts ? (
              <div className="space-y-4">
                <div className="h-16 skeleton rounded-xl" />
                <div className="h-16 skeleton rounded-xl" />
              </div>
              ) : !gestaltsData?.length ? (
              <div className="rounded-xl border border-dashed border-card-border p-8 text-center bg-background/50">
                <BookOpen className="mx-auto mb-3 text-muted-foreground/40" size={24} />
                <p className="font-semibold text-sm">No confirmed phrases yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Start a session or review team updates to build the dictionary.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {gestaltsData.slice(0, 5).map((g) => (
                  <div key={g.id} className="rounded-xl border border-card-border p-4 hover:border-primary/30 transition-colors bg-background/50">
                    <p className="cc-serif text-lg">“{g.phrase}”</p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="rounded bg-accent/20 px-2 py-0.5 font-bold text-accent-foreground">{g.function}</span>
                      <span className="text-muted-foreground truncate">{g.meaning}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="cc-card p-5 rounded-3xl">
            <h3 className="cc-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Care Team</h3>
            <div className="space-y-3">
              {child.team?.length ? (
                child.team.map(member => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="grid size-8 place-items-center rounded-full bg-secondary text-[10px] font-bold text-primary">
                      {member.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{member.name}</p>
                      <p className="text-[10px] text-muted-foreground">{member.role}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">No team members assigned.</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-sidebar-accent p-5 text-sidebar-accent-foreground">
            <h3 className="cc-mono text-[10px] font-bold uppercase tracking-widest text-accent mb-4">Sensory Support</h3>
            {child.sensorySupports?.length ? (
              <ul className="space-y-2">
                {child.sensorySupports.map((support, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-accent mr-2">•</span>{support}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-sidebar-accent-foreground/60 italic">No sensory supports documented yet.</p>
            )}
            
            <h3 className="cc-mono text-[10px] font-bold uppercase tracking-widest text-accent mb-4 mt-6">Strengths & Interests</h3>
            {child.specialInterests?.length ? (
              <div className="flex flex-wrap gap-2">
                {child.specialInterests.map((interest, i) => (
                  <span key={i} className="text-xs font-semibold bg-accent/20 text-accent px-2 py-1 rounded">
                    {interest}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-sidebar-accent-foreground/60 italic">No special interests noted.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}