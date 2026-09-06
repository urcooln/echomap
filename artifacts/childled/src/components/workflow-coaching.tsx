import { useLocation } from 'wouter';
import { useGetClinicianLearningCenter, useGetClinicianLearningPreferences, useUpdateClinicianLearningPreferences, getGetClinicianLearningPreferencesQueryKey, getGetClinicianLearningCenterQueryKey } from '@workspace/api-client-react';
import { Lightbulb, X, BookOpen } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { openClinicianQuickReferences } from './clinician-quick-reference';

export function WorkflowCoaching() {
  const [location] = useLocation();
  const currentPath = location.split('?')[0];
  const queryClient = useQueryClient();

  const { data: prefs } = useGetClinicianLearningPreferences();
  const { data: center } = useGetClinicianLearningCenter({
    query: { enabled: !!prefs?.workflowCoachingEnabled, queryKey: getGetClinicianLearningCenterQueryKey() }
  });
  const updatePrefs = useUpdateClinicianLearningPreferences();

  if (!prefs?.workflowCoachingEnabled || !center) return null;

  let context = '';
  if (currentPath.startsWith('/session')) context = 'session';
  else if (currentPath.startsWith('/dictionary')) context = 'dictionary';
  else if (currentPath.startsWith('/aac-planning')) context = 'aac-planning';
  else if (currentPath.startsWith('/reports')) context = 'reports';

  if (!context) return null;

  const relevantModules = center.modules.filter((m: any) => m.workflowContexts?.includes(context));
  if (relevantModules.length === 0) return null;

  const module = relevantModules[0];

  const disableCoaching = () => {
    updatePrefs.mutate({ data: { workflowCoachingEnabled: false } }, {
      onSuccess: () => {
        queryClient.setQueryData(getGetClinicianLearningPreferencesQueryKey(), { ...prefs, workflowCoachingEnabled: false });
        queryClient.invalidateQueries({ queryKey: getGetClinicianLearningCenterQueryKey() });
      }
    });
  };

  return (
    <div className="mb-6 animate-in fade-in slide-in-from-top-4">
      <div className="rounded-2xl border border-primary/20 bg-card p-5 shadow-sm soft-shadow relative overflow-hidden">
        <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary/60" />
        <div className="flex items-start gap-4">
          <div className="mt-0.5 shrink-0 rounded-full bg-primary/10 p-2 text-primary">
            <Lightbulb size={20} />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
               Workflow Coaching
               <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Suggestion</span>
            </h4>
            <p className="mt-1.5 text-sm text-foreground/90 max-w-3xl leading-relaxed">{module.summary}</p>
            <div className="mt-4 flex gap-4">
              <button type="button" onClick={() => openClinicianQuickReferences(module.moduleKey)} className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:-translate-y-0.5 shadow-sm">
                <BookOpen size={14} /> Open reference
              </button>
              <button onClick={disableCoaching} className="text-xs font-medium text-muted-foreground hover:text-foreground focus-ring rounded-lg px-2">
                Disable coaching
              </button>
            </div>
          </div>
          <button onClick={disableCoaching} className="text-muted-foreground hover:text-foreground shrink-0 p-1 focus-ring rounded-md" aria-label="Dismiss">
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}