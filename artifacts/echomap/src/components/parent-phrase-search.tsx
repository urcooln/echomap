import { useMemo, useState, type ChangeEvent } from 'react';
import { 
  Search, 
  X, 
  Plus, 
  Activity, 
  MessageCircle, 
  Clock, 
  Users, 
  ArrowRight, 
  Lightbulb, 
  BookOpen,
  ChevronLeft
} from 'lucide-react';

export interface ParentSearchPhrase {
  id: string | number;
  phrase: string;
  meaning: string;
  function: string;
  contexts: string[];
  source: string;
  occurrences?: number;
  dateAdded?: string;
  lastObservedAt?: string | null;
  observers?: string[];
  suggestedResponses?: string[];
  relatedPhrases?: Array<{ id: string | number; phrase: string }>;
}

export interface ParentPhraseSearchProps {
  phrases: ParentSearchPhrase[];
  onAddPhrase: () => void;
  onAddObservation: () => void;
  onAskTeam: (phrase: string) => void;
}

function normalizeText(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function suggestedResponsesFor(communicationFunction: string) {
  const normalized = communicationFunction.toLocaleLowerCase();
  if (normalized.includes('request') || normalized.includes('help')) {
    return ['Notice what your child is asking for.', 'Offer one simple choice.', 'Pause to see what they want to share next.'];
  }
  if (normalized.includes('protest') || normalized.includes('regulat') || normalized.includes('transition')) {
    return ['Acknowledge that this moment may be hard.', 'Make space for a pause or familiar support.', 'Follow your child’s lead before adding more words.'];
  }
  return ['Join the play or shared interest.', 'Expand the idea with one short, natural comment.', 'Follow your child’s lead.', 'Model related language in the moment.'];
}

function observerRolesFor(phrase: ParentSearchPhrase) {
  if (phrase.observers?.length) return phrase.observers;
  const source = phrase.source.toLocaleLowerCase();
  if (source.includes('home')) return ['Parent'];
  if (source.includes('school') || source.includes('classroom')) return ['Teacher'];
  if (source.includes('therapy') || source.includes('slp')) return ['SLP'];
  return ['Care team'];
}

function friendlyDate(value?: string | null) {
  if (!value) return 'Not yet recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not yet recorded';
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (startOfToday === startOfDate) return 'Today';
  if (startOfToday - startOfDate === 86_400_000) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function ParentPhraseSearch({ 
  phrases = [], 
  onAddPhrase, 
  onAddObservation, 
  onAskTeam 
}: ParentPhraseSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhraseId, setSelectedPhraseId] = useState<string | number | null>(null);

  const selectedPhrase = useMemo(() => {
    return phrases.find(p => p.id === selectedPhraseId) || null;
  }, [phrases, selectedPhraseId]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = normalizeText(searchQuery);
    const qWords = q.split(" ").filter(Boolean);
    
    return phrases.map(p => {
      const pNorm = normalizeText(p.phrase);
      let score = 0;
      
      if (pNorm === q) {
        score = 100;
      } else if (pNorm.includes(q)) {
        score = 50;
      } else {
        const pWords = pNorm.split(" ");
        const matchedWords = qWords.filter(qw => pWords.some(pw => pw.includes(qw) || qw.includes(pw)));
        if (matchedWords.length > 0) {
          score = matchedWords.length * 10;
        }
      }
      return { phrase: p, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.phrase);
  }, [phrases, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;
  const hasNoMatches = isSearching && searchResults.length === 0;
  const suggestedResponses = selectedPhrase ? (selectedPhrase.suggestedResponses?.length
    ? selectedPhrase.suggestedResponses
    : suggestedResponsesFor(selectedPhrase.function)) : [];
  const observerRoles = selectedPhrase ? observerRolesFor(selectedPhrase) : [];
  const relatedPhrases = useMemo(() => {
    if (!selectedPhrase) return [];
    const explicit = selectedPhrase.relatedPhrases
      ?.map((related) => phrases.find((phrase) => phrase.id === related.id))
      .filter((phrase): phrase is ParentSearchPhrase => Boolean(phrase)) ?? [];
    if (explicit.length) return explicit.slice(0, 3);
    const selectedContexts = new Set(selectedPhrase.contexts.map(normalizeText));
    return phrases
      .filter((phrase) => phrase.id !== selectedPhrase.id)
      .map((phrase) => ({
        phrase,
        score: (normalizeText(phrase.function) === normalizeText(selectedPhrase.function) ? 2 : 0)
          + phrase.contexts.filter((context) => selectedContexts.has(normalizeText(context))).length,
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.phrase.phrase.localeCompare(right.phrase.phrase))
      .slice(0, 3)
      .map((item) => item.phrase);
  }, [phrases, selectedPhrase]);

  const handleSelectPhrase = (id: string | number) => {
    const p = phrases.find(x => x.id === id);
    if (p) {
      setSearchQuery(p.phrase);
      setSelectedPhraseId(p.id);
    }
  };

  const handleQueryChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setSearchQuery(newQuery);
    if (selectedPhraseId) {
      const p = phrases.find(x => x.id === selectedPhraseId);
      if (p && newQuery !== p.phrase) {
        setSelectedPhraseId(null);
      }
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSelectedPhraseId(null);
  };

  const hasTimeline = Boolean(selectedPhrase);
  const hasObservers = Boolean(selectedPhrase);
  const hasObservationDetails = hasTimeline || hasObservers;

  return (
    <div className="rounded-3xl border border-border bg-card soft-shadow overflow-hidden" data-testid="parent-phrase-search">
      {/* Search Header */}
      <div className="border-b border-border bg-secondary/10 p-6 md:p-8">
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <span className="grid size-6 place-items-center rounded-full bg-primary/10">
                <Search size={12} aria-hidden="true" />
              </span>
              <span className="mono text-[10px] font-bold uppercase tracking-[0.2em]">Phrase Search</span>
            </div>
            <h2 className="serif text-2xl font-semibold text-foreground">Search Your Child&apos;s Phrases</h2>
            <p className="mt-1 text-sm text-muted-foreground">Search for a phrase your child uses to see what it might mean.</p>
          </div>
        </div>
        
        <div className="relative max-w-2xl">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-muted-foreground">
            <Search size={18} aria-hidden="true" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={handleQueryChange}
            placeholder={'Search a phrase... Example: "Let\'s save the city!"'}
            className="focus-ring h-14 w-full rounded-2xl border border-border bg-background pl-11 pr-12 text-base text-foreground placeholder:text-muted-foreground transition-shadow"
            data-testid="input-phrase-search"
            aria-label="Search your child's phrases"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 flex items-center pr-4 text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-clear-search"
              aria-label="Clear search"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      
      {/* Content Area */}
      <div className="p-6 md:p-8">
        {selectedPhrase ? (
          <div className="animate-rise" data-testid={`view-selected-phrase-${selectedPhrase.id}`}>
            <button 
              onClick={() => setSelectedPhraseId(null)} 
              className="focus-ring -ml-2 mb-6 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
              aria-label="Back to search results"
            >
              <ChevronLeft size={16} aria-hidden="true" /> Back to search
            </button>
            
            <div className="mb-8">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <span className="grid size-7 place-items-center rounded-full bg-primary/10">
                  <MessageCircle size={14} aria-hidden="true" />
                </span>
                <span className="mono text-[10px] font-bold uppercase tracking-[0.2em]">Shared Meaning</span>
              </div>
              <h2 className="serif text-3xl font-semibold text-foreground">"{selectedPhrase.phrase}"</h2>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-6">
                <section className="rounded-2xl border border-border bg-secondary/15 p-5">
                  <h3 className="mono mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Possible Meaning</h3>
                  <p className="text-sm leading-relaxed text-foreground">{selectedPhrase.meaning}</p>
                  
                  {selectedPhrase.function && (
                    <div className="mt-5 border-t border-border pt-5">
                      <h3 className="mono mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Communication Function</h3>
                      <span className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">{selectedPhrase.function}</span>
                    </div>
                  )}
                </section>
                
                {selectedPhrase.contexts && selectedPhrase.contexts.length > 0 && (
                  <section className="rounded-2xl border border-border bg-card p-5 soft-shadow">
                    <h3 className="mono mb-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Observed Contexts</h3>
                    <ul className="space-y-3">
                      {selectedPhrase.contexts.map((ctx, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/40" aria-hidden="true" />
                          <span className="leading-relaxed">{ctx}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
              
              <div className="space-y-6">
                {suggestedResponses.length > 0 && (
                  <section className="rounded-2xl border border-accent/20 bg-accent/5 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Lightbulb size={16} className="text-accent" aria-hidden="true" />
                      <h3 className="mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Suggested Parent Responses</h3>
                    </div>
                    <ul className="space-y-3">
                      {suggestedResponses.map((resp, i) => (
                        <li key={i} className="flex items-start gap-3 rounded-xl bg-background/50 p-3.5 text-sm text-foreground shadow-sm">
                          <span className="font-semibold text-accent mt-0.5" aria-hidden="true">✓</span>
                          <span className="leading-relaxed">{resp}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                
                {hasObservationDetails && (
                  <section className="rounded-2xl border border-border bg-card p-5 soft-shadow">
                     <h3 className="mono mb-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Observation Details</h3>
                     <div className="grid gap-4 sm:grid-cols-2">
                       {hasTimeline && (
                         <div>
                           <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
                             <Clock size={14} aria-hidden="true" />
                             <span className="text-xs font-medium">Timeline</span>
                           </div>
                           <div className="space-y-1 text-xs leading-5 text-muted-foreground">
                              <p>First Observed: <span className="font-medium text-foreground/80">{friendlyDate(selectedPhrase.dateAdded)}</span></p>
                              <p>Most Recently Observed: <span className="font-medium text-foreground/80">{friendlyDate(selectedPhrase.lastObservedAt ?? selectedPhrase.dateAdded)}</span></p>
                           </div>
                         </div>
                       )}
                       
                       {hasObservers && (
                         <div>
                           <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
                             <Users size={14} aria-hidden="true" />
                              <span className="text-xs font-medium">Observed By</span>
                           </div>
                           <div className="flex flex-wrap gap-1.5">
                              {observerRoles.map((obs, i) => (
                               <span key={i} className="rounded-md bg-secondary/60 px-2 py-1 text-[11px] font-medium text-secondary-foreground">{obs}</span>
                             ))}
                           </div>
                         </div>
                       )}
                     </div>
                  </section>
                )}
                
                {relatedPhrases.length > 0 && (
                  <section className="rounded-2xl border border-border bg-card p-5 soft-shadow">
                    <h3 className="mono mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Similar Phrases</h3>
                    <div className="flex flex-wrap gap-2">
                      {relatedPhrases.map(rp => (
                        <button 
                          key={rp.id}
                          onClick={() => handleSelectPhrase(rp.id)}
                          className="focus-ring rounded-lg border border-border bg-secondary/20 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary/50 hover:border-border/80"
                          data-testid={`button-related-phrase-${rp.id}`}
                        >
                          "{rp.phrase}"
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        ) : hasNoMatches ? (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-rise" data-testid="search-no-match">
            <div className="mb-5 grid size-12 place-items-center rounded-full bg-secondary/50 text-muted-foreground ring-4 ring-secondary/20">
              <Search size={20} aria-hidden="true" />
            </div>
            <h3 className="serif text-xl font-semibold text-foreground">This phrase has not been added to your child&apos;s communication dictionary yet.</h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">Every phrase your child shares can help the people who care about them understand more.</p>
            
            <div className="mt-8 flex flex-col items-stretch gap-3 w-full sm:w-auto sm:flex-row sm:items-center sm:justify-center">
              <button onClick={onAddPhrase} className="gold-action focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-primary transition-transform hover:-translate-y-0.5" data-testid="button-no-match-add-phrase">
                <Plus size={16} aria-hidden="true" /> Add Phrase
              </button>
              <button onClick={onAddObservation} className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/70" data-testid="button-no-match-add-observation">
                <Activity size={16} aria-hidden="true" /> Add Observation
              </button>
              <button onClick={() => onAskTeam(searchQuery)} className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/70" data-testid="button-no-match-ask-team">
                <MessageCircle size={16} aria-hidden="true" /> Ask Team About This Phrase
              </button>
            </div>
            <div className="mt-8 max-w-md rounded-2xl border border-dashed border-primary/25 bg-primary/5 p-4 text-left">
              <p className="text-sm font-semibold text-foreground">Have you heard your child say this?</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">This helps grow the communication dictionary naturally.</p>
              <button onClick={onAddObservation} className="focus-ring mt-3 inline-flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-xs font-semibold text-primary shadow-sm hover:bg-secondary/60" data-testid="button-quick-add-observation">
                <Activity size={14} aria-hidden="true" /> Add Observation
              </button>
            </div>
          </div>
        ) : isSearching ? (
          <div className="divide-y divide-border animate-rise" data-testid="search-results">
            {searchResults.map(p => (
              <button 
                key={p.id} 
                onClick={() => handleSelectPhrase(p.id)}
                className="focus-ring group flex w-full flex-col items-start gap-2 py-4 text-left transition-all hover:bg-secondary/30 sm:flex-row sm:items-center sm:justify-between sm:px-4 rounded-xl -mx-4 sm:mx-0 px-4"
                data-testid={`button-search-result-${p.id}`}
              >
                <div className="pr-4">
                  <p className="serif text-lg font-medium text-foreground transition-colors group-hover:text-primary">"{p.phrase}"</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground line-clamp-1">{p.meaning}</p>
                </div>
                <div className="shrink-0 flex items-center justify-center size-8 rounded-full bg-background border border-transparent group-hover:border-border group-hover:shadow-sm transition-all text-muted-foreground/40 group-hover:text-primary">
                  <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="animate-rise">
            {phrases.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-secondary/40 text-muted-foreground/60">
                  <BookOpen size={20} aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-foreground">Your child's phrase map is ready to grow.</p>
                <p className="mt-1 text-xs">Try searching once phrases have been added by your team.</p>
              </div>
            ) : (
              <div className="py-2">
                <p className="mono mb-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Suggested phrases to explore</p>
                <div className="flex flex-wrap gap-2.5">
                  {phrases.slice(0, 5).map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => handleSelectPhrase(p.id)}
                      className="focus-ring rounded-xl border border-border bg-secondary/20 px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:-translate-y-0.5 hover:bg-secondary/40 hover:border-border/80 hover:shadow-sm"
                      data-testid={`button-suggested-phrase-${p.id}`}
                    >
                      "{p.phrase}"
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
