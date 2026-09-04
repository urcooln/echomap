import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetParentLearningCenter,
  useGetParentLearningModule,
  useUpdateParentLearningProgress,
  useUpdateParentLearningReflection,
  downloadParentLearningHandbook,
  getGetParentLearningCenterQueryKey,
  getGetParentLearningModuleQueryKey,
} from '@workspace/api-client-react';
import {
  BookOpen,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
  Menu,
  Minus,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function FamilyResourcesPage({ childId }: { childId?: number }) {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const selectedModuleKey = searchParams.get('module');
  const [textSize, setTextSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const queryClient = useQueryClient();

  const { data: centerData, isLoading: centerLoading, isError: centerError } = useGetParentLearningCenter(
    { childId: childId! },
    { query: { enabled: !!childId, queryKey: getGetParentLearningCenterQueryKey({ childId: childId! }) } }
  );

  const { data: moduleData, isLoading: moduleLoading, isError: moduleError } = useGetParentLearningModule(
    { childId: childId!, moduleKey: selectedModuleKey! },
    { query: { enabled: !!childId && !!selectedModuleKey, queryKey: getGetParentLearningModuleQueryKey({ childId: childId!, moduleKey: selectedModuleKey! }) } }
  );

  const updateProgress = useUpdateParentLearningProgress();
  const updateReflection = useUpdateParentLearningReflection();

  // Handle Mark Viewed
  const initializedForModule = useRef<string | null>(null);
  useEffect(() => {
    if (childId && selectedModuleKey && centerData && !moduleLoading && moduleData) {
      if (initializedForModule.current !== selectedModuleKey) {
        initializedForModule.current = selectedModuleKey;
        // Mark as viewed
        updateProgress.mutate({
          data: { childId, moduleKey: selectedModuleKey, markViewed: true }
        }, {
          onSuccess: () => {
             queryClient.invalidateQueries({ queryKey: getGetParentLearningCenterQueryKey({ childId }) });
             queryClient.invalidateQueries({ queryKey: getGetParentLearningModuleQueryKey({ childId, moduleKey: selectedModuleKey }) });
          }
        });
      }
    }
  }, [childId, selectedModuleKey, moduleData, moduleLoading, centerData, updateProgress, queryClient]);

  const [reflectionText, setReflectionText] = useState('');
  const lastSavedReflection = useRef<string>('');

  const initReflectionForModule = useRef<string | null>(null);
  useEffect(() => {
    if (moduleData && initReflectionForModule.current !== selectedModuleKey) {
       initReflectionForModule.current = selectedModuleKey;
       setReflectionText(moduleData.reflection || '');
       lastSavedReflection.current = moduleData.reflection || '';
    }
  }, [moduleData, selectedModuleKey]);

  useEffect(() => {
    if (!selectedModuleKey && centerData?.modules.length) {
      const targetKey = centerData.lastViewedModuleKey || centerData.modules[0].moduleKey;
      setLocation(`/family-resources?module=${encodeURIComponent(targetKey)}`);
    }
  }, [centerData, selectedModuleKey, setLocation]);

  if (!childId) {
    return <div className="text-center p-10 text-muted-foreground text-sm">Please select a child to view resources.</div>;
  }

  if (centerLoading) {
    return (
      <div className="flex animate-pulse space-x-6">
        <div className="w-1/3 space-y-4 hidden md:block">
          <div className="h-10 bg-secondary/50 rounded-xl" />
          <div className="h-40 bg-secondary/50 rounded-xl" />
        </div>
        <div className="w-full md:w-2/3 space-y-4">
          <div className="h-40 bg-secondary/50 rounded-xl" />
          <div className="h-64 bg-secondary/50 rounded-xl" />
        </div>
      </div>
    );
  }

  if (centerError || !centerData) {
    return <div className="rounded-3xl border border-border bg-card p-10 text-center text-sm text-muted-foreground" data-testid="parent-learning-center-error">The Learning Center is temporarily unavailable. Please try again shortly.</div>;
  }

  const handleDownloadHandbook = async () => {
    setDownloading(true);
    setDownloadError('');
    try {
      const blob = await downloadParentLearningHandbook({ childId });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EchoMap_Handbook.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error('Failed to download handbook', err);
      setDownloadError('The handbook could not be downloaded. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const saveReflection = () => {
    if (!selectedModuleKey || reflectionText === lastSavedReflection.current) return;
    const body = reflectionText;
    updateReflection.mutate({
      data: { childId, moduleKey: selectedModuleKey, body }
    }, {
      onSuccess: () => {
        lastSavedReflection.current = body.trim();
        queryClient.invalidateQueries({ queryKey: getGetParentLearningCenterQueryKey({ childId }) });
        queryClient.setQueryData(getGetParentLearningModuleQueryKey({ childId, moduleKey: selectedModuleKey }), (old: any) =>
          old ? { ...old, reflection: body.trim() } : old
        );
      }
    });
  };

  const toggleBookmark = () => {
    if (!moduleData) return;
    const newStatus = !moduleData.bookmarked;
    updateProgress.mutate({
      data: { childId, moduleKey: selectedModuleKey!, bookmarked: newStatus }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetParentLearningCenterQueryKey({ childId }) });
        queryClient.setQueryData(getGetParentLearningModuleQueryKey({ childId, moduleKey: selectedModuleKey! }), (old: any) =>
          old ? { ...old, bookmarked: newStatus } : old
        );
      }
    });
  };

  const toggleCompleted = () => {
    if (!moduleData) return;
    const newStatus = !moduleData.completed;
    updateProgress.mutate({
      data: { childId, moduleKey: selectedModuleKey!, completed: newStatus }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetParentLearningCenterQueryKey({ childId }) });
        queryClient.setQueryData(getGetParentLearningModuleQueryKey({ childId, moduleKey: selectedModuleKey! }), (old: any) =>
          old ? { ...old, completed: newStatus } : old
        );
      }
    });
  };

  const currentIndex = centerData.modules.findIndex(m => m.moduleKey === selectedModuleKey);
  const prevModule = currentIndex > 0 ? centerData.modules[currentIndex - 1] : null;
  const nextModule = currentIndex >= 0 && currentIndex < centerData.modules.length - 1 ? centerData.modules[currentIndex + 1] : null;

  const navigateTo = (key: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('module', key);
    setLocation(`/family-resources?${params.toString()}`);
    setMobileMenuOpen(false);
  };

  const textSizeClass = {
    normal: 'text-base',
    large: 'text-lg',
    xlarge: 'text-xl',
  }[textSize];

  const textSizeHeadingClass = {
    normal: 'text-3xl',
    large: 'text-4xl',
    xlarge: 'text-5xl',
  }[textSize];

  return (
    <div className="flex flex-col md:flex-row gap-6 lg:gap-10 animate-rise delay-1" data-testid="page-family-resources">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex w-72 lg:w-80 shrink-0 flex-col gap-6">
        <div className="rounded-3xl border border-border bg-card p-6 soft-shadow">
          <p className="mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Handbook</p>
          <h2 className="serif mt-2 text-xl font-semibold leading-tight" data-testid="text-handbook-title">{centerData.resource.title}</h2>
          <div className="mt-4">
             <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                <span>Overall Progress</span>
                <span data-testid="text-sidebar-completion">{Math.round(centerData.completionPercentage)}%</span>
             </div>
             <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-secondary">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${centerData.completionPercentage}%` }} />
             </div>
          </div>
          {centerData.resource.pdfAvailable && (
             <button onClick={handleDownloadHandbook} disabled={downloading} data-testid="button-download-handbook-desktop" className="focus-ring mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-secondary/70 disabled:opacity-60">
               {downloading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} {downloading ? 'Preparing…' : 'Download PDF'}
            </button>
           )}
           {downloadError && <p className="mt-3 text-xs text-destructive" role="alert" data-testid="download-handbook-error">{downloadError}</p>}
        </div>

        <nav className="rounded-3xl border border-border bg-card p-4 soft-shadow">
          <h3 className="mb-3 px-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Modules</h3>
          <ul className="space-y-1">
            {centerData.modules.map(mod => {
              const isActive = selectedModuleKey === mod.moduleKey;
              return (
                <li key={mod.moduleKey}>
                  <button
                    onClick={() => navigateTo(mod.moduleKey)}
                    data-testid={`button-module-sidebar-${mod.moduleKey}`}
                    className={`focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${isActive ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground hover:bg-secondary'}`}
                  >
                    <div className={`grid size-6 shrink-0 place-items-center rounded-full border ${isActive ? 'border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground' : mod.completed ? 'border-transparent bg-accent text-primary' : 'border-primary/20 bg-background text-muted-foreground'}`}>
                      {mod.completed ? <Check size={12} strokeWidth={3} /> : <span className="text-[10px]">{mod.position}</span>}
                    </div>
                    <span className="line-clamp-2 flex-1 leading-snug">{mod.title}</span>
                    {mod.bookmarked && <Bookmark size={14} className={isActive ? 'text-primary-foreground/80' : 'text-accent'} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between rounded-2xl border border-border bg-card p-4 soft-shadow">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(true)} data-testid="button-mobile-menu-open" className="rounded-lg p-2 bg-secondary text-primary focus-ring">
            <Menu size={20} />
          </button>
          <span className="serif font-semibold truncate" data-testid="text-mobile-title">Learning Center</span>
        </div>
        <div className="text-xs font-bold text-muted-foreground" data-testid="text-mobile-completion">
          {Math.round(centerData.completionPercentage)}% done
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background p-5 md:hidden overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="serif text-2xl font-semibold">{centerData.resource.title}</h2>
            <button onClick={() => setMobileMenuOpen(false)} data-testid="button-mobile-menu-close" className="rounded-full bg-secondary p-2 text-foreground focus-ring">
              <Minus size={20} />
            </button>
          </div>
          <div className="mb-6">
             <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                <span>Overall Progress</span>
                <span>{Math.round(centerData.completionPercentage)}%</span>
             </div>
             <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-secondary">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${centerData.completionPercentage}%` }} />
             </div>
          </div>
          <ul className="space-y-2 flex-1">
            {centerData.modules.map(mod => {
              const isActive = selectedModuleKey === mod.moduleKey;
              return (
                <li key={mod.moduleKey}>
                  <button
                    onClick={() => navigateTo(mod.moduleKey)}
                    data-testid={`button-module-mobile-${mod.moduleKey}`}
                    className={`focus-ring flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary/30 text-foreground'}`}
                  >
                    <div className={`grid size-7 shrink-0 place-items-center rounded-full border ${isActive ? 'border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground' : mod.completed ? 'border-transparent bg-accent text-primary' : 'border-primary/20 bg-background text-muted-foreground'}`}>
                      {mod.completed ? <Check size={14} strokeWidth={3} /> : <span className="text-[11px]">{mod.position}</span>}
                    </div>
                    <span className="line-clamp-2 flex-1 leading-snug">{mod.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {centerData.resource.pdfAvailable && (
             <button onClick={handleDownloadHandbook} disabled={downloading} data-testid="button-download-handbook-mobile" className="focus-ring mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-4 text-sm font-semibold text-foreground disabled:opacity-60">
              <FileDown size={18} /> Download Handbook PDF
            </button>
           )}
        </div>
       )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        {moduleLoading ? (
          <div className="flex h-[50vh] flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="animate-spin mb-4 text-primary" size={32} />
            <p className="text-sm font-medium">Loading module...</p>
          </div>
        ) : moduleError || !moduleData ? (
          <div className="flex h-[50vh] flex-col items-center justify-center text-muted-foreground">
             <p className="text-sm">Module not found.</p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-10">
            {/* Header / Tools */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
              <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                <span>Module {moduleData.position} of {centerData.totalModules}</span>
                <span className="h-1 w-1 rounded-full bg-primary/20" />
                <span data-testid="text-reading-minutes">{moduleData.readingMinutes} min read</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg border border-border bg-card p-1">
                  <button onClick={() => setTextSize('normal')} data-testid="button-text-size-normal" className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${textSize === 'normal' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary/50'}`}>A</button>
                  <button onClick={() => setTextSize('large')} data-testid="button-text-size-large" className={`rounded px-2.5 py-1 text-sm font-semibold transition-colors ${textSize === 'large' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary/50'}`}>A</button>
                  <button onClick={() => setTextSize('xlarge')} data-testid="button-text-size-xlarge" className={`rounded px-2.5 py-1 text-base font-semibold transition-colors ${textSize === 'xlarge' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary/50'}`}>A</button>
                </div>
                <button onClick={toggleBookmark} data-testid="button-toggle-bookmark" className={`focus-ring rounded-lg border p-2 transition-colors ${moduleData.bookmarked ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card text-muted-foreground hover:bg-secondary'}`} aria-label={moduleData.bookmarked ? 'Remove bookmark' : 'Add bookmark'}>
                  <Bookmark size={18} className={moduleData.bookmarked ? 'fill-current' : ''} />
                </button>
              </div>
            </div>

            {/* Title & Summary */}
            <div>
              <h1 data-testid="text-module-title" className={`serif font-semibold leading-tight text-foreground ${textSizeHeadingClass}`}>{moduleData.title}</h1>
              <p className={`mt-5 font-medium leading-relaxed text-muted-foreground ${textSizeClass}`}>{moduleData.summary}</p>
            </div>

             <nav aria-label="On this page" className="rounded-2xl border border-border bg-card p-5" data-testid="module-section-navigation">
               <p className="mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">On this page</p>
               <div className="mt-3 flex flex-wrap gap-2">
                 {moduleData.sections.map((section, idx) => (
                   <a key={section.heading} href={`#learning-section-${idx}`} className="focus-ring rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-primary" data-testid={`link-section-${idx}`}>
                     {section.heading}
                   </a>
                 ))}
                 <a href="#try-this-at-home" className="focus-ring rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-primary" data-testid="link-section-try-at-home">Try this at home</a>
               </div>
             </nav>

            {/* Sections */}
            <div className="space-y-10">
              {moduleData.sections.map((section, idx) => (
                 <section key={idx} id={`learning-section-${idx}`} className="scroll-mt-28 space-y-4" data-testid={`learning-section-${idx}`}>
                  <h2 className={`serif font-semibold text-foreground ${textSize === 'xlarge' ? 'text-3xl' : textSize === 'large' ? 'text-2xl' : 'text-xl'}`}>{section.heading}</h2>
                  {section.body && <p className={`leading-relaxed text-foreground/90 ${textSizeClass}`}>{section.body}</p>}
                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="space-y-3 pl-2">
                      {section.bullets.map((bullet, bIdx) => (
                        <li key={bIdx} className={`flex items-start gap-3 leading-relaxed text-foreground/90 ${textSizeClass}`}>
                           <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                           <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {section.callout && (
                    <div className="rounded-2xl border-l-4 border-accent bg-accent/5 p-5 md:p-6 mt-6">
                      <p className={`font-medium italic leading-relaxed text-foreground ${textSizeClass}`}>{section.callout}</p>
                    </div>
                  )}
                </section>
              ))}
            </div>

            {/* Try This At Home */}
            {moduleData.tryThisAtHome && moduleData.tryThisAtHome.length > 0 && (
               <div id="try-this-at-home" className="scroll-mt-28 rounded-3xl border border-border bg-secondary/20 p-6 md:p-8" data-testid="try-this-at-home">
                <div className="mb-5 flex items-center gap-3 text-primary">
                  <div className="grid size-8 place-items-center rounded-xl bg-primary/10"><Check size={18} /></div>
                  <h2 className={`serif font-semibold ${textSize === 'xlarge' ? 'text-3xl' : textSize === 'large' ? 'text-2xl' : 'text-xl'}`}>Try this at home</h2>
                </div>
                <ul className="space-y-4">
                  {moduleData.tryThisAtHome.map((item, idx) => (
                    <li key={idx} className={`flex items-start gap-3 leading-relaxed text-foreground/90 ${textSizeClass}`}>
                       <span className="mt-1.5 grid size-5 shrink-0 place-items-center rounded-full bg-background text-[10px] font-bold text-primary shadow-sm">{idx + 1}</span>
                       <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Private Reflection */}
            <div className="rounded-3xl border border-border bg-card p-6 md:p-8 soft-shadow">
               <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="serif text-xl font-semibold">Private Reflection</h3>
                  <p className="mt-1 text-sm text-muted-foreground">These notes are just for you and aren't shared with the care team.</p>
                </div>
                 {updateReflection.isPending ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <Loader2 size={12} className="animate-spin" /> Saving
                  </span>
                 ) : updateReflection.isError ? (
                   <span className="text-xs font-semibold text-destructive" role="alert">Could not save</span>
                 ) : updateReflection.isSuccess && reflectionText === lastSavedReflection.current ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                    <Check size={12} /> Saved
                  </span>
                 ) : null}
              </div>
              <textarea
                value={reflectionText}
                onChange={(e) => setReflectionText(e.target.value)}
                 maxLength={5000}
                placeholder="What did you notice? Any thoughts on trying these ideas?"
                className={`w-full resize-y rounded-2xl border border-input bg-background p-4 outline-none transition-shadow min-h-[120px] focus-ring ${textSizeClass}`}
                data-testid="textarea-reflection"
              />
               <div className="mt-3 flex items-center justify-between gap-3">
                 <span className="text-xs text-muted-foreground" data-testid="reflection-character-count">{reflectionText.length}/5000</span>
                 <Button type="button" onClick={saveReflection} disabled={updateReflection.isPending || reflectionText === lastSavedReflection.current} data-testid="button-save-reflection">
                   Save private reflection
                 </Button>
               </div>
            </div>

            {/* Footer Navigation */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-10 border-t border-border">
              <button
                onClick={toggleCompleted}
                data-testid="button-toggle-completed"
                className={`focus-ring flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all w-full sm:w-auto ${moduleData.completed ? 'bg-secondary text-foreground' : 'bg-primary text-primary-foreground shadow-md hover:-translate-y-0.5'}`}
              >
                {moduleData.completed ? (
                  <><Check size={18} className="text-primary" /> Completed</>
                ) : (
                  'Mark as Completed'
                )}
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => prevModule && navigateTo(prevModule.moduleKey)}
                  disabled={!prevModule}
                  data-testid="button-prev-module"
                  className="focus-ring flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-semibold text-foreground transition-all hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <button
                  onClick={() => nextModule && navigateTo(nextModule.moduleKey)}
                  disabled={!nextModule}
                  data-testid="button-next-module"
                  className="focus-ring flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-semibold text-foreground transition-all hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
            
            <p className="mt-8 text-center text-xs leading-5 text-muted-foreground max-w-xl mx-auto italic">
              {centerData.resource.disclaimer}
            </p>

          </div>
        )}
      </main>
    </div>
  );
}
