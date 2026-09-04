import './_group.css';
import {
  ArrowRight, AudioWaveform, BookOpen, Check, ClipboardList, Clock3,
  FileText, MessageCircle, Mic, Shield, Tablet,
} from 'lucide-react';

const noop = () => undefined;
const steps = [
  { label: 'Overview', icon: FileText },
  { label: 'Phrase Dictionary', icon: BookOpen },
  { label: 'Shared Moments', icon: MessageCircle },
  { label: 'Team Notes', icon: ClipboardList },
  { label: 'AAC Info', icon: Tablet },
];

function Avatar() {
  return <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-secondary text-lg font-bold text-foreground ring-4 ring-card md:size-20">MC</div>;
}

function AppButton({ children, variant = 'primary', className = '' }: { children: React.ReactNode; variant?: 'primary' | 'outline'; className?: string }) {
  const skin = variant === 'primary'
    ? 'bg-primary text-primary-foreground shadow-[0_10px_20px_-14px_hsl(var(--brand-forest-950)/.9)]'
    : 'border border-primary/20 bg-card text-primary shadow-sm';
  return <button type="button" onClick={noop} className={`focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${skin} ${className}`}>{children}</button>;
}

export function Current() {
  const reviews = [
    { name: 'Maya Chen', detail: '6 utterances remaining', status: 'Child Language Review in progress', date: 'Jun 17', Icon: ClipboardList, shell: 'border-primary/25 bg-secondary/45' },
    { name: 'Maya Chen', detail: '2 Phrase Inbox items pending', status: 'Child Phrase Inbox incomplete', date: 'Jun 12', Icon: MessageCircle, shell: 'border-accent/30 bg-accent/8' },
  ];
  return (
    <main className="recording-dashboard-redesign min-h-screen px-4 py-5 sm:px-6 md:px-10 md:py-8">
      <div className="mx-auto max-w-[1400px] space-y-7 overflow-x-clip animate-rise">
        <section className="overflow-hidden rounded-[2rem] border border-primary/15 bg-card soft-shadow" data-testid="recording-hero">
          <div className="relative p-5 md:p-7 lg:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-secondary/70 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 size-48 rounded-full bg-accent/10 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-stretch">
              <div className="flex flex-1 flex-col justify-between gap-6">
                <div>
                  <p className="mono text-[10px] font-bold uppercase tracking-[.2em] text-primary">Child Profile · Overview</p>
                  <div className="mt-5">
                    <div className="flex items-start gap-4">
                      <Avatar />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start gap-3">
                              <div className="min-w-[170px] flex-1">
                                <h1 className="serif truncate text-3xl font-semibold tracking-tight md:text-4xl">Maya Chen</h1>
                                <p className="mt-1 text-sm text-muted-foreground">Communication profile · Shared with Maya&apos;s care team</p>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                                  <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">Age 7</span>
                                  <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">Grade 2</span>
                                  <span className="rounded-full bg-accent/20 px-2.5 py-1 text-primary"><MessageCircle className="mr-1 inline" size={12} /> AAC active</span>
                                </div>
                              </div>
                              <section className="w-full shrink-0 rounded-xl border border-[#E8D58A] bg-[#FFF5CC] p-2.5 shadow-[0_4px_12px_-9px_rgba(92,73,18,0.45)] sm:w-[350px]" aria-label="AAC Snapshot">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <Tablet className="shrink-0 text-[#5C4912]" size={13} aria-hidden="true" />
                                    <p className="truncate text-[9px] font-extrabold uppercase tracking-[.13em] text-[#594713]">AAC Snapshot</p>
                                  </div>
                                  <p className="shrink-0 text-[9px] font-medium text-[#86764A]">Confirmed Sep 2026</p>
                                </div>
                                <div className="mt-1.5 grid grid-cols-4 divide-x divide-[#E8D58A]">
                                  <div className="min-w-0 pr-1.5">
                                    <p className="text-[8px] font-bold uppercase tracking-wide text-[#86764A]">AAC User</p>
                                    <span className="mt-0.5 inline-flex rounded-full bg-[#E4BE43] px-1.5 py-0.5 text-[9px] font-extrabold text-[#3D300E]">Yes</span>
                                  </div>
                                  <div className="min-w-0 px-1.5">
                                    <p className="truncate text-[8px] font-bold uppercase tracking-wide text-[#86764A]">Vocabulary</p>
                                    <p className="mt-0.5 truncate text-[10px] font-bold leading-3 text-[#3F3A24]">Core 40</p>
                                  </div>
                                  <div className="min-w-0 px-1.5">
                                    <p className="truncate text-[8px] font-bold uppercase tracking-wide text-[#86764A]">Device</p>
                                    <p className="mt-0.5 truncate text-[10px] font-bold leading-3 text-[#3F3A24]" title="Proloquo2Go · iPad">Proloquo2Go · iPad</p>
                                  </div>
                                  <div className="min-w-0 pl-1.5">
                                    <p className="truncate text-[8px] font-bold uppercase tracking-wide text-[#86764A]">Access</p>
                                    <p className="mt-0.5 truncate text-[10px] font-bold leading-3 text-[#3F3A24]">Direct touch</p>
                                  </div>
                                </div>
                              </section>
                            </div>
                          </div>
                          <select aria-label="Switch child" defaultValue="maya" onChange={noop} className="focus-ring h-9 shrink-0 cursor-pointer rounded-xl border border-input bg-card px-2 text-xs font-bold text-muted-foreground">
                            <option value="maya">Maya Chen</option><option value="oliver">Oliver Brooks</option><option value="sofia">Sofia Alvarez</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4 rounded-2xl border border-border bg-muted/20 p-4">
                      <Stat icon={Clock3} label="Last session" value="Jun 17" />
                      <Stat icon={ClipboardList} label="Pending review" value="2" warm />
                      <Stat icon={FileText} label="Draft count" value="1" muted />
                    </div>
                  </div>
                </div>
                <div className="mt-2" aria-label="Session workflow">
                  <div className="flex min-w-max items-center gap-1.5 overflow-x-auto pb-1">
                    {steps.map((step, index) => {
                      const Icon = step.icon;
                      return <div key={step.label} className="flex items-center gap-1.5">
                        <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${index === 0 ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-muted/30 text-muted-foreground'}`}>
                          <span className={`grid size-4 place-items-center rounded-full ${index === 0 ? 'bg-primary-foreground/20' : 'bg-background'}`}><Icon size={10} /></span>{step.label}
                        </div>
                        {index < steps.length - 1 && <ArrowRight className="shrink-0 text-muted-foreground/30" size={12} />}
                      </div>;
                    })}
                  </div>
                </div>
              </div>
              <div className="flex w-full flex-col gap-4 lg:w-80 lg:shrink-0">
                 <div className="flex flex-col justify-center rounded-3xl border border-primary/15 bg-secondary/30 p-5 pt-6 text-center">
                   <AppButton className="min-h-16 w-full text-lg shadow-xl"><span className="grid size-8 place-items-center rounded-full bg-primary-foreground/20"><Tablet size={18} /></span>Open Profile</AppButton>
                   <p className="mt-4 text-[11px] leading-5 text-muted-foreground">Maya&apos;s communication profile is ready to review and share with her care team.</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/35 p-4"><div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary shadow-sm"><Shield size={16} /></span>
                   <div><h3 className="text-xs font-bold text-foreground">Profile confirmed</h3><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">AAC details are confirmed and remain available as shared communication context.</p></div>
                </div></div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 soft-shadow md:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Progress snapshot</p><h2 className="serif mt-2 text-2xl font-semibold">This Week</h2></div><p className="text-xs text-muted-foreground">Since Jun 10</p></div>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric icon={AudioWaveform} label="Sessions Recorded" value="3" /><Metric icon={ClipboardList} label="Awaiting Review" value="2" /><Metric icon={FileText} label="Draft Notes" value="1" /><Metric icon={Check} label="Completed Notes" value="4" />
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 soft-shadow md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Historical work</p><h2 className="serif mt-2 text-2xl font-semibold">Continue Previous Work</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Unfinished work stays separate from New Recording and opens only when you choose Continue.</p></div><span className="inline-flex rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold text-primary">2 Sessions Need Attention</span></div>
          <div className="mt-5"><h3 className="text-sm font-bold text-foreground">Recordings Requiring Review</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{reviews.map(({ name, detail, status, date, Icon, shell }) => <article key={status} className={`rounded-2xl border p-4 ${shell}`}><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-primary shadow-sm"><Icon size={18} /></span><div className="min-w-0 flex-1"><p className="font-semibold text-foreground">{name}</p><p className="mt-1 text-sm font-semibold text-primary">{detail}</p><p className="mt-1 text-xs text-muted-foreground">{status} · {date}</p></div></div><AppButton variant="outline" className="mt-4 w-full">Continue Maya&apos;s work <ArrowRight size={15} /></AppButton></article>)}</div></div>
          <div className="mt-6 border-t border-border pt-5"><h3 className="text-sm font-bold text-foreground">Draft Documentation</h3><div className="mt-3 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-background px-4 py-4"><div className="min-w-0 flex-1"><p className="truncate font-semibold text-foreground">Session Summary — Maya Chen</p><p className="mt-1 text-xs text-muted-foreground">Last edited Jun 17, 2024</p></div><AppButton variant="outline">Open Draft <ArrowRight size={15} /></AppButton></div></div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 soft-shadow md:p-7"><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Session history</p><h2 className="serif mt-2 text-2xl font-semibold">Recent Recordings</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Previous recordings never open automatically. Choose Open Recording to load one.</p><div className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border">{['Jun 17, 2024', 'Jun 12, 2024', 'Jun 5, 2024'].map((date) => <div key={date} className="flex flex-wrap items-center justify-between gap-4 bg-background px-4 py-3"><div><p className="font-semibold">Maya Chen</p><p className="mt-1 text-sm text-muted-foreground">{date}</p></div><AppButton variant="outline">Open Recording <ArrowRight size={15} /></AppButton></div>)}</div></section>
      </div>
    </main>
  );
}

function Stat({ icon: Icon, label, value, warm, muted }: { icon: typeof Clock3; label: string; value: string; warm?: boolean; muted?: boolean }) {
  return <div className="flex items-center gap-3"><span className={`grid size-8 place-items-center rounded-xl bg-background shadow-sm ${warm ? 'text-accent' : muted ? 'text-primary/60' : 'text-primary'}`}><Icon size={14} /></span><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="text-sm font-semibold">{value}</p></div></div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Mic; label: string; value: string }) {
  return <article className="rounded-2xl border border-primary/10 bg-secondary/30 p-4"><div className="flex items-center justify-between gap-3"><Icon className="text-primary" size={18} /><span className="mono text-2xl font-bold text-primary">{value}</span></div><p className="mt-3 text-xs font-bold text-muted-foreground">{label}</p></article>;
}