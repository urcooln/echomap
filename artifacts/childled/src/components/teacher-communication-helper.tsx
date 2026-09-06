import * as React from 'react';
import { useState } from 'react';
import {
  getGetTeacherCommunicationHelperQueryKey,
  useGetTeacherCommunicationHelper,
} from '@workspace/api-client-react';
import { 
  Search, 
  Info, 
  AlertTriangle, 
  CheckCircle2, 
  MessageCircle, 
  Sparkles, 
  Activity,
  Users,
  BookOpen
} from 'lucide-react';

export interface TeacherCommunicationHelperProps {
  childId: number;
  childName: string;
  onLogObservation: (phrase: string) => void;
  onAddPhrase: (phrase: string) => void;
  onAskTeam: (phrase: string) => void;
  onNotifyClinician: (phrase: string) => void;
  onSaveClassroomNote: (phrase: string) => void;
  onMarkHeard: (phrase: string) => void;
  markingHeard?: boolean;
  heardTodayPhrase?: string;
}

export function TeacherCommunicationHelper({
  childId,
  childName,
  onLogObservation,
  onAddPhrase,
  onAskTeam,
  onNotifyClinician,
  onSaveClassroomNote,
  onMarkHeard,
  markingHeard,
  heardTodayPhrase,
}: TeacherCommunicationHelperProps) {
  const [inputValue, setInputValue] = useState('');
  const [queryPhrase, setQueryPhrase] = useState('');

  const { data, isFetching, isLoading, isError } = useGetTeacherCommunicationHelper(
    { childId, phrase: queryPhrase },
    {
      query: {
        queryKey: getGetTeacherCommunicationHelperQueryKey({ childId, phrase: queryPhrase }),
        enabled: !!queryPhrase,
      },
    }
  );

  const showLoading = isFetching || isLoading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed) {
      setQueryPhrase(trimmed);
    }
  };

  const formatSource = (source: string) => {
    return source.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getConfidenceStyles = (level: string) => {
    switch (level) {
      case 'high':
        return { wrapper: 'bg-primary/10 border-primary/20 text-primary', icon: <CheckCircle2 size={16} className="text-primary" /> };
      case 'moderate':
        return { wrapper: 'bg-accent/10 border-accent/20 text-accent', icon: <Info size={16} className="text-accent" /> };
      case 'low':
        return { wrapper: 'bg-destructive/10 border-destructive/20 text-destructive', icon: <AlertTriangle size={16} className="text-destructive" /> };
      default:
        return { wrapper: 'bg-secondary border-border text-foreground', icon: <Info size={16} /> };
    }
  };

  const hasSearched = !!queryPhrase;

  return (
    <section className="rounded-3xl border border-border bg-card p-6 soft-shadow md:p-8 flex flex-col space-y-6">
      <div>
        <h3 className="serif text-2xl font-semibold mb-2">What Does This Mean?</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Quickly look up phrases to understand what {childName} might be trying to communicate based on the care team's shared knowledge.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="relative flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter a phrase you've heard the student say..."
            className="w-full rounded-xl border border-border bg-background pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60"
            data-testid="search-input"
            aria-label="Search for a phrase"
          />
        </div>
        <button
          type="submit"
          disabled={!inputValue.trim() || showLoading}
          data-testid="submit"
          className={`gold-action focus-ring rounded-xl px-6 py-3.5 font-semibold text-sm text-primary transition-transform flex items-center justify-center whitespace-nowrap ${(!inputValue.trim() || showLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
        >
          {showLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      <div className="mt-2" aria-live="polite">
        {!hasSearched && !showLoading && !isError && (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/20 py-10 px-6 text-center animate-in fade-in">
            <MessageCircle size={28} className="mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-sm font-medium text-foreground">What did you hear?</p>
            <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
              Type a phrase above to quickly check if the care team has shared notes on what it might mean.
            </p>
          </div>
        )}

        {showLoading && (
          <div className="rounded-2xl border border-border bg-secondary/10 p-10 text-center animate-pulse">
            <div className="mx-auto h-12 w-12 rounded-full bg-secondary/30 mb-5"></div>
            <div className="mx-auto h-5 w-48 rounded-md bg-secondary/30 mb-3"></div>
            <div className="mx-auto h-4 w-64 rounded-md bg-secondary/30"></div>
          </div>
        )}

        {hasSearched && isError && !showLoading && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 flex flex-col items-center text-center animate-in fade-in">
            <AlertTriangle size={28} className="text-destructive mb-4" />
            <p className="text-sm font-semibold text-destructive">Could not check the phrase.</p>
            <p className="text-xs text-destructive/80 mt-2">There was a problem connecting to the care team's shared notes. Please try again.</p>
          </div>
        )}

        {hasSearched && data && !showLoading && !isError && (
          data.found ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8" data-testid="known-result">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-6">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary">
                      <BookOpen size={12} />
                    </span>
                    <span className="mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      Phrase Helper
                    </span>
                  </div>
                  <h4 className="serif text-3xl font-semibold text-foreground">"{data.phrase}"</h4>
                  {data.sources && data.sources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="text-xs font-medium text-muted-foreground mr-1">Sources:</span>
                      {data.sources.map(s => (
                        <span key={s} className="rounded-md bg-secondary/50 border border-border px-2 py-1 text-[10px] font-bold text-secondary-foreground uppercase tracking-wider">
                          {formatSource(s)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col items-start sm:items-end gap-3">
                  <div 
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${getConfidenceStyles(data.confidence).wrapper}`} 
                    data-testid="confidence"
                  >
                    {getConfidenceStyles(data.confidence).icon}
                    <span className="text-sm font-semibold capitalize">{data.confidence} Confidence</span>
                  </div>
                </div>
              </div>

              {data.confidence === 'low' && data.confidenceNote && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex gap-3 text-destructive -mt-2">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed">{data.confidenceNote}</p>
                </div>
              )}

              <div className="grid gap-8 lg:grid-cols-2">
                <div className="space-y-8">
                  {data.meanings && data.meanings.length > 0 && (
                    <section>
                      <h5 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                        <Sparkles size={16} className="text-primary"/> Possible Meanings
                      </h5>
                      <div className="space-y-3">
                        {data.meanings.map((m, i) => (
                          <div key={i} className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                            <p className="text-sm leading-relaxed text-foreground/90">{m.text}</p>
                            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                              From {formatSource(m.source)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {data.suggestedResponses && data.suggestedResponses.length > 0 && (
                    <section>
                      <h5 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                        <MessageCircle size={16} className="text-accent"/> Suggested Responses
                      </h5>
                      <div className="space-y-3">
                        {data.suggestedResponses.map((r, i) => (
                          <div key={i} className="rounded-2xl border border-accent/10 bg-accent/5 p-4">
                            <p className="text-sm leading-relaxed text-foreground/90">{r}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  
                  {data.relatedInterests && data.relatedInterests.length > 0 && (
                    <section>
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                        Related Interests
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {data.relatedInterests.map((interest, i) => (
                          <span key={i} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
                            {interest}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                <div className="space-y-8">
                  {data.observedIn && data.observedIn.length > 0 && (
                    <section>
                      <h5 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                        <Activity size={14} /> Also observed during
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {data.observedIn.map((loc, i) => (
                          <span key={i} className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
                            {loc}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {data.teamInsights && data.teamInsights.length > 0 && (
                    <section>
                      <h5 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                        <Users size={16} /> Shared Team Insights
                      </h5>
                      <div className="space-y-3">
                        {data.teamInsights.map((insight, i) => (
                          <div key={i} className="rounded-2xl border border-border bg-card p-4 soft-shadow-sm">
                            <p className="text-sm leading-relaxed text-foreground/90">"{insight.body}"</p>
                            <div className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              <span>{insight.authorRole}</span>
                              <span>&bull;</span>
                              <span>{new Date(insight.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row flex-wrap items-center gap-3">
                <span className="w-full sm:w-auto mr-auto text-xs font-medium text-muted-foreground text-center sm:text-left mb-2 sm:mb-0">
                  Classroom actions for this phrase
                </span>
                <button 
                  onClick={() => onLogObservation(data.phrase)} 
                  className="w-full sm:w-auto focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/70 transition-colors" 
                  data-testid="action-log-observation"
                >
                  Log New Observation
                </button>
                <button 
                  onClick={() => onAskTeam(data.phrase)} 
                  className="w-full sm:w-auto focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/70 transition-colors" 
                  data-testid="action-ask-team-known"
                >
                  Ask the Team
                </button>
                <button 
                  onClick={() => onSaveClassroomNote(data.phrase)} 
                  className="w-full sm:w-auto focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/70 transition-colors" 
                  data-testid="action-save-note"
                >
                  Save classroom note
                </button>
                <button 
                  onClick={() => onMarkHeard(data.phrase)} 
                  disabled={markingHeard} 
                  className="w-full sm:w-auto focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50" 
                  data-testid="mark-heard"
                >
                  {markingHeard ? 'Marking...' : 'Mark as heard today'}
                </button>
              </div>
              {heardTodayPhrase?.trim().toLocaleLowerCase() === data.phrase.trim().toLocaleLowerCase() && (
                <p data-testid="heard-today-confirmation" className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
                  Marked as heard today. The shared phrase record has been updated.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-8 text-center animate-in fade-in" data-testid="unknown-result">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-background border border-border mb-4 soft-shadow-sm">
                <Search className="text-muted-foreground" size={24} />
              </div>
              <h4 className="serif text-xl font-semibold text-foreground mb-2">Phrase not found</h4>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
                 "{data.phrase}" isn't in {childName}'s shared communication notes yet. Save a phrase observation to create a review request for the clinician and help the team learn together.
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
                <button 
                  onClick={() => onAddPhrase(data.phrase)} 
                  className="w-full sm:w-auto focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors" 
                  data-testid="action-add-phrase"
                >
                  Add New Phrase
                </button>
                <button 
                  onClick={() => onAskTeam(data.phrase)} 
                  className="w-full sm:w-auto focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/70 transition-colors" 
                  data-testid="action-ask-team"
                >
                  Ask the Team
                </button>
                <button 
                  onClick={() => onNotifyClinician(data.phrase)} 
                  className="w-full sm:w-auto focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/70 transition-colors" 
                  data-testid="action-notify-clinician"
                >
                  Notify Assigned Clinician
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
}
