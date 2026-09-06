import { Link } from 'wouter';
import { ArrowRight, BookOpen, Check } from 'lucide-react';
import { useGetParentLearningCenter } from '@workspace/api-client-react';

export function ParentLearningCenterWidget({ childId }: { childId: number }) {
  const { data, isLoading, error } = useGetParentLearningCenter({ childId });

  if (isLoading) {
    return <div className="skeleton h-40 w-full rounded-3xl" data-testid="parent-learning-center-widget-loading" />;
  }

  if (error || !data) {
    return null;
  }

  const { resource, completedModules, totalModules, completionPercentage, lastViewedModuleKey, modules } = data;
  const lastViewed = lastViewedModuleKey ? modules.find(m => m.moduleKey === lastViewedModuleKey) : modules[0];

  return (
    <section className="rounded-3xl border border-border bg-card p-6 soft-shadow md:p-8" data-testid="parent-learning-center-widget">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Learning Center</p>
          <h2 className="serif mt-2 text-2xl font-semibold">{resource.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{resource.subtitle}</p>
        </div>
        <Link href={`/family-resources?childId=${childId}`} data-testid="link-open-learning-center" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10">
          <BookOpen size={16} /> Open Resources
        </Link>
      </div>
      
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:gap-6">
        <div className="flex-1 rounded-2xl bg-secondary/30 p-5">
           <div className="mb-2 flex items-center justify-between text-sm font-semibold">
              <span>Your Progress</span>
              <span data-testid="text-completion-percentage">{Math.round(completionPercentage)}%</span>
           </div>
           <div className="h-2.5 w-full overflow-hidden rounded-full border border-border bg-secondary">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${completionPercentage}%` }} />
           </div>
           <p className="mt-3 text-xs text-muted-foreground" data-testid="text-completed-count">{completedModules} of {totalModules} modules completed</p>
        </div>
        
        {lastViewed && (
          <div className="flex flex-1 flex-col justify-between rounded-2xl border border-border p-5">
            <div>
              <p className="mono mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                 {lastViewed.completed ? 'Review module' : 'Continue learning'}
              </p>
              <h3 className="serif text-lg font-semibold line-clamp-1" data-testid="text-last-viewed-title">{lastViewed.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{lastViewed.summary}</p>
            </div>
            <Link href={`/family-resources?childId=${childId}&module=${lastViewed.moduleKey}`} data-testid="link-resume-module" className="focus-ring mt-4 inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-primary">
               {lastViewed.completed ? 'Review module' : 'Resume reading'} <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
