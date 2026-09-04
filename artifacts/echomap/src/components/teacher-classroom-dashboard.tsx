import { FormEvent, useState } from 'react';
import { getGetTeacherPhraseLookupQueryKey, useGetTeacherPhraseLookup, type ClinicianOverview } from '@workspace/api-client-react';
import { AlertCircle, ArrowRight, BookOpen, MessageCircle, Plus, Search, UserRound, Users } from 'lucide-react';
import { Link } from 'wouter';

interface TeacherClassroomDashboardProps {
  overview?: ClinicianOverview;
  loading: boolean;
  error?: boolean;
  onOpenStudent: (childId: number) => void;
  onAddPhrase: (childId: number) => void;
  onRetry: () => void;
}

const timeAgo = (value: string) => {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(elapsed / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export function TeacherClassroomDashboard({
  overview,
  loading,
  error,
  onOpenStudent,
  onAddPhrase,
  onRetry,
}: TeacherClassroomDashboardProps) {
  const [phraseQuery, setPhraseQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [submittedLookup, setSubmittedLookup] = useState<{ childId: number; query: string } | null>(null);
  const [choosingStudent, setChoosingStudent] = useState(false);
  const phraseLookup = useGetTeacherPhraseLookup(
    { childId: submittedLookup?.childId ?? -1, query: submittedLookup?.query ?? '__' },
    { query: {
      queryKey: getGetTeacherPhraseLookupQueryKey({ childId: submittedLookup?.childId ?? -1, query: submittedLookup?.query ?? '__' }),
      enabled: submittedLookup !== null,
    } },
  );
  const selectedStudent = overview?.children.find((student) => String(student.childId) === selectedStudentId);
  const canSearch = Boolean(selectedStudent && phraseQuery.trim().length >= 2);
  const submitLookup = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedStudent || !canSearch) return;
    setSubmittedLookup({ childId: selectedStudent.childId, query: phraseQuery.trim() });
  };
  if (loading) {
    return <div className="space-y-6 animate-pulse" aria-label="Loading classroom overview">
      <div className="h-28 rounded-3xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 rounded-2xl bg-muted" />)}</div>
      <div className="h-72 rounded-3xl bg-muted" />
    </div>;
  }
  if (!overview || error) {
    return <section className="rounded-3xl border border-border bg-card p-8 text-center soft-shadow">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary"><AlertCircle size={20} /></span>
      <h1 className="serif mt-4 text-3xl font-semibold">Classroom overview unavailable</h1>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Your student roster is still available in My Students while the classroom summary reconnects.</p>
      <button type="button" onClick={onRetry} className="focus-ring mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Try again</button>
    </section>;
  }

  const metrics = [
    { label: 'Students assigned', value: overview.activeChildren, icon: Users },
    { label: 'New phrases', value: overview.newPhrasesSinceLastSignIn, detail: 'since your last sign-in', icon: BookOpen },
    { label: 'Team messages', value: overview.newTeamMessages, icon: MessageCircle },
    { label: 'Needs attention', value: overview.studentsRequiringReview, icon: AlertCircle },
  ];
  const attention = overview.children.filter((child) => child.requiresReview);

  return <div className="space-y-7 animate-rise" data-testid="teacher-classroom-dashboard">
    <section className="overflow-hidden rounded-[2rem] border border-primary/20 bg-primary text-primary-foreground shadow-xl shadow-primary/10">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[.85fr_1.15fr] lg:p-10">
        <div className="flex flex-col justify-between">
          <div>
            <p className="mono text-[10px] font-bold uppercase tracking-[.2em] text-accent">Classroom overview</p>
            <h1 className="serif mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Classroom Communication Hub</h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-primary-foreground/75">Support your students’ communication throughout the day.</p>
          </div>
          <div className="mt-8">
            <button type="button" onClick={() => setChoosingStudent((value) => !value)} className="gold-action focus-ring inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 text-base font-bold text-accent-foreground shadow-lg transition hover:-translate-y-0.5 sm:w-auto" aria-expanded={choosingStudent}>
              <Plus size={22} /> Add a Phrase
            </button>
            <p className="mt-3 text-sm leading-6 text-primary-foreground/65">Heard something worth sharing? Add a phrase for the care team.</p>
          </div>
        </div>
        <div className="rounded-3xl border border-primary-foreground/15 bg-primary-foreground/[.07] p-5 sm:p-6">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-primary-foreground/10 text-accent"><Search size={21} /></span><div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-accent">Phrase lookup</p><h2 className="serif mt-1 text-2xl font-semibold">What Does This Mean?</h2></div></div>
          <p className="mt-3 text-sm leading-6 text-primary-foreground/65">Search a phrase to see if the care team has documented a shared meaning for a specific student.</p>
          <form className="mt-5 space-y-4" onSubmit={submitLookup}>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Student</span>
              <select value={selectedStudentId} onChange={(event) => { setSelectedStudentId(event.target.value); setSubmittedLookup(null); }} className="focus-ring h-14 w-full rounded-2xl border-0 bg-card px-4 text-base text-foreground shadow-lg">
                <option value="">Select a Student</option>
                {overview.children.map((student) => <option key={student.childId} value={student.childId}>{student.childName}</option>)}
              </select>
              <span className="mt-2 block text-xs text-primary-foreground/55">Teachers may only see students they are authorized to access. Type a name while the menu is focused to jump through larger lists.</span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Phrase</span>
              <span className="relative block">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/55" />
                <input value={phraseQuery} onChange={(event) => setPhraseQuery(event.target.value)} placeholder="Enter a phrase you've heard..." className="focus-ring h-14 w-full rounded-2xl border-0 bg-card pl-12 pr-4 text-base text-foreground shadow-lg placeholder:text-muted-foreground" />
              </span>
            </label>
            <button type="submit" disabled={!canSearch} className="focus-ring min-h-12 w-full rounded-2xl bg-accent px-5 py-3 text-sm font-bold text-accent-foreground shadow-md transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
              {!selectedStudent ? 'Select a student first.' : 'Search Meaning'}
            </button>
          </form>
          <div className="mt-4 min-h-12" aria-live="polite">
            {!submittedLookup ? null
              : phraseLookup.isLoading ? <p className="text-sm text-primary-foreground/65">Looking in {selectedStudent?.childName}’s phrase dictionary…</p>
                : phraseLookup.isError ? <p className="text-sm text-accent">Phrase lookup is temporarily unavailable.</p>
                  : phraseLookup.data?.length ? <div className="space-y-2"><p className="text-xs font-bold text-primary-foreground/70">Results for {selectedStudent?.childName}</p>{phraseLookup.data.slice(0, 4).map((result) => <button key={result.id} type="button" onClick={() => onOpenStudent(result.childId)} className="focus-ring block w-full rounded-2xl bg-card p-4 text-left text-foreground shadow-sm transition hover:-translate-y-0.5"><span className="flex items-start justify-between gap-3"><span><span className="block font-bold text-primary">“{result.phrase}”</span><span className="mt-1 block text-sm leading-5">{result.meaning}</span><span className="mt-2 block text-xs text-muted-foreground">{result.childName} · {result.communicationFunction}</span></span><ArrowRight size={16} className="mt-1 shrink-0 text-primary" /></span></button>)}</div>
                    : <div><p className="text-xs font-bold text-primary-foreground/70">Results for {selectedStudent?.childName}</p><p className="mt-2 text-sm text-primary-foreground/65">No documented shared meaning found for “{submittedLookup.query}”.</p></div>}
          </div>
        </div>
      </div>
      {choosingStudent && <div className="border-t border-primary-foreground/15 bg-primary-foreground/[.05] px-6 py-5 sm:px-8 lg:px-10">
        <p className="text-sm font-bold">Who did you hear?</p>
        <div className="mt-3 flex flex-wrap gap-2">{overview.children.map((student) => <button key={student.childId} type="button" onClick={() => onAddPhrase(student.childId)} className="focus-ring rounded-xl bg-card px-4 py-2.5 text-sm font-semibold text-primary shadow-sm hover:bg-secondary">{student.childName}</button>)}</div>
      </div>}
    </section>

    <section>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">My Students</p><h2 className="serif mt-2 text-3xl font-semibold">Open a student profile</h2></div><Link href="/students" className="focus-ring inline-flex items-center gap-2 text-sm font-bold text-primary underline underline-offset-4">View all students <ArrowRight size={15} /></Link></div>
      {overview.children.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{overview.children.slice(0, 6).map((student) => <button key={student.childId} type="button" onClick={() => onOpenStudent(student.childId)} className="focus-ring group rounded-2xl border border-border bg-card p-5 text-left soft-shadow transition hover:-translate-y-0.5 hover:border-primary/35"><div className="flex items-center gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-primary"><UserRound size={21} /></span><span className="min-w-0 flex-1"><span className="block truncate text-base font-bold text-primary">{student.childName}</span><span className="mt-1 block text-xs text-muted-foreground">{[student.grade, student.school].filter(Boolean).join(' · ') || 'Classroom details not added'}</span></span><ArrowRight size={17} className="shrink-0 text-primary transition group-hover:translate-x-0.5" /></div></button>)}</div> : <p className="mt-5 rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">No students are assigned yet.</p>}
    </section>

    <section aria-label="Classroom snapshot">
      <div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Classroom snapshot</p><h2 className="serif mt-2 text-2xl font-semibold">What’s happening today</h2></div>
      <div className="mt-5 grid gap-3 grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => <article key={label} className="rounded-2xl border border-border bg-card p-4 soft-shadow"><div className="flex items-center justify-between gap-2"><span className="grid size-9 place-items-center rounded-xl bg-secondary text-primary"><Icon size={17} /></span><p className="serif text-3xl font-semibold text-primary">{value}</p></div><p className="mt-4 text-xs font-bold text-foreground">{label}</p>
          {'detail' in metrics[1] && label === 'New phrases' ? <p className="mt-1 text-[11px] text-muted-foreground">Since your last sign-in</p> : null}
        </article>)}
      </div>
    </section>

    <div className="grid gap-7 xl:grid-cols-[.85fr_1.15fr]">
      <section id="teacher-attention-list" className="scroll-mt-6 rounded-3xl border border-accent/30 bg-accent/5 p-6 soft-shadow md:p-7">
        <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground"><AlertCircle size={20} /></span><div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Needs attention</p><h2 className="serif mt-2 text-2xl font-semibold">Communication updates</h2><p className="mt-2 text-sm text-muted-foreground">New reviewed phrases or team questions ready for classroom context.</p></div></div>
        {attention.length ? <div className="mt-5 space-y-3">{attention.slice(0, 5).map((student) => <button key={student.childId} type="button" onClick={() => onOpenStudent(student.childId)} className="focus-ring group flex w-full items-center justify-between gap-4 rounded-2xl border border-accent/35 bg-card p-4 text-left hover:border-primary/35"><div><p className="font-semibold text-primary">{student.childName}</p><p className="mt-1 text-xs text-muted-foreground">{student.latestActivityLabel}</p></div><ArrowRight size={17} className="shrink-0 text-primary transition group-hover:translate-x-0.5" /></button>)}</div> : <p className="mt-5 rounded-2xl border border-dashed border-border bg-card/70 p-5 text-sm text-muted-foreground">No students need attention right now.</p>}
      </section>

      <section className="rounded-3xl border border-border bg-card p-6 soft-shadow md:p-7">
        <div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Recent activity</p><h2 className="serif mt-2 text-2xl font-semibold">Communication across your classroom</h2></div>
        {overview.recentActivity.length ? <div className="mt-5 divide-y divide-border">{overview.recentActivity.slice(0, 7).map((item) => <article key={item.id} className="py-4 first:pt-0"><div className="flex items-start gap-3"><span className="mt-1 grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><MessageCircle size={15} /></span><div className="min-w-0"><p className="text-sm leading-6"><span className="font-semibold">{item.author}</span> {item.action} <span className="font-semibold text-primary">{item.target}</span></p><p className="mt-1 text-xs text-muted-foreground">{timeAgo(item.time)}</p></div></div></article>)}</div> : <p className="mt-5 rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">Recent phrase, observation, and message activity will appear here.</p>}
      </section>
    </div>
  </div>;
}