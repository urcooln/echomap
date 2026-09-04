import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Edit2, Activity, MessageSquare, VolumeX } from 'lucide-react';
import {
  useListUnclearVocalizations,
  getListUnclearVocalizationsQueryKey,
  useUpdateUnclearVocalizationLabel,
} from '@workspace/api-client-react';
import type { Child, UnclearVocalizationGroup } from '@workspace/api-client-react';

function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mono mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>}
        <h1 data-testid={`heading-${title.toLowerCase().replaceAll(' ', '-')}`} className="serif text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action }: { icon: React.ElementType; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="brand-card rounded-2xl border border-dashed border-border bg-card/75 px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-secondary text-primary"><Icon size={22} /></div>
      <h3 className="serif text-xl font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'outline' | 'warm'; 'data-testid'?: string }) {
  const styles = {
    primary: 'bg-primary text-primary-foreground shadow-[0_10px_20px_-14px_hsl(var(--brand-forest-950)/.9)] hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md focus-ring',
    quiet: 'bg-transparent text-muted-foreground hover:bg-secondary hover:text-primary focus-ring',
    outline: 'border border-primary/20 bg-card text-primary shadow-sm hover:border-primary/45 hover:bg-secondary/70 focus-ring',
    warm: 'gold-action text-accent-foreground hover:-translate-y-0.5 hover:brightness-[1.03] hover:shadow-md focus-ring',
  };
  return <button {...props} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}>{children}</button>;
}

export function ClinicianUnclearSpeechPage({ childId, child }: { childId?: number; child?: Child }) {
  const { data: reviewData, isLoading, isError } = useListUnclearVocalizations(
    { childId: childId ?? 0 },
    {
      query: {
        queryKey: getListUnclearVocalizationsQueryKey({ childId: childId ?? 0 }),
        enabled: Boolean(childId),
      }
    }
  );

  if (!childId || !child) {
    return (
      <EmptyState
        icon={VolumeX}
        title="No child selected"
        body="Select a child profile to review their unclear vocalizations."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-12 w-1/3 bg-muted rounded-xl"></div>
        <div className="h-64 w-full bg-muted rounded-2xl"></div>
        <div className="h-64 w-full bg-muted rounded-2xl"></div>
      </div>
    );
  }

  if (isError || !reviewData) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Could not load records"
        body="There was an error loading the unclear speech records. Please try again."
      />
    );
  }

  return (
    <div className="space-y-10">
      <SectionHeading
        eyebrow="Clinical Review"
        title="Unclear Speech"
        description={`Review ${child.name}'s preserved unclear vocalizations across prior sessions. Suggested groups are prompts only—not words, meanings, or dictionary evidence.`}
      />

      <section className="rounded-2xl border border-primary/15 bg-secondary/35 p-5" data-testid="unclear-speech-safety-note">
        <p className="text-sm font-semibold text-primary">Clinician-led review only</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Provider transcript text stays unchanged and separate from clinician interpretation. A cross-session label organizes this review page only; it never adds a phrase to the communication dictionary.</p>
      </section>

      {reviewData.groups.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No unclear speech recorded"
          body="No preserved unclear vocalizations have been found in saved prior sessions."
        />
      ) : (
        <div className="grid gap-6">
          {reviewData.groups.map((group) => (
            <UnclearSpeechGroupCard key={group.id} childId={childId} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function UnclearSpeechGroupCard({ childId, group }: { childId: number; group: UnclearVocalizationGroup }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(group.label || '');
  const [saveConflict, setSaveConflict] = useState(false);
  
  const updateLabelMutation = useUpdateUnclearVocalizationLabel({
    mutation: {
      onSuccess: (updatedReview) => {
        setSaveConflict(false);
        setIsEditing(false);
        queryClient.setQueryData(getListUnclearVocalizationsQueryKey({ childId }), updatedReview);
      },
      onError: () => {
        setSaveConflict(true);
        void queryClient.invalidateQueries({ queryKey: getListUnclearVocalizationsQueryKey({ childId }) });
      }
    }
  });

  const handleSave = () => {
    const newLabel = editLabel.trim() ? editLabel.trim() : null;
    updateLabelMutation.mutate({
      params: { childId },
      data: {
        occurrences: group.occurrences.map((occurrence) => ({
          segmentId: occurrence.segmentId,
          expectedRevision: occurrence.revision,
        })),
        label: newLabel
      }
    });
  };

  const handleRemove = () => {
    updateLabelMutation.mutate({
      params: { childId },
      data: {
        occurrences: group.occurrences.map((occurrence) => ({
          segmentId: occurrence.segmentId,
          expectedRevision: occurrence.revision,
        })),
        label: null
      }
    });
  };

  return (
    <article data-testid={`unclear-speech-group-${group.id}`} className="brand-card rounded-3xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
      <div className="border-b border-border/50 bg-secondary/30 p-5 md:px-7 md:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                {group.source.replace('_', ' ')}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {group.occurrenceCount} occurrence{group.occurrenceCount === 1 ? '' : 's'} across {group.sessionCount} session{group.sessionCount === 1 ? '' : 's'}
              </span>
            </div>
            <h2 className="serif text-xl font-semibold text-foreground">{group.reviewPrompt}</h2>
          </div>
          
          <div className="flex flex-col items-end min-w-[240px]">
            {!isEditing ? (
              <div className="flex items-center gap-3 bg-background rounded-xl border border-border p-2 pr-4 w-full justify-between">
                <div className="flex items-center gap-2 px-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Label:</span>
                  <span className={`text-sm font-medium ${group.label ? 'text-primary' : 'text-muted-foreground italic'}`}>
                    {group.label || 'None'}
                  </span>
                </div>
                <button
                   type="button"
                  onClick={() => {
                    setEditLabel(group.label || '');
                    setIsEditing(true);
                  }}
                  className="text-muted-foreground hover:text-primary transition-colors p-1"
                  aria-label="Edit label"
                   data-testid={`button-edit-unclear-label-${group.id}`}
                >
                  <Edit2 size={16} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 w-full">
                <input
                  type="text"
                   maxLength={120}
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="Enter cross-session label..."
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none transition-shadow focus-ring w-full"
                  autoFocus
                   data-testid={`input-unclear-label-${group.id}`}
                />
                <div className="flex gap-2 justify-end w-full">
                  <Button variant="quiet" onClick={() => setIsEditing(false)} disabled={updateLabelMutation.isPending} className="py-1.5 h-8">
                    Cancel
                  </Button>
                  {group.label && (
                    <Button variant="outline" onClick={handleRemove} disabled={updateLabelMutation.isPending} className="py-1.5 h-8 text-destructive border-destructive/30 hover:bg-destructive/10">
                      Remove
                    </Button>
                  )}
                  <Button variant="primary" onClick={handleSave} disabled={updateLabelMutation.isPending} className="py-1.5 h-8">
                    {updateLabelMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
                 {saveConflict && <p className="text-xs leading-5 text-destructive">These records changed after you opened them, or the save failed. Review the refreshed labels before trying again.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="p-5 md:px-7">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Occurrences</h3>
        <div className="grid gap-3">
          {group.occurrences.map((occurrence) => (
            <div key={occurrence.segmentId} className="rounded-2xl border border-primary/10 bg-background p-4 soft-shadow">
              <div className="flex flex-wrap gap-4 items-start justify-between border-b border-border/50 pb-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-8 place-items-center rounded-lg bg-secondary text-primary">
                    <MessageSquare size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{new Date(occurrence.sessionDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p className="text-xs text-muted-foreground">Session {occurrence.sessionId} • Position {occurrence.position}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-accent/20 px-2 py-1 text-xs font-medium text-accent-foreground capitalize">
                    Intelligibility: {occurrence.intelligibility.replace('_', ' ')}
                  </span>
                  {occurrence.durationSeconds !== null && (
                    <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium text-muted-foreground">
                      {occurrence.durationSeconds.toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Provider Transcript</p>
                  <div className="rounded-xl bg-muted/50 p-3 text-sm italic text-muted-foreground border border-transparent">
                    "{occurrence.providerText}"
                  </div>
                </div>
                
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1.5">Clinician Interpretation</p>
                  {occurrence.clinicianInterpretation ? (
                    <div className="rounded-xl bg-secondary/30 p-3 text-sm font-medium text-foreground border border-primary/10">
                      "{occurrence.clinicianInterpretation}"
                    </div>
                  ) : (
                    <div className="rounded-xl bg-background p-3 text-sm text-muted-foreground border border-dashed border-border">
                      No interpretation provided
                    </div>
                  )}
                </div>
              </div>
              
              {occurrence.note && (
                <div className="mt-4 pt-3 border-t border-border/30">
                  <p className="text-xs font-bold text-muted-foreground mb-1">Note:</p>
                  <p className="text-sm text-foreground">{occurrence.note}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
