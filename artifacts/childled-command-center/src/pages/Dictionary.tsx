import { useEffect, useState } from 'react';
import { useGetDictionaryInsights, useListChildren, getGetDictionaryInsightsQueryKey, getListChildrenQueryKey } from '@workspace/api-client-react';
import { Search, ChevronDown, BookOpen } from 'lucide-react';

export default function Dictionary() {
  const [query, setQuery] = useState('');
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);

  const { data: childrenData } = useListChildren({ query: { queryKey: getListChildrenQueryKey() } });
  const children = childrenData ?? [];
  
  useEffect(() => {
    if (!selectedChildId && children[0]) setSelectedChildId(children[0].id);
  }, [children, selectedChildId]);

  const { data: dictionary, isLoading } = useGetDictionaryInsights(
    { childId: selectedChildId ?? 0 },
    { query: { enabled: !!selectedChildId, queryKey: getGetDictionaryInsightsQueryKey({ childId: selectedChildId ?? 0 }) } }
  );

  const filteredEntries = dictionary?.entries.filter(entry => 
    entry.gestalt.phrase.toLowerCase().includes(query.toLowerCase()) || 
    entry.gestalt.meaning.toLowerCase().includes(query.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="cc-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Phrase Dictionary</p>
          <h1 className="cc-serif text-4xl font-bold text-primary mt-1">Shared Language</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            A collaborative map of meaning across home, clinic, and school.
          </p>
        </div>
        
        <div className="relative">
          <select 
            data-testid="select-dictionary-child"
            value={selectedChildId || ''} 
            onChange={(e) => setSelectedChildId(Number(e.target.value))}
            className="cc-focus appearance-none rounded-xl border border-card-border bg-card px-4 py-2.5 pr-10 text-sm font-semibold shadow-sm w-48 text-foreground"
          >
            {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            {children.length === 0 && <option value="" disabled>No children</option>}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-3 text-muted-foreground" />
        </div>
      </div>

      <div className="cc-card p-6 md:p-8 rounded-3xl">
        <div className="relative mb-6 max-w-md">
          <Search size={16} className="absolute left-3 top-3.5 text-muted-foreground" />
          <input 
            data-testid="input-dictionary-search"
            className="cc-focus min-h-11 w-full rounded-xl border border-card-border bg-background pl-10 pr-3 text-sm placeholder:text-muted-foreground/60" 
            placeholder="Search phrases or meanings..." 
            value={query} 
            onChange={e => setQuery(e.target.value)} 
          />
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-20 skeleton rounded-xl" />
            <div className="h-20 skeleton rounded-xl" />
            <div className="h-20 skeleton rounded-xl" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-card-border py-16 text-center bg-background/50">
            <BookOpen className="mx-auto mb-3 text-muted-foreground/40" size={32} />
            <p className="cc-serif text-xl">No entries found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search or select another child.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredEntries.map(entry => (
              <article key={entry.gestalt.id} data-testid={`card-dictionary-${entry.gestalt.id}`} className="rounded-2xl border border-card-border bg-background p-5 hover:border-primary/20 transition-all shadow-sm">
                <p className="cc-serif text-xl font-medium leading-snug">“{entry.gestalt.phrase}”</p>
                
                <div className="mt-4 pt-4 border-t border-card-border space-y-2">
                  <div className="flex gap-2 text-sm">
                    <span className="font-semibold w-16 text-muted-foreground text-xs uppercase cc-mono tracking-widest mt-0.5">Meaning</span>
                    <span className="flex-1">{entry.gestalt.meaning}</span>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <span className="font-semibold w-16 text-muted-foreground text-xs uppercase cc-mono tracking-widest mt-0.5">Function</span>
                    <span className="flex-1 font-medium">{entry.gestalt.function}</span>
                  </div>
                  <div className="flex gap-2 text-sm mt-3 pt-3">
                    <span className="flex-1 text-xs text-muted-foreground italic">
                      Observed {entry.occurrences} times
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}