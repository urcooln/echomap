import { Bookmark, Check, BookOpen, ExternalLink, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ClinicianLearningContent({
  module,
  onToggleBookmark,
  onToggleCompleted,
  onSectionSelect,
  isPanel = false
}: {
  module: any;
  onToggleBookmark: () => void;
  onToggleCompleted: () => void;
  onSectionSelect?: (sectionKey: string, progressPercent: number) => void;
  isPanel?: boolean;
}) {
  const EXAMPLE_FIELDS = [
    { key: 'transcript', label: 'Transcript Segment', mono: true },
    { key: 'childLanguageDecision', label: 'Clinical Decision (Language)' },
    { key: 'workingMeaning', label: 'Working Meaning' },
    { key: 'communicationFunction', label: 'Communication Function' },
    { key: 'dictionaryEntry', label: 'Dictionary Entry' },
    { key: 'aacPlanningDecision', label: 'AAC Planning' },
    { key: 'sessionSummary', label: 'Session Summary Note' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in pb-10">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
           <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
             <span className="rounded-md bg-secondary px-2 py-1 text-primary">{module.kind.replace('_', ' ')}</span>
             <span>{module.readingMinutes} min read</span>
           </div>
           <button
             onClick={onToggleBookmark}
             className={`rounded-lg border p-2 transition-colors focus-ring ${module.bookmarked ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card text-muted-foreground hover:bg-secondary'}`}
             aria-label={module.bookmarked ? 'Remove bookmark' : 'Add bookmark'}
           >
             <Bookmark size={18} className={module.bookmarked ? 'fill-current' : ''} />
           </button>
        </div>
        <h1 className={`serif font-semibold leading-tight text-foreground ${isPanel ? 'text-2xl' : 'text-4xl'}`}>
          {module.title}
        </h1>
        <p className={`font-medium leading-relaxed text-muted-foreground ${isPanel ? 'text-sm' : 'text-lg'}`}>
          {module.summary}
        </p>
        {module.tags && module.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {module.tags.map((t: string) => (
              <span key={t} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground/75">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-8">
        {module.sections.map((section: any, idx: number) => (
           <section key={section.sectionKey ?? idx} id={section.sectionKey} className="space-y-4 scroll-mt-24" tabIndex={-1}>
            <h2 className={`serif font-semibold text-foreground ${isPanel ? 'text-xl' : 'text-2xl'}`}>
              {section.heading}
            </h2>
            {section.body && (
              <p className={`whitespace-pre-line leading-relaxed text-foreground/90 ${isPanel ? 'text-sm' : 'text-base'}`}>
                {section.body}
              </p>
            )}
            {section.bullets && section.bullets.length > 0 && (
              <ul className="space-y-2 pl-2">
                {section.bullets.map((bullet: string, bIdx: number) => (
                  <li key={bIdx} className={`flex items-start gap-3 leading-relaxed text-foreground/90 ${isPanel ? 'text-sm' : 'text-base'}`}>
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
            {section.callout && (
              <div className="mt-4 rounded-2xl border-l-4 border-accent bg-accent/5 p-4 md:p-5">
                <p className={`font-medium italic leading-relaxed text-foreground ${isPanel ? 'text-sm' : 'text-base'}`}>
                  {section.callout}
                </p>
              </div>
            )}
             {section.clinicalNote && (
               <aside className="rounded-2xl border border-primary/20 bg-secondary/45 p-4 md:p-5" aria-label="Clinical note">
                 <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><Stethoscope size={15} /> Clinical note</p>
                 <p className={`mt-2 leading-relaxed text-foreground/90 ${isPanel ? 'text-sm' : 'text-base'}`}>{section.clinicalNote}</p>
               </aside>
             )}
             {section.checklist?.length ? (
               <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
                 <h3 className="font-semibold">Implementation checklist</h3>
                 <ul className="mt-3 space-y-2">{section.checklist.map((item: string) => <li key={item} className="flex items-start gap-3 text-sm leading-6"><span aria-hidden className="mt-1 grid size-4 shrink-0 place-items-center rounded border border-primary/35" /><span>{item}</span></li>)}</ul>
               </div>
             ) : null}
             {section.links?.length ? <div className="flex flex-wrap gap-2">{section.links.map((link: any) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-primary"><ExternalLink size={14} />{link.label}</a>)}</div> : null}
            {section.example && (
              <div className="mt-5 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="bg-secondary/60 px-4 py-2.5 border-b border-border flex items-center gap-2">
                  <BookOpen size={14} className="text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">Clinical Example</span>
                </div>
                <div className="p-4 space-y-4">
                  {EXAMPLE_FIELDS.map(f => {
                    const val = section.example[f.key];
                    if (!val) return null;
                    return (
                      <div key={f.key} className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{f.label}</p>
                        <p className={`text-sm text-foreground ${f.mono ? 'font-mono' : ''}`}>{val}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
             {!isPanel && section.sectionKey && <button type="button" onClick={() => onSectionSelect?.(section.sectionKey, Math.round(((idx + 1) / module.sections.length) * 100))} className="text-xs font-semibold text-primary underline-offset-4 hover:underline">Save progress through this section</button>}
          </section>
        ))}
      </div>

      <div className="pt-6 border-t border-border">
        <Button
          onClick={onToggleCompleted}
          variant={module.completed ? 'secondary' : 'default'}
          className={`w-full sm:w-auto ${module.completed ? 'bg-secondary text-foreground hover:bg-secondary/80' : 'bg-primary text-primary-foreground shadow-md hover:-translate-y-0.5'}`}
        >
          {module.completed ? (
            <><Check size={16} className="text-primary mr-2" /> Mark as incomplete</>
          ) : (
            'Mark as completed'
          )}
        </Button>
      </div>
    </div>
  );
}