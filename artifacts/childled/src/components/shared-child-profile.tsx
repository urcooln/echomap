import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  useGetChildSharedProfile, 
  getGetChildSharedProfileQueryKey,
  useCreateChildSharedProfileEntry,
  useUpdateChildSharedProfileEntry,
  useDeleteChildSharedProfileEntry,
  type SharedChildProfile,
  type SharedChildProfileSectionView,
  type SharedChildProfileEntry,
  type SharedChildProfileHistoryEvent
} from '@workspace/api-client-react';
import { Plus, Pencil, Trash2, Clock, X, Shield, History } from 'lucide-react';
import { format } from 'date-fns';

const sectionLabels: Record<string, string> = {
  strengths: 'Strengths',
  interests: 'Interests & Motivators',
  sensory_supports: 'Sensory Supports',
  regulation_notes: 'Regulation Notes'
};

const sectionDescriptions: Record<string, string> = {
  strengths: 'What they are good at and naturally drawn to.',
  interests: 'Topics, objects, or activities that spark connection.',
  sensory_supports: 'Tools and environments that help them feel grounded.',
  regulation_notes: 'Strategies for co-regulation and transitions.'
};

export function SharedChildProfile({ childId }: { childId: number }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useGetChildSharedProfile(
    { childId },
    {
      query: {
        enabled: Boolean(childId),
        queryKey: getGetChildSharedProfileQueryKey({ childId }),
        staleTime: 15000,
      }
    }
  );

  const [historyOpen, setHistoryOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="shared-profile-loading">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="skeleton h-48 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center text-destructive" data-testid="shared-profile-error">
        <Shield className="mx-auto mb-3" size={24} />
        <h3 className="serif text-lg font-semibold">Could not load profile</h3>
        <p className="mt-2 text-sm">There was a problem loading the shared profile.</p>
        <button onClick={() => refetch()} className="mt-4 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground">Retry</button>
      </div>
    );
  }

  const sectionsMap = new Map(data.sections.map(s => [s.section, s]));
  const orderedSections: Array<keyof typeof sectionLabels> = ['strengths', 'interests', 'sensory_supports', 'regulation_notes'];

  return (
    <div className="space-y-6 animate-rise delay-1">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Shared Understanding</p>
          <h2 className="serif mt-1 text-2xl font-semibold">Living Profile</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            A collaborative workspace where the whole team contributes to what helps your child feel understood and supported.
          </p>
        </div>
        <button 
          onClick={() => setHistoryOpen(true)}
          className="focus-ring flex items-center gap-2 rounded-xl border border-primary/20 bg-card px-3 py-2 text-xs font-semibold text-primary transition-all hover:bg-secondary"
        >
          <History size={14} /> Profile History
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {orderedSections.map((sectionKey) => {
          const sectionData = sectionsMap.get(sectionKey as any) ?? {
            section: sectionKey as any,
            entries: [],
            lastUpdatedAt: null,
            lastUpdatedBy: null,
          };
          return (
            <ProfileSection 
              key={sectionKey} 
              childId={childId}
              canContribute={data.canContribute}
              sectionData={sectionData} 
            />
          );
        })}
      </div>

      {historyOpen && (
        <HistoryModal history={data.history} onClose={() => setHistoryOpen(false)} />
      )}
    </div>
  );
}

function ProfileSection({ childId, canContribute, sectionData }: { childId: number, canContribute: boolean, sectionData: SharedChildProfileSectionView }) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<'support' | 'challenge'>('support');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [mutationError, setMutationError] = useState('');
  
  const createMutation = useCreateChildSharedProfileEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetChildSharedProfileQueryKey({ childId }) });
        setIsAdding(false);
        setNewValue('');
        setNewCategory('support');
        setMutationError('');
      },
      onError: (error) => setMutationError(error instanceof Error ? error.message : 'The entry could not be added. Refresh and try again.'),
    }
  });

  const updateMutation = useUpdateChildSharedProfileEntry({
    mutation: {
      onMutate: async ({ entryId, data: payload }) => {
        await queryClient.cancelQueries({ queryKey: getGetChildSharedProfileQueryKey({ childId }) });
        const previousProfile = queryClient.getQueryData<SharedChildProfile>(getGetChildSharedProfileQueryKey({ childId }));
        if (previousProfile) {
          queryClient.setQueryData<SharedChildProfile>(getGetChildSharedProfileQueryKey({ childId }), (old) => {
            if (!old) return old;
            return {
              ...old,
              sections: old.sections.map(s => s.section === sectionData.section ? {
                ...s,
                entries: s.entries.map(e => e.id === entryId ? { ...e, value: payload.value, version: payload.version + 1 } : e)
              } : s)
            };
          });
        }
        return { previousProfile };
      },
      onError: (err, variables, context) => {
        if (context?.previousProfile) {
          queryClient.setQueryData(getGetChildSharedProfileQueryKey({ childId }), context.previousProfile);
        }
        setMutationError(err instanceof Error ? err.message : 'This entry may have changed. Refresh and try again.');
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetChildSharedProfileQueryKey({ childId }) });
        setEditingId(null);
        setMutationError('');
      },
    }
  });

  const deleteMutation = useDeleteChildSharedProfileEntry({
    mutation: {
      onMutate: async ({ entryId }) => {
        await queryClient.cancelQueries({ queryKey: getGetChildSharedProfileQueryKey({ childId }) });
        const previousProfile = queryClient.getQueryData<SharedChildProfile>(getGetChildSharedProfileQueryKey({ childId }));
        if (previousProfile) {
          queryClient.setQueryData<SharedChildProfile>(getGetChildSharedProfileQueryKey({ childId }), (old) => {
            if (!old) return old;
            return {
              ...old,
              sections: old.sections.map(s => s.section === sectionData.section ? {
                ...s,
                entries: s.entries.filter(e => e.id !== entryId)
              } : s)
            };
          });
        }
        return { previousProfile };
      },
      onError: (err, variables, context) => {
        if (context?.previousProfile) {
          queryClient.setQueryData(getGetChildSharedProfileQueryKey({ childId }), context.previousProfile);
        }
        setMutationError(err instanceof Error ? err.message : 'This entry may have changed. Refresh and try again.');
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetChildSharedProfileQueryKey({ childId }) });
        setMutationError('');
      }
    }
  });

  const handleSaveNew = () => {
    if (!newValue.trim()) return;
    createMutation.mutate({
      params: { childId },
      data: {
        section: sectionData.section,
        value: newValue.trim(),
        ...(sectionData.section === 'sensory_supports' ? { category: newCategory } : {}),
      }
    });
  };

  const handleSaveEdit = (entry: SharedChildProfileEntry) => {
    if (!editValue.trim() || editValue.trim() === entry.value) {
      setEditingId(null);
      return;
    }
    updateMutation.mutate({
      entryId: entry.id,
      data: {
        value: editValue.trim(),
        version: entry.version
      }
    });
  };

  const handleDelete = (entry: SharedChildProfileEntry) => {
    if (window.confirm('Remove this entry?')) {
      deleteMutation.mutate({ entryId: entry.id, version: entry.version });
    }
  };

  return (
    <section className="brand-card flex flex-col rounded-3xl border bg-card p-6 soft-shadow">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="serif text-xl font-semibold">{sectionLabels[sectionData.section]}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{sectionDescriptions[sectionData.section]}</p>
        </div>
        {canContribute && !isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3">
        {sectionData.entries.map((entry) => (
          <div key={entry.id} className="group relative rounded-xl border border-border bg-secondary/30 p-3 transition-colors hover:border-primary/20 hover:bg-secondary/50">
            {editingId === entry.id ? (
              <div className="space-y-3">
                <textarea 
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full resize-none rounded-lg border border-input bg-background p-2 text-sm focus-ring"
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingId(null)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary">Cancel</button>
                  <button 
                    onClick={() => handleSaveEdit(entry)} 
                    disabled={updateMutation.isPending}
                    className="gold-action rounded-lg px-3 py-1.5 text-xs font-semibold text-primary"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-2">
                  {sectionData.section === 'sensory_supports' && (
                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      entry.category === 'challenge'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {entry.category === 'challenge' ? 'Difficult situation' : 'Support'}
                    </span>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{entry.value}</p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    {entry.authorName} <span className="mx-1 opacity-70">•</span> {entry.authorRole}
                    <span className="mx-1 opacity-70">•</span>
                    {format(new Date(entry.updatedAt), 'MMM d, yyyy')}
                    {new Date(entry.updatedAt).getTime() !== new Date(entry.createdAt).getTime() ? ' · edited' : ''}
                  </p>
                  {entry.canEdit && (
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
                      <button 
                        onClick={() => { setEditingId(entry.id); setEditValue(entry.value); }}
                        className="focus-ring rounded-md p-1.5 text-primary hover:bg-primary/10 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={12} />
                      </button>
                      <button 
                        onClick={() => handleDelete(entry)}
                        className="focus-ring rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}

        {isAdding && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            {sectionData.section === 'sensory_supports' && (
              <div className="mb-3 flex gap-2" aria-label="Sensory entry type">
                {(['support', 'challenge'] as const).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setNewCategory(category)}
                    className={`focus-ring rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      newCategory === category
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {category === 'support' ? 'Support' : 'Difficult situation'}
                  </button>
                ))}
              </div>
            )}
            <textarea 
              autoFocus
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={`Add to ${sectionLabels[sectionData.section].toLowerCase()}...`}
              className="w-full resize-none rounded-lg border border-input bg-background p-2 text-sm focus-ring"
              rows={3}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => { setIsAdding(false); setNewValue(''); setNewCategory('support'); setMutationError(''); }} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary">Cancel</button>
              <button 
                onClick={handleSaveNew} 
                disabled={createMutation.isPending || !newValue.trim()}
                className="gold-action rounded-lg px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
              >
                {createMutation.isPending ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {mutationError && (
          <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs leading-5 text-destructive">
            <p>{mutationError}</p>
            <button
              type="button"
              onClick={() => queryClient.invalidateQueries({ queryKey: getGetChildSharedProfileQueryKey({ childId }) })}
              className="focus-ring mt-2 font-semibold underline underline-offset-2"
            >
              Refresh this profile
            </button>
          </div>
        )}

        {sectionData.entries.length === 0 && !isAdding && (
          <div className="flex h-full min-h-[100px] items-center justify-center rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-center">
            <p className="text-sm text-muted-foreground">Nothing added yet.</p>
          </div>
        )}
      </div>

      {sectionData.lastUpdatedAt && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Clock size={12} />
            Updated {format(new Date(sectionData.lastUpdatedAt), 'MMM d')}
            {sectionData.lastUpdatedBy && ` by ${sectionData.lastUpdatedBy}`}
          </p>
        </div>
      )}
    </section>
  );
}

function HistoryModal({ history, onClose }: { history: SharedChildProfileHistoryEvent[], onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-primary/45 p-2 backdrop-blur-sm animate-in fade-in duration-200 sm:p-4">
      <div role="dialog" aria-modal="true" className="brand-card flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[90dvh] sm:rounded-3xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-4 sm:p-6 md:p-8">
          <div>
            <h2 className="serif text-2xl font-semibold">Profile History</h2>
            <p className="mt-1 text-sm text-muted-foreground">Recent changes to the shared living profile.</p>
          </div>
          <button 
            onClick={onClose} 
            className="focus-ring flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground sm:size-9"
          >
            <X size={16} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 md:p-8">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History size={32} className="mb-4 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No history recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[15px] before:w-[2px] before:bg-border">
              {history.map((event) => (
                <div key={event.id} className="relative flex gap-3 pl-9 sm:gap-4 sm:pl-10">
                  <div className="absolute left-[11px] top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary shadow-sm" />
                  <div className="w-full">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {event.actorName} <span className="font-normal text-muted-foreground">({event.actorRole})</span>
                      </p>
                      <time className="text-[11px] text-muted-foreground">
                        {format(new Date(event.occurredAt), 'MMM d, h:mm a')}
                      </time>
                    </div>
                    
                    <p className="mt-1 text-xs text-primary font-medium">
                      {event.action === 'created' && `Added to ${sectionLabels[event.section]}`}
                      {event.action === 'updated' && `Updated ${sectionLabels[event.section]}`}
                      {event.action === 'deleted' && `Removed from ${sectionLabels[event.section]}`}
                    </p>
                    
                    <div className="mt-2 rounded-xl border border-border bg-secondary/30 p-3 text-sm">
                      {event.action === 'updated' ? (
                        <div className="space-y-2">
                          <p className="line-through opacity-60">{event.previousValue}</p>
                          <p>{event.nextValue}</p>
                        </div>
                      ) : (
                        <p className={event.action === 'deleted' ? 'line-through opacity-60' : ''}>
                          {event.action === 'deleted' ? event.previousValue : event.nextValue}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
