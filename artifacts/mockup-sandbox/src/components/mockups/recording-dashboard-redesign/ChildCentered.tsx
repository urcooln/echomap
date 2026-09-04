import './_group.css';
import { useState, type ReactNode } from 'react';
import {
  ArrowRight, AudioWaveform, BookOpen, Check, ChevronDown, ClipboardList,
  Clock3, FileText, Lightbulb, MessageCircle, Mic, Shield, Tablet,
} from 'lucide-react';

const noop = () => undefined;
const steps = [
  { label: 'Record', icon: Mic, active: true },
  { label: 'Review', icon: ClipboardList },
  { label: 'Phrase Inbox', icon: MessageCircle },
  { label: 'Dictionary', icon: BookOpen },
  { label: 'Session Summary', icon: FileText },
];

function Avatar() {
  return (
    <div aria-label="Maya Chen avatar" className="grid size-[4.5rem] shrink-0 place-items-center rounded-[1.35rem] bg-[hsl(var(--brand-gold-100))] text-xl font-bold text-[hsl(var(--brand-forest-800))] ring-4 ring-[hsl(var(--brand-cream-25))] shadow-sm sm:size-24">
      MC
    </div>
  );
}

function Button({ children, variant = 'primary', className = '', ...props }: { children: ReactNode; variant?: 'primary' | 'outline' | 'quiet'; className?: string; [key: string]: unknown }) {
  const skin = variant === 'primary'
    ? 'bg-primary text-primary-foreground shadow-[0_14px_24px_-15px_hsl(var(--brand-forest-950)/.9)] hover:-translate-y-0.5'
    : variant === 'outline'
      ? 'border border-primary/20 bg-card text-primary hover:border-primary/40 hover:bg-secondary/60'
      : 'bg-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground';
  return <button type="button" onClick={noop} {...props} className={`focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${skin} ${className}`}>{children}</button>;
}

export function ChildCentered() {
  const [child, setChild] = useState('maya');
  const reviews = [
    { label: 'Child Language Review', detail: '6 utterances remaining', date: 'Jun 17', Icon: ClipboardList, tone: 'bg-secondary/50 border-primary/15' },
    { label: 'Phrase Inbox', detail: '2 items pending', date: 'Jun 12', Icon: MessageCircle, tone: 'bg-accent/10 border-accent/25' },
  ];
  return (
    <main className="recording-dashboard-redesign min-h-[100dvh] px-3 py-4 sm:px-6 sm:py-6 lg:px-10">
      <div className="mx-auto max-w-[1380px] space-y-5 overflow-x-clip animate-rise">
        <header className="flex items-center justify-between px-1">
          <div>
            <p className="mono text-[10px] font-bold uppercase tracking-[.22em] text-primary">EchoMap · Clinician workspace</p>
            <p className="mt-1 text-xs text-muted-foreground">Prepare a thoughtful session with one child.</p>
          </div>
          <button type="button" onClick={noop} aria-label="Open workspace help" className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-primary"><Lightbulb size={17} /></button>
        </header>

        <section data-testid="recording-hero" className="overflow-hidden rounded-[1.75rem] border border-primary/15 bg-card soft-shadow">
          <div className="border-b border-primary/10 bg-secondary/25 px-4 py-3 sm:px-7">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" aria-label="Session workflow">
              {steps.map(({ label, icon: Icon, active }, index) => <div key={label} className="flex shrink-0 items-center gap-1.5">
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold ${active ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card/60 text-muted-foreground'}`}>
                  <span className={`grid size-4 place-items-center rounded-full ${active ? 'bg-primary-foreground/20' : 'bg-secondary'}`}><Icon size={10} /></span>{label}
                </div>
                {index < steps.length - 1 && <ArrowRight className="text-muted-foreground/35" size={12} />}
              </div>)}
            </div>
          </div>
          <div className="relative p-4 sm:p-7 lg:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full bg-secondary/70 blur-3xl" />
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-8">
              <div>
                <div className="flex items-start gap-4">
                  <Avatar />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary/70">Selected child · new session</p>
                        <h1 className="serif mt-1 text-[2rem] font-semibold leading-tight tracking-tight sm:text-[2.7rem]">Maya Chen</h1>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="rounded-full bg-secondary px-2.5 py-1">Age 7</span>
                          <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">Grade 2</span>
                          <span className="rounded-full bg-accent/25 px-2.5 py-1 text-primary"><MessageCircle className="mr-1 inline" size={12} /> AAC active</span>
                        </div>
                      </div>
                      <label className="sr-only" htmlFor="switch-child">Switch child</label>
                      <div className="relative">
                        <select id="switch-child" aria-label="Switch child" value={child} onChange={(e) => setChild(e.target.value)} className="focus-ring h-9 cursor-pointer appearance-none rounded-xl border border-primary/15 bg-card py-1 pl-3 pr-8 text-xs font-bold text-primary">
                          <option value="maya">Maya Chen</option><option value="oliver">Oliver Brooks</option><option value="sofia">Sofia Alvarez</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-2.5 text-muted-foreground" size={13} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-primary/10 bg-muted/20 p-3 sm:grid-cols-4 sm:gap-4 sm:p-4">
                  <Info icon={Clock3} label="Last session" value="Jun 17" />
                  <Info icon={ClipboardList} label="Review count" value="2" warm />
                  <Info icon={FileText} label="Draft count" value="1" muted />
                  <Info icon={BookOpen} label="Vocabulary" value="Core 40" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-foreground"><Tablet size={14} className="text-primary" /> Proloquo2Go · iPad</span>
                  <span>Communication Goals: requesting, commenting, repair</span>
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-primary/15 bg-secondary/45 p-4 sm:p-5">
                <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Session ready</p>
                <div className="mt-3 flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Shield size={19} /></span>
                  <div><h2 className="font-semibold">A quiet place to begin</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Maya&apos;s new session will start blank. Previous recordings stay separate and will not preload into this work.</p></div>
                </div>
                <div className="mt-4 border-t border-primary/10 pt-4">
                  <Button data-testid="button-start-recording" className="min-h-[4.25rem] w-full rounded-2xl text-lg sm:text-xl"><span className="grid size-9 place-items-center rounded-full bg-primary-foreground/15"><Mic size={20} /></span>Start Recording</Button>
                  <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">Consent confirmation is required before microphone access. Recordings remain private to your caseload.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <section className="rounded-3xl border border-border bg-card p-5 soft-shadow sm:p-6">
            <div className="flex items-end justify-between gap-3"><div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Progress snapshot</p><h2 className="serif mt-1 text-2xl font-semibold">This week with Maya</h2></div><span className="text-xs text-muted-foreground">Since Jun 10</span></div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric icon={AudioWaveform} label="Sessions" value="3" /><Metric icon={ClipboardList} label="Awaiting review" value="2" /><Metric icon={FileText} label="Draft notes" value="1" /><Metric icon={Check} label="Completed" value="4" /></div>
          </section>
          <section className="rounded-3xl border border-border bg-card p-5 soft-shadow sm:p-6">
            <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Keep in mind</p><h2 className="serif mt-1 text-2xl font-semibold">Communication goals</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground"><li className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-accent" />Requesting a preferred item or activity</li><li className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-accent" />Commenting during shared play</li><li className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-accent" />Repairing a misunderstood message</li></ul>
          </section>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 soft-shadow sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Secondary workspace</p><h2 className="serif mt-1 text-2xl font-semibold">Continue previous work</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Review and history stay below the recording workspace. Nothing opens automatically.</p></div><span className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold text-primary">2 need attention</span></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{reviews.map(({ label, detail, date, Icon, tone }) => <article key={label} className={`rounded-2xl border p-4 ${tone}`}><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-card text-primary shadow-sm"><Icon size={18} /></span><div><p className="font-semibold">{label}</p><p className="mt-1 text-sm font-semibold text-primary">{detail}</p><p className="mt-1 text-xs text-muted-foreground">Maya Chen · {date}</p></div></div><Button variant="outline" className="mt-4 w-full justify-between">Continue review <ArrowRight size={15} /></Button></article>)}</div>
        </section>
      </div>
    </main>
  );
}

function Info({ icon: Icon, label, value, warm, muted }: { icon: typeof Clock3; label: string; value: string; warm?: boolean; muted?: boolean }) {
  return <div className="flex min-w-0 items-center gap-2"><span className={`grid size-8 shrink-0 place-items-center rounded-xl bg-background shadow-sm ${warm ? 'text-accent' : muted ? 'text-primary/60' : 'text-primary'}`}><Icon size={14} /></span><div className="min-w-0"><p className="truncate text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="truncate text-xs font-semibold">{value}</p></div></div>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof Mic; label: string; value: string }) {
  return <article className="rounded-2xl border border-primary/10 bg-secondary/30 p-3"><div className="flex items-center justify-between"><Icon className="text-primary" size={17} /><span className="mono text-xl font-bold text-primary">{value}</span></div><p className="mt-2 text-[11px] font-bold text-muted-foreground">{label}</p></article>;
}