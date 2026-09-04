import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetClinicianLearningCenter,
  useUpdateClinicianLearningProgress,
  useGetClinicianLearningPreferences,
  useUpdateClinicianLearningPreferences,
  getGetClinicianLearningCenterQueryKey,
  getGetClinicianLearningPreferencesQueryKey
} from '@workspace/api-client-react';
import { AlertTriangle, Check, FileDown, Loader2, Lightbulb, Bookmark, Search } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ClinicianLearningContent } from '@/components/clinician-learning-content';

export function ClinicianLearningPage() {
  const [, setLocation] = useLocation();
  const [selectedModuleKey, setSelectedModuleKey] = useState(
    () => new URLSearchParams(window.location.search).get('module'),
  );

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: centerData, isLoading, isError, refetch } = useGetClinicianLearningCenter();
  const { data: prefs } = useGetClinicianLearningPreferences();

  const updateProgress = useUpdateClinicianLearningProgress();
  const updatePrefs = useUpdateClinicianLearningPreferences();

  useEffect(() => {
    if (!selectedModuleKey && centerData?.modules?.length) {
      const targetKey = centerData.lastViewedModuleKey || centerData.modules[0].moduleKey;
       setSelectedModuleKey(targetKey);
       setLocation(`/clinician-learning?module=${encodeURIComponent(targetKey)}`);
    }
  }, [centerData, selectedModuleKey, setLocation]);

  const initializedForModule = useRef<string | null>(null);
  useEffect(() => {
    if (selectedModuleKey && centerData && !isLoading) {
      if (initializedForModule.current !== selectedModuleKey) {
        initializedForModule.current = selectedModuleKey;
        updateProgress.mutate({
          data: { moduleKey: selectedModuleKey, markViewed: true }
        }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetClinicianLearningCenterQueryKey() });
          }
        });
      }
    }
  }, [selectedModuleKey, centerData, isLoading, updateProgress, queryClient]);

  const handleDownload = () => {
    setDownloading(true);
    setDownloadError('');
    try {
      const a = document.createElement('a');
      a.href = '/api/clinician-learning-center/download';
      a.download = 'EchoMap-Clinician-Learning-Handbook.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => setDownloading(false), 500);
    } catch {
        setDownloadError('The protected clinician handbook could not be downloaded. Please try again.');
      setDownloading(false);
    }
  };
  const selectModule = (moduleKey: string) => {
    setSelectedModuleKey(moduleKey);
    setLocation(`/clinician-learning?module=${encodeURIComponent(moduleKey)}`);
  };

  if (isLoading) {
    return (
      <div className="flex animate-pulse space-x-6 min-h-[60vh]">
        <div className="hidden w-72 space-y-4 md:block">
          <div className="h-40 rounded-3xl bg-secondary/50" />
          <div className="h-96 rounded-3xl bg-secondary/50" />
        </div>
        <div className="flex-1 space-y-6">
          <div className="h-16 rounded-2xl bg-secondary/50" />
          <div className="h-64 rounded-3xl bg-secondary/50" />
        </div>
      </div>
    );
  }

  if (isError || !centerData) {
    return <section className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-8 text-center"><AlertTriangle className="mx-auto text-accent" /><h1 className="serif mt-4 text-3xl font-semibold">Learning Center unavailable</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Your private progress and child records were not changed. Try loading the professional library again.</p><Button className="mt-5" onClick={() => refetch()}>Try again</Button></section>;
  }

   const matchesSearch = (module: any) => {
     if (!search) return true;
     const q = search.toLowerCase();
     const searchable = [
       module.title,
       module.summary,
       module.category,
       ...(module.tags ?? []),
       ...(module.sections ?? []).flatMap((section: any) => [
         section.heading,
         section.body,
         section.callout,
         section.clinicalNote,
         ...(section.bullets ?? []),
         ...(section.checklist ?? []),
         ...Object.values(section.example ?? {}),
         ...(section.links ?? []).map((link: any) => link.label),
       ]),
     ].filter(Boolean).join(' ').toLowerCase();
     return searchable.includes(q);
   };
   const visibleModules = centerData.modules.filter(matchesSearch);
   const activeModule = centerData.modules.find((m: any) => m.moduleKey === selectedModuleKey);
  const isCoachingEnabled = prefs?.workflowCoachingEnabled ?? centerData.workflowCoachingEnabled;

  return (
    <div className="flex flex-col md:flex-row gap-8 lg:gap-12 animate-rise delay-1">
      <aside className="hidden md:flex w-72 shrink-0 flex-col gap-6">
        <div className="rounded-3xl border border-border bg-card p-6 soft-shadow">
          <p className="mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Library</p>
          <h2 className="serif mt-2 text-2xl font-semibold leading-tight">{centerData.title}</h2>
          <div className="mt-5 space-y-2">
             <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                <span>Overall Progress</span>
                <span>{Math.round(centerData.completionPercentage)}%</span>
             </div>
             <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${centerData.completionPercentage}%` }} />
             </div>
          </div>
          {centerData.downloadAvailable && (
               <Button
               variant="outline"
               onClick={handleDownload}
               disabled={downloading}
               className="mt-6 w-full flex items-center gap-2"
             >
               {downloading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                {downloading ? 'Preparing...' : 'Download Handbook'}
             </Button>
          )}
           {downloadError && <p role="alert" className="mt-3 text-xs leading-5 text-destructive">{downloadError}</p>}
        </div>

        <nav className="rounded-3xl border border-border bg-card py-4 soft-shadow flex flex-col gap-1">
           <div className="px-5 pb-3 pt-1">
             <Label htmlFor="clinician-learning-search" className="sr-only">Search the clinician learning library</Label>
             <div className="relative">
               <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
               <input
                 type="search"
                 id="clinician-learning-search"
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 placeholder="Search guides..."
                 className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-xs focus-ring"
               />
             </div>
           </div>
           {centerData.categories.map((cat: string) => {
              const catModules = visibleModules.filter((m: any) => m.category === cat);
             if (!catModules.length) return null;
             return (
               <div key={cat} className="mb-2">
                 <h3 className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{cat}</h3>
                 <ul className="px-2 space-y-0.5">
                   {catModules.map((m: any) => {
                     const isActive = m.moduleKey === selectedModuleKey;
                     return (
                       <li key={m.moduleKey}>
                         <button
                            onClick={() => selectModule(m.moduleKey)}
                            aria-current={isActive ? 'page' : undefined}
                           className={`focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${isActive ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground hover:bg-secondary'}`}
                         >
                           <div className={`grid size-6 shrink-0 place-items-center rounded-full border ${isActive ? 'border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground' : m.completed ? 'border-transparent bg-accent text-primary' : 'border-primary/20 bg-background text-muted-foreground'}`}>
                             {m.completed ? <Check size={12} strokeWidth={3} /> : <span className="text-[10px]">{m.position}</span>}
                           </div>
                           <span className="line-clamp-2 flex-1 leading-snug">{m.title}</span>
                           {m.bookmarked && <Bookmark size={14} className={isActive ? 'text-primary-foreground/80' : 'text-accent'} />}
                         </button>
                       </li>
                     );
                   })}
                 </ul>
               </div>
             );
           })}
        </nav>
      </aside>

      <main className="flex-1 min-w-0">
         <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6 mb-8">
            <div>
              <h1 className="serif text-3xl font-semibold text-foreground">Clinician Learning</h1>
              <p className="mt-1 text-sm text-muted-foreground">{centerData.description}</p>
            </div>

          <div className="mb-7 space-y-3 rounded-2xl border border-border bg-card p-4 soft-shadow md:hidden">
            <Label htmlFor="clinician-learning-search-mobile">Search the library</Label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                id="clinician-learning-search-mobile"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search topics, examples, or tags"
                className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm focus-ring"
              />
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {visibleModules.length ? visibleModules.map((module: any) => (
                <button
                  key={module.moduleKey}
                  type="button"
                  onClick={() => selectModule(module.moduleKey)}
                  aria-current={module.moduleKey === selectedModuleKey ? 'page' : undefined}
                  className={`focus-ring flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${
                    module.moduleKey === selectedModuleKey
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-secondary'
                  }`}
                >
                  {module.completed ? <Check size={14} /> : null}
                  <span>{module.title}</span>
                </button>
              )) : (
                <p className="py-3 text-center text-sm text-muted-foreground">No learning resources match “{search}”.</p>
              )}
            </div>
          </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 shadow-sm">
               <div className="rounded-full bg-primary/10 p-1.5 text-primary">
                 <Lightbulb size={16} />
               </div>
               <Label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                 Workflow Coaching
                 <Switch
                   checked={isCoachingEnabled}
                   onCheckedChange={(checked) => {
                     updatePrefs.mutate({ data: { workflowCoachingEnabled: checked } }, {
                        onSuccess: () => {
                           queryClient.invalidateQueries({ queryKey: getGetClinicianLearningPreferencesQueryKey() });
                           queryClient.invalidateQueries({ queryKey: getGetClinicianLearningCenterQueryKey() });
                        }
                     });
                   }}
                 />
               </Label>
            </div>
         </div>

         {activeModule ? (
           <div className="mx-auto max-w-3xl">
              <section className="mb-8 rounded-2xl border border-accent/30 bg-accent/5 p-5" aria-labelledby="learning-safety-title">
                <h2 id="learning-safety-title" className="font-semibold text-primary">Educational safety boundary</h2>
                <ul className="mt-3 grid gap-2 text-sm leading-6 text-foreground/85 sm:grid-cols-2">
                  <li>Content is educational only.</li>
                  <li>It does not make diagnoses or assign NLA stages automatically.</li>
                  <li>It does not generate treatment recommendations.</li>
                  <li>Resources never modify child records, remain separate from clinical documentation, and do not replace clinician judgment.</li>
                </ul>
              </section>
              <nav aria-label="Module sections" className="mb-8 rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">In this module</p>
                <div className="mt-3 flex flex-wrap gap-2">{activeModule.sections.map((section: any, index: number) => <button key={section.sectionKey ?? section.heading} type="button" onClick={() => {
                  const sectionKey = section.sectionKey ?? `${activeModule.moduleKey}-${index + 1}`;
                  document.getElementById(sectionKey)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  updateProgress.mutate({ data: { moduleKey: activeModule.moduleKey, markViewed: true, lastSectionKey: sectionKey, progressPercent: Math.round(((index + 1) / activeModule.sections.length) * 100) } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetClinicianLearningCenterQueryKey() }) });
                }} className="focus-ring rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:bg-secondary">{index + 1}. {section.heading}</button>)}</div>
                {activeModule.progressPercent > 0 && <div className="mt-3 flex flex-wrap items-center gap-3"><p className="text-xs text-muted-foreground">Saved reading progress: {activeModule.progressPercent}%</p>{activeModule.lastSectionKey && <button type="button" className="text-xs font-semibold text-primary underline underline-offset-4" onClick={() => document.getElementById(activeModule.lastSectionKey!)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Resume saved section</button>}</div>}
              </nav>
             <ClinicianLearningContent
               module={activeModule}
                onSectionSelect={(sectionKey, progressPercent) => {
                  updateProgress.mutate({ data: { moduleKey: activeModule.moduleKey, markViewed: true, lastSectionKey: sectionKey, progressPercent } }, {
                    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetClinicianLearningCenterQueryKey() }),
                  });
                }}
               onToggleBookmark={() => {
                 updateProgress.mutate({ data: { moduleKey: activeModule.moduleKey, bookmarked: !activeModule.bookmarked } }, {
                   onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetClinicianLearningCenterQueryKey() })
                 });
               }}
               onToggleCompleted={() => {
                 updateProgress.mutate({ data: { moduleKey: activeModule.moduleKey, completed: !activeModule.completed } }, {
                   onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetClinicianLearningCenterQueryKey() })
                 });
               }}
             />

             <div className="mt-12 flex items-center justify-between border-t border-border pt-8 pb-12">
               <p className="text-xs text-muted-foreground italic text-center w-full max-w-lg mx-auto leading-relaxed">
                 {centerData.disclaimer}
               </p>
             </div>
           </div>
         ) : (
             <div className="flex min-h-[40vh] flex-col items-center justify-center text-center text-muted-foreground">
               <Search size={24} /><p className="mt-3 font-semibold text-foreground">No modules match this search</p><p className="mt-1 text-sm">Try a broader topic, workflow, or example term.</p>
           </div>
         )}
      </main>
    </div>
  );
}