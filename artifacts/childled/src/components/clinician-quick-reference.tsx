import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { useGetClinicianLearningCenter, useUpdateClinicianLearningProgress, getGetClinicianLearningCenterQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, ChevronLeft, BookOpen, Library, X } from 'lucide-react';
import { ClinicianLearningContent } from './clinician-learning-content';

const referencePanelEvent = 'childled:open-clinician-reference';

export function openClinicianQuickReferences(reference?: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('referencePanel', 'true');
  if (reference) url.searchParams.set('reference', reference);
  window.history.pushState({}, '', `${url.pathname}${url.search}`);
  window.dispatchEvent(new CustomEvent(referencePanelEvent, { detail: { reference: reference ?? null } }));
}

export function ClinicianQuickReferencePanel() {
  const initialParams = new URLSearchParams(window.location.search);
  const [panelOpen, setPanelOpen] = useState(initialParams.has('referencePanel') || initialParams.has('reference'));
  const [referenceKey, setReferenceKey] = useState<string | null>(initialParams.get('reference'));

  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: center } = useGetClinicianLearningCenter({
    query: { enabled: panelOpen, queryKey: getGetClinicianLearningCenterQueryKey() }
  });
  const updateProgress = useUpdateClinicianLearningProgress();

  const closePanel = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('reference');
    url.searchParams.delete('referencePanel');
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    setReferenceKey(null);
    setPanelOpen(false);
  };

  const setReference = (key: string | null) => {
    const url = new URL(window.location.href);
    if (key) {
      url.searchParams.set('reference', key);
      url.searchParams.set('referencePanel', 'true');
    } else {
      url.searchParams.delete('reference');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    setReferenceKey(key);
  };

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ reference: string | null }>).detail;
      setReferenceKey(detail.reference);
      setPanelOpen(true);
    };
    window.addEventListener(referencePanelEvent, onOpen);
    return () => window.removeEventListener(referencePanelEvent, onOpen);
  }, []);

  const selectedModule = referenceKey ? center?.modules.find((m: any) => m.moduleKey === referenceKey) : null;

  const filteredModules = center?.modules.filter((m: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.summary.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.tags?.some((t: string) => t.toLowerCase().includes(q))
    );
  });

  const grouped = filteredModules?.reduce((acc: any, m: any) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  return (
    <Sheet open={panelOpen} onOpenChange={(open) => !open && closePanel()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0 border-l border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
           {selectedModule ? (
             <button onClick={() => setReference(null)} className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
               <ChevronLeft size={16} /> Back to Library
             </button>
           ) : (
             <div className="flex items-center gap-2 text-foreground font-semibold serif text-lg">
               <Library size={20} className="text-primary" />
               Quick References
             </div>
           )}
           <SheetClose className="rounded-full p-2 hover:bg-secondary transition-colors focus-ring">
             <X size={18} />
           </SheetClose>
        </div>

        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
           {selectedModule ? (
             <ClinicianLearningContent
               module={selectedModule}
               isPanel
               onToggleBookmark={() => {
                 updateProgress.mutate({ data: { moduleKey: selectedModule.moduleKey, bookmarked: !selectedModule.bookmarked } }, {
                   onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetClinicianLearningCenterQueryKey() })
                 });
               }}
               onToggleCompleted={() => {
                 updateProgress.mutate({ data: { moduleKey: selectedModule.moduleKey, completed: !selectedModule.completed } }, {
                   onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetClinicianLearningCenterQueryKey() })
                 });
               }}
             />
           ) : (
             <div className="space-y-6">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search topics, tags, or guidelines..."
                    className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-4 text-sm focus-ring"
                  />
                </div>

                {!center ? (
                  <div className="py-10 text-center text-sm text-muted-foreground animate-pulse">Loading library...</div>
                ) : filteredModules?.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No references found for "{search}"</div>
                ) : (
                  Object.entries(grouped || {}).map(([cat, mods]: [string, any]) => (
                    <div key={cat} className="space-y-3">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{cat}</h3>
                      <div className="grid gap-2">
                        {mods.map((m: any) => (
                          <button
                            key={m.moduleKey}
                            onClick={() => setReference(m.moduleKey)}
                            className="focus-ring flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/30 hover:bg-secondary/50"
                          >
                            <div className="mt-0.5 shrink-0 text-primary">
                              <BookOpen size={16} />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-foreground">{m.title}</h4>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{m.summary}</p>
                              {m.tags && m.tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {m.tags.slice(0, 3).map((t: string) => (
                                    <span key={t} className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-foreground/75">{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
             </div>
           )}
        </div>
      </SheetContent>
    </Sheet>
  );
}