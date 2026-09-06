import {
  Activity,
  BookOpen,
  CalendarDays,
  Heart,
  Info,
  Leaf,
  Lightbulb,
  MessageCircle,
  Mic,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { TeacherCommunicationHelper } from './teacher-communication-helper';
import { ParentPhraseSearch } from './parent-phrase-search';
import type { InboxMessage } from './team-inbox';
import { isTeacherReviewedPhrase } from '../lib/teacher-phrase-safety';
import { teacherWorkspaceSections } from '../lib/teacher-workspace-navigation';

import { SharedChildProfile } from './shared-child-profile';
import { AacInformationCard } from './aac-information';
import { ParentLearningCenterWidget } from './parent-learning-center-widget';

export interface PortalChild {
  id: number;
  name: string;
  school: string;
  grade: string;
  communicationStyle: string;
  strengths?: string[];
  sensoryPreferences?: string[];
  specialInterests?: string[];
  regulationNotes?: string;
  sensorySupports?: string[];
  sensoryChallenges?: string[];
  aacSnapshot?: {
    isUser: boolean;
    device: string | null;
    vocabularySystem: string | null;
    accessMethod: string | null;
    lastConfirmedAt: string | null;
  };
}

export interface PortalGestalt {
  id: number;
  phrase: string;
  meaning: string;
  function: string;
  contexts: string[];
  source: string;
  occurrences?: number;
  lastObservedAt?: string | null;
  dateAdded?: string;
}

export interface PortalObservation {
  id: number;
  body: string;
  context: string;
  author: string;
  createdAt: string;
  video?: {
    url: string;
    contentType: string;
    sizeBytes: number;
    consentConfirmedAt: string;
  };
}

export interface PortalTimelineEntry {
  date: string;
  label: string;
  detail: string;
}
export interface PortalInterest {
  id: string;
  childId: number;
  interest: string;
  status: 'approved' | 'suggested';
  addedAt: string;
  addedBy: string;
  addedByRole: string;
  canEdit: boolean;
}

/**
 * Parent Portal
 * Role-safe: No clinical jargon, no stage labels, no SOAP notes.
 * Focus: Warm progress updates, home coaching, and shared milestones.
 */
export function ParentPortal({
  child,
  gestalts = [],
  observations = [],
  timeline = [],
  interests = [],
  onAddObservation,
  onAddPhrase,
  onAskClinician,
  onAskTeam,
  onPhraseNote,
  onAddInterest,
  onEditInterest,
  onRemoveInterest,
  onUpdateSensory,
}: {
  child: PortalChild;
  gestalts?: PortalGestalt[];
  observations?: PortalObservation[];
  timeline?: PortalTimelineEntry[];
  interests?: PortalInterest[];
  onAddObservation: () => void;
  onAddPhrase: () => void;
  onAskClinician: () => void;
  onAskTeam: (phrase: string) => void;
  onPhraseNote: (gestalt: PortalGestalt, kind: 'meaning' | 'context') => void;
  onAddInterest: () => void;
  onEditInterest: (interest: PortalInterest) => void;
  onRemoveInterest: (interest: PortalInterest) => void;
  onUpdateSensory: () => void;
}) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentPhrases = gestalts.filter((gestalt) => gestalt.dateAdded && new Date(gestalt.dateAdded).getTime() >= weekAgo).slice(0, 3);
  const visibleRecentPhrases = recentPhrases.length ? recentPhrases : gestalts.slice(0, 3);
  const approvedInterests = interests.filter((interest) => interest.status === 'approved');
  const parentSuggestions = interests.filter((interest) => interest.status === 'suggested');
  const supports = child.sensorySupports?.length ? child.sensorySupports : child.sensoryPreferences ?? [];
  const challenges = child.sensoryChallenges ?? [];
  const highlight = visibleRecentPhrases.length
    ? `${child.name} used ${visibleRecentPhrases.length} new phrase${visibleRecentPhrases.length === 1 ? '' : 's'} recently and kept sharing ideas with the people around them.`
    : `Every phrase ${child.name} shares helps the team understand what matters to them.`;
  return (
    <div className="space-y-8 animate-rise delay-1">
      <section className="relative overflow-hidden rounded-3xl bg-secondary p-6 text-secondary-foreground soft-shadow md:p-8">
        <div className="absolute -right-10 -top-20 size-64 rounded-full border-[28px] border-primary/5" />
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-primary"><span className="grid size-7 place-items-center rounded-full bg-primary/10"><Heart size={14} /></span><span className="mono text-[10px] font-bold uppercase tracking-[0.2em]">Family home</span></div>
            <h2 className="serif text-3xl font-semibold leading-tight text-foreground md:text-4xl">{child.name}'s communication map</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">A simple place to notice what your child is saying, what helps, and what you want to share with the care team.</p>
          </div>
          <div className="flex min-w-[210px] flex-col gap-3"><button onClick={onAddObservation} className="gold-action focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-primary"><Plus size={16} /> Log observation</button><button onClick={onAskClinician} className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/70"><MessageCircle size={16} /> Ask the team</button></div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground soft-shadow md:p-8" data-testid="parent-weekly-highlights">
        <div className="absolute -right-12 -top-16 size-52 rounded-full border-[22px] border-accent/15" />
        <div className="relative flex items-start gap-4"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-primary"><Sparkles size={21} /></div><div><p className="mono text-[10px] font-bold uppercase tracking-[.2em] text-accent">This week's highlights</p><h2 className="serif mt-2 text-2xl font-semibold">Small moments, big connection.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-primary-foreground/80">{highlight}</p></div></div>
      </section>

      <ParentLearningCenterWidget childId={child.id} />
      <AacInformationCard childId={child.id} />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-3xl border border-border bg-card p-6 soft-shadow md:p-8" data-testid="parent-recent-progress">
          <div className="mb-6 flex items-end justify-between gap-4"><div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Recent progress</p><h2 className="serif mt-2 text-2xl font-semibold">New phrases this week</h2></div><CalendarDays size={20} className="text-primary" /></div>
          {visibleRecentPhrases.length ? <div className="space-y-3">{visibleRecentPhrases.map((g) => <div key={g.id} className="rounded-2xl border border-border bg-secondary/20 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><p className="serif text-xl font-semibold">“{g.phrase}”</p><span className="text-[11px] text-muted-foreground">{g.dateAdded ? new Date(g.dateAdded).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recently'}</span></div><p className="mt-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Context:</span> {g.contexts?.[0] ?? 'Shared with the team'}</p><p className="mt-1 text-xs italic text-muted-foreground">{g.source.toLocaleLowerCase().includes('review pending') ? 'Meaning is waiting for clinician review.' : 'Meaning shown from the reviewed shared dictionary.'}</p></div>)}</div> : <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">New phrases will appear here as your family and care team notice them.</p>}
        </section>
        <section className="rounded-3xl border border-border bg-card p-6 soft-shadow md:p-8">
          <div className="mb-5 flex items-center gap-2"><Sparkles size={18} className="text-accent" /><h2 className="serif text-2xl font-semibold">This week's ideas</h2></div>
          <div className="space-y-3">{['Try joining your child’s interests.', 'Pause and wait for communication.', 'Repeat favorite phrases naturally.', 'Model new language during play.'].map((idea) => <div key={idea} className="flex items-start gap-3 rounded-2xl bg-accent/5 p-3"><span className="mt-0.5 grid size-5 place-items-center rounded-full bg-accent/20 text-primary">✓</span><p className="text-sm leading-6">{idea}</p></div>)}</div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">These are everyday invitations, not instructions. Follow your child's lead.</p>
        </section>
      </div>

      <section className="rounded-3xl border border-border bg-card p-6 soft-shadow md:p-8" data-testid="parent-dictionary">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Shared language</p><h2 className="serif mt-2 text-2xl font-semibold">My child's communication dictionary</h2><p className="mt-1 text-sm text-muted-foreground">Add what you notice without changing a clinician-approved meaning.</p></div><button onClick={onAddObservation} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs font-semibold text-primary"><Plus size={15} /> Log observation</button></div>
        <ParentPhraseSearch phrases={gestalts} onAddPhrase={onAddPhrase} onAddObservation={onAddObservation} onAskTeam={onAskTeam} />
        <div className="my-7 border-t border-border" />
        {gestalts.length ? <div className="grid gap-3 lg:grid-cols-2">{gestalts.map((g) => <article key={g.id} className="rounded-2xl border border-border bg-background p-4"><div className="flex items-start justify-between gap-3"><h3 className="serif text-lg font-semibold">“{g.phrase}”</h3><span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-primary">{g.occurrences ?? 0} seen</span></div><p className="mt-3 text-sm leading-6"><span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Possible meaning</span><br />{g.meaning}</p><p className="mt-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Context:</span> {g.contexts?.join(', ') || 'Not yet shared'}</p><div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3"><button onClick={() => onPhraseNote(g, 'meaning')} className="focus-ring rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-secondary/70">+ Add meaning</button><button onClick={() => onPhraseNote(g, 'context')} className="focus-ring rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-secondary/70">+ Add context</button></div></article>)}</div> : <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Your shared dictionary is ready for its first phrase.</p>}
      </section>

      <SharedChildProfile childId={child.id} />

      <section className="rounded-3xl border border-border bg-card p-6 soft-shadow md:p-8" data-testid="parent-language-journey-preview">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Communication growth</p><h2 className="serif mt-2 text-2xl font-semibold">Language journey</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{timeline.length ? `Over time, ${child.name} is beginning to share favorite phrases in new situations. New communication patterns have been noticed and added to the map.` : `Your child's communication story will grow here as the team notices new patterns over time.`}</p></div><Link href="/language-journey" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-card px-4 py-2.5 text-sm font-semibold text-primary">See the journey <Leaf size={16} /></Link></div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-6 soft-shadow md:p-8"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Shared with the team</p><h2 className="serif mt-2 text-2xl font-semibold">Recent observations</h2></div><button onClick={onAddObservation} className="focus-ring text-xs font-semibold text-primary">+ Log observation</button></div>{observations.length ? <div className="space-y-3">{observations.slice(0, 3).map((observation) => <div key={observation.id} className="rounded-2xl bg-secondary/25 p-4"><p className="text-sm leading-6">{observation.body}</p><p className="mt-1 text-[11px] text-muted-foreground">{observation.context} · {new Date(observation.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p></div>)}</div> : <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">A small note about a phrase, context, question, or moment can help the team connect the dots.</p>}</section>
    </div>
  );
}

/**
 * Teacher Portal
 * Role-safe: No raw clinical confidence, focused on classroom supports and frequent scripts.
 */
export function TeacherPortal({
  child,
  gestalts = [],
  observations = [],
  interests = [],
  onAddObservation,
  onAddPhrase,
  onAddInterest,
  onEditInterest,
  onAskClinician,
  onHelperLogObservation,
  onHelperAddPhrase,
  onHelperAskTeam,
  onHelperNotifyClinician,
  onSaveClassroomNote,
  onMarkHeard,
  markingPhraseHeard,
  heardTodayPhrase,
  teamMessages = [],
  onMessageTeam,
}: {
  child: PortalChild;
  gestalts?: PortalGestalt[];
  observations?: PortalObservation[];
  interests?: PortalInterest[];
  onAddObservation: () => void;
  onAddPhrase: () => void;
  onAddInterest: () => void;
  onEditInterest: (interest: PortalInterest) => void;
  onAskClinician: () => void;
  onHelperLogObservation: (phrase: string) => void;
  onHelperAddPhrase: (phrase: string) => void;
  onHelperAskTeam: (phrase: string) => void;
  onHelperNotifyClinician: (phrase: string) => void;
  onSaveClassroomNote: (phrase: string) => void;
  onMarkHeard: (phrase: string) => void;
  markingPhraseHeard?: boolean;
  heardTodayPhrase?: string;
  teamMessages?: InboxMessage[];
  onMessageTeam: () => void;
}) {
  const [phraseSearch, setPhraseSearch] = useState('');
  const [activeWorkspaceSection, setActiveWorkspaceSection] = useState('student-overview');
  const manualSectionSelectionUntil = useRef(0);
  const approvedInterests = interests.filter((interest) => interest.status === 'approved');
  const suggestions = interests.filter((interest) => interest.status === 'suggested');
  const unreviewedGestalts = gestalts.filter((gestalt) => !isTeacherReviewedPhrase(gestalt));
  const normalizedPhraseSearch = phraseSearch.trim().toLocaleLowerCase();
  const matchingGestalts = useMemo(
    () => normalizedPhraseSearch
      ? gestalts.filter((gestalt) =>
        [gestalt.phrase, gestalt.meaning, gestalt.function]
          .some((value) => value.toLocaleLowerCase().includes(normalizedPhraseSearch)))
      : gestalts,
    [gestalts, normalizedPhraseSearch],
  );
  const reviewedGestalts = matchingGestalts.filter(isTeacherReviewedPhrase);
  const lastUpdatedAt = [
    ...gestalts.map((gestalt) => gestalt.lastObservedAt ?? gestalt.dateAdded),
    ...observations.map((observation) => observation.createdAt),
    ...teamMessages.map((message) => message.createdAt),
    child.aacSnapshot?.lastConfirmedAt,
  ].filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
  useEffect(() => {
    setActiveWorkspaceSection('student-overview');
    const sections = teacherWorkspaceSections
      .map(([id]) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    if (!sections.length || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < manualSectionSelectionUntil.current) return;
        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
        if (visibleSection) setActiveWorkspaceSection(visibleSection.target.id);
      },
      { rootMargin: '-176px 0px -58% 0px', threshold: [0, 0.1, 0.5] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [child.id]);

  const navigateToWorkspaceSection = (id: string) => {
    const section = document.getElementById(id);
    if (!section) return;
    manualSectionSelectionUntil.current = Date.now() + 900;
    setActiveWorkspaceSection(id);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${id}`);
    section.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  return (
    <div className="space-y-8 animate-rise delay-1">
      <section id="student-overview" className="scroll-mt-28 overflow-hidden rounded-[2rem] border border-primary/20 bg-primary text-primary-foreground shadow-xl shadow-primary/10">
        <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <div className="mb-4 flex items-center gap-4">
              <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary-foreground/10 text-xl font-bold ring-1 ring-primary-foreground/20">{child.name.charAt(0)}</span>
              <div><p className="mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Student workspace</p><h1 className="serif mt-1 text-4xl font-semibold leading-tight md:text-5xl">{child.name}</h1><p className="mt-1 text-sm text-primary-foreground/70">{child.grade} • {child.school}</p></div>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-primary-foreground/75">Communication supports, shared understanding, and classroom context for {child.name}—all in one place.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {child.aacSnapshot?.isUser && <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground">AAC User</span>}
              {child.communicationStyle && <span className="rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold">{child.communicationStyle}</span>}
              {child.aacSnapshot?.device && <span className="rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold">{child.aacSnapshot.device}</span>}
              {child.aacSnapshot?.vocabularySystem && <span className="rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold">{child.aacSnapshot.vocabularySystem}</span>}
            </div>
            <p className="mt-4 text-xs text-primary-foreground/55">Last updated {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'recently'}</p>
          </div>
          <div className="flex flex-col justify-center gap-3">
          <button
            onClick={onAddPhrase}
            className="gold-action focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-primary transition-transform hover:-translate-y-0.5"
          >
            <Plus size={16} /> Log Phrase
          </button>
          <button
            onClick={onAddObservation}
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-3 text-sm font-semibold transition-all hover:bg-primary-foreground/15"
          >
            <Activity size={16} /> Add Shared Moment
          </button>
          <button
            onClick={onMessageTeam}
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-3 text-sm font-semibold transition-all hover:bg-primary-foreground/15"
          >
            <MessageCircle size={16} /> Message Team
          </button>
          </div>
        </div>
      </section>

      <div className="sticky top-20 z-10 -mx-2 rounded-2xl border border-primary/15 bg-background/95 p-2 shadow-[0_16px_36px_-28px_hsl(var(--brand-forest-950)/.75)] backdrop-blur-xl md:mx-0 md:p-3" data-testid="teacher-student-sticky-navigation">
        <div className="flex items-center gap-3 px-2 pb-2 md:px-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">{child.name.charAt(0)}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{child.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">{child.grade} • {child.school}</p>
          </div>
          <span className="mono ml-auto hidden text-[9px] font-bold uppercase tracking-[.16em] text-primary sm:block">Student profile</span>
        </div>
        <nav aria-label={`${child.name} workspace sections`} className="flex max-w-full gap-1.5 overflow-x-auto rounded-xl bg-secondary/55 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {teacherWorkspaceSections.map(([id, label]) => {
            const active = activeWorkspaceSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => navigateToWorkspaceSection(id)}
                aria-current={active ? 'location' : undefined}
                data-testid={`button-student-section-${id}`}
                className={`focus-ring shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${active ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-accent/70' : 'bg-background/45 text-primary hover:bg-background/80'}`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      <section id="phrase-dictionary" className="scroll-mt-52 rounded-3xl border border-border bg-card p-6 soft-shadow md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Phrase Dictionary</p><h2 className="serif mt-2 text-3xl font-semibold">What Does This Mean?</h2><p className="mt-2 text-sm text-muted-foreground">Search only {child.name}’s reviewed phrase dictionary.</p></div><button onClick={onAddPhrase} className="gold-action focus-ring inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-primary"><Plus size={15} /> Log New Phrase</button></div>
        <label className="relative mt-6 block"><span className="sr-only">Search {child.name}’s phrase dictionary</span><BookOpen size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="search" value={phraseSearch} onChange={(event) => setPhraseSearch(event.target.value)} placeholder="What does this phrase mean?" className="focus-ring h-13 w-full rounded-2xl border border-border bg-background py-3 pl-12 pr-4 text-sm" /></label>
        {reviewedGestalts.length > 0 ? (
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {reviewedGestalts.slice(0, phraseSearch ? 8 : 4).map((g) => (
              <article key={g.id} className="rounded-2xl border border-border bg-secondary/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="serif text-lg font-semibold">“{g.phrase}”</h3><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{g.function}</span></div>
                <p className="mt-3 text-sm leading-6">{g.meaning}</p>
                <p className="mt-2 text-xs text-muted-foreground">{g.contexts?.join(', ') || 'Shared care-team context'}</p>
              </article>
            ))}
          </div>
        ) : <p className="mt-6 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">{phraseSearch ? `No reviewed meaning found for “${phraseSearch}” in ${child.name}’s dictionary.` : 'No reviewed phrases have been shared yet.'}</p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section id="shared-moments" className="scroll-mt-52 rounded-3xl border border-border bg-card p-6 soft-shadow md:p-8"><div className="flex items-start justify-between gap-4"><div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Shared Moments</p><h2 className="serif mt-2 text-2xl font-semibold">Recent classroom observations</h2></div><button onClick={onAddObservation} className="focus-ring shrink-0 text-xs font-bold text-primary">+ Add Shared Moment</button></div>{observations.length ? <div className="mt-5 space-y-3">{observations.slice(0, 4).map((observation) => <article key={observation.id} className="rounded-2xl bg-secondary/25 p-4"><p className="text-sm leading-6">{observation.body}</p><p className="mt-2 text-xs text-muted-foreground">{observation.context} · {new Date(observation.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p></article>)}</div> : <p className="mt-5 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Successful interactions, spontaneous phrases, AAC breakthroughs, and supports that worked will appear here.</p>}</section>
        <section id="team-notes" className="scroll-mt-52 rounded-3xl border border-border bg-card p-6 soft-shadow md:p-8"><div className="flex items-start justify-between gap-4"><div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Team Notes</p><h2 className="serif mt-2 text-2xl font-semibold">Recent care-team communication</h2></div><button onClick={onMessageTeam} className="focus-ring shrink-0 text-xs font-bold text-primary">Message Team</button></div>{teamMessages.length ? <div className="mt-5 space-y-3">{teamMessages.slice(0, 4).map((message) => <article key={message.id} className="rounded-2xl bg-secondary/25 p-4"><p className="text-sm leading-6">{message.body}</p><p className="mt-2 text-xs text-muted-foreground">{message.senderName} · {message.senderRole} · {new Date(message.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p></article>)}</div> : <p className="mt-5 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Recent notes between teachers, clinicians, and family will appear here.</p>}</section>
      </div>

      <section id="aac-information" className="scroll-mt-52"><AacInformationCard childId={child.id} /></section>
      <section id="communication-profile" className="scroll-mt-52 space-y-6">
        <div className="rounded-3xl border border-border bg-card p-6 soft-shadow md:p-8"><div className="flex items-center gap-2"><Info size={17} className="text-primary" /><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Communication Profile</p></div><h2 className="serif mt-2 text-2xl font-semibold">How {child.name} communicates</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{child.communicationStyle || 'Communication preferences have not been added yet.'}</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-secondary/35 p-4"><p className="mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Reviewed phrases</p><p className="serif mt-2 text-3xl font-semibold">{gestalts.length - unreviewedGestalts.length}</p></div><div className="rounded-xl bg-secondary/35 p-4"><p className="mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Shared interests</p><p className="serif mt-2 text-3xl font-semibold">{approvedInterests.length}</p></div><div className="rounded-xl bg-secondary/35 p-4"><p className="mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Classroom moments</p><p className="serif mt-2 text-3xl font-semibold">{observations.length}</p></div></div></div>
        <SharedChildProfile childId={child.id} />
      </section>
      <section id="classroom-supports" className="scroll-mt-52 space-y-5">
        <div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Classroom Supports</p><h2 className="serif mt-2 text-3xl font-semibold">Support communication in the moment</h2><p className="mt-2 text-sm text-muted-foreground">Use reviewed language and shared context while keeping the care team connected.</p></div>
        <TeacherCommunicationHelper childId={child.id} childName={child.name} onLogObservation={onHelperLogObservation} onAddPhrase={onHelperAddPhrase} onAskTeam={onHelperAskTeam} onNotifyClinician={onHelperNotifyClinician} onSaveClassroomNote={onSaveClassroomNote} onMarkHeard={onMarkHeard} markingHeard={markingPhraseHeard} heardTodayPhrase={heardTodayPhrase} />
      </section>
    </div>
  );
}

/**
 * SLP Portal
 * Focus: Efficient clinical workflow, access to session recording, and clinical knowledge.
 */
export function SlpPortal({
  child,
  gestalts = [],
  observations = [],
  onRecordSession,
  onViewDictionary,
  onViewClinicalKnowledge,
  onManageChild,
}: {
  child: PortalChild;
  gestalts?: PortalGestalt[];
  observations?: PortalObservation[];
  onRecordSession: () => void;
  onViewDictionary: () => void;
  onViewClinicalKnowledge: () => void;
  onManageChild: () => void;
}) {
  return (
    <div className="space-y-6 animate-rise delay-1">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/10 bg-primary/5 p-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <UserRound size={20} />
          </div>
          <div>
            <h2 className="serif text-xl font-semibold text-foreground">
              {child.name}
            </h2>
            <p className="mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Clinical Workspace
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onManageChild}
            className="focus-ring inline-flex items-center justify-center rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-all hover:bg-secondary"
          >
            Edit Profile
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Quick Launch */}
        <button
          onClick={onRecordSession}
          className="focus-ring group relative overflow-hidden rounded-2xl border border-primary/20 bg-primary p-6 text-left text-primary-foreground soft-shadow transition-all hover:-translate-y-1 hover:shadow-lg"
        >
          <div className="absolute -right-4 -top-4 size-24 rounded-full bg-primary-foreground/10 transition-transform group-hover:scale-150" />
          <Mic size={24} className="mb-4 text-accent" />
          <h3 className="serif mb-1 text-xl font-semibold">Record Session</h3>
          <p className="text-sm text-primary-foreground/70">
            Capture audio and generate a SOAP note draft.
          </p>
        </button>

        <button
          onClick={onViewDictionary}
          className="focus-ring group relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-left soft-shadow transition-all hover:-translate-y-1 hover:border-accent/40"
        >
          <BookOpen
            size={24}
            className="mb-4 text-primary transition-colors group-hover:text-accent"
          />
          <h3 className="serif mb-1 text-xl font-semibold text-foreground">
            Dictionary
          </h3>
          <p className="text-sm text-muted-foreground">
            Review and manage the mapped language.
          </p>
        </button>

      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6 soft-shadow">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="serif text-lg font-semibold text-foreground">
              Recent Phrases
            </h3>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
              {gestalts.length} total
            </span>
          </div>
          {gestalts.length > 0 ? (
            <div className="space-y-3">
              {gestalts.slice(0, 3).map((g) => (
                <div
                  key={g.id}
                  className="flex items-start justify-between gap-4 border-b border-border/50 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      "{g.phrase}"
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {g.meaning}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold text-primary/70">
                    {g.function}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No phrases logged.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 soft-shadow">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="serif text-lg font-semibold text-foreground">
              Recent Observations
            </h3>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
              {observations.length} total
            </span>
          </div>
          {observations.length > 0 ? (
            <div className="space-y-3">
              {observations.slice(0, 3).map((obs) => (
                <div
                  key={obs.id}
                  className="border-b border-border/50 pb-3 last:border-0 last:pb-0"
                >
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {obs.author}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(obs.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-foreground/90">
                    {obs.body}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No observations logged.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
