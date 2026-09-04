import { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ClipboardList,
  FileText,
  Lock,
  Plus,
  Printer,
  ChevronRight,
  Search,
  Sparkles,
  Archive,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  useListClinicalDocumentation,
  useCreateClinicalDocumentation,
  useCreateAiSessionNote,
  useUpdateClinicalDocumentation,
  useApproveClinicalDocumentation,
  useGetSessionSoapNote,
  useListSessions,
  useRecordReportExport,
  useUpdateSessionSoapNote,
  useDeleteClinicalDocumentation,
  useRestoreClinicalDocumentation,
  useArchiveClinicalDocumentation,
  useRestoreArchivedClinicalDocumentation,
  getListClinicalDocumentationQueryKey,
  getGetSessionSoapNoteQueryKey,
} from '@workspace/api-client-react';
import type {
  Child,
  Session,
  ClinicalDocumentation,
  ClinicalDocumentationList,
  ClinicalDocumentationFormat,
  ClinicalDocumentationContent,
  SessionSoapNoteSummary,
  SoapNoteInput,
  ClinicalDocumentationStatus,
  GoalConnection,
} from '@workspace/api-client-react';
import { replaceClinicalDocumentationInList } from '@/lib/documentation-cache';
import { formatGoalConnectionsForExport } from '@/lib/goal-connection-export';

const formatLabels: Record<string, string> = {
  session_note: 'Session Note',
  soap_note: 'SOAP Note',
  progress_note: 'Progress Note',
  parent_summary: 'Parent Summary',
  teacher_summary: 'Teacher Summary',
};

const formatDate = (date?: string | null) => {
  if (!date) return 'Recently';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

function Button({
  children,
  variant = 'primary',
  className = '',
  disabled,
  onClick,
  'data-testid': testId,
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'quiet' | 'outline' | 'warm';
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  'data-testid'?: string;
}) {
  const styles = {
    primary:
      'bg-primary text-primary-foreground shadow-[0_10px_20px_-14px_hsl(var(--brand-forest-950)/.9)] hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md focus-ring',
    quiet:
      'bg-transparent text-muted-foreground hover:bg-secondary hover:text-primary focus-ring',
    outline:
      'border border-primary/20 bg-card text-primary shadow-sm hover:border-primary/45 hover:bg-secondary/70 focus-ring',
    warm: 'gold-action text-accent-foreground hover:-translate-y-0.5 hover:brightness-[1.03] hover:shadow-md focus-ring',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mono mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="serif text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: any;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="brand-card rounded-2xl border border-dashed border-border bg-card/75 px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
        <Icon size={22} />
      </div>
      <h3 className="serif text-xl font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        {body}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function LoadingBlocks() {
  return (
    <div className="space-y-4" aria-label="Loading content">
      <div className="skeleton h-28 rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="skeleton h-52 rounded-2xl" />
        <div className="skeleton h-52 rounded-2xl" />
      </div>
    </div>
  );
}

type SessionNoteItem = {
  key: string;
  kind: 'document' | 'soap';
  childId: number;
  childName: string;
  title: string;
  noteType: ClinicalDocumentationFormat;
  status: ClinicalDocumentationStatus;
  createdAt: string;
  updatedAt: string;
  document?: ClinicalDocumentation;
  soapNote?: SessionSoapNoteSummary;
};

export function DocumentationCenter({ childId }: { childId?: number; child?: Child }) {
  const queryClient = useQueryClient();
  const requestedSessionId = Number(new URLSearchParams(window.location.search).get('sessionId')) || undefined;
  const [activeKey, setActiveKey] = useState<string>();
  const [search, setSearch] = useState('');
  const [childFilter, setChildFilter] = useState(childId ? String(childId) : 'all');
  const [typeFilter, setTypeFilter] = useState<ClinicalDocumentationFormat | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'finalized' | 'archived'>('all');
  const [creatorChildId, setCreatorChildId] = useState(childId ?? 0);
  const docsQuery = useListClinicalDocumentation({ status: 'all' });
  const deleteNote = useDeleteClinicalDocumentation();
  const restoreDeletedNote = useRestoreClinicalDocumentation();
  const archiveNote = useArchiveClinicalDocumentation();
  const restoreArchivedNote = useRestoreArchivedClinicalDocumentation();
  const children = docsQuery.data?.children ?? [];
  const childNames = useMemo(() => new Map(children.map((entry) => [entry.id, entry.name])), [children]);
  useEffect(() => {
    if (!creatorChildId && children[0]) setCreatorChildId(children[0].id);
  }, [children, creatorChildId]);
  const sessionsQuery = useListSessions(
    { childId: creatorChildId || 1 },
    { query: { enabled: activeKey === 'new' && creatorChildId > 0, queryKey: ['sessions', creatorChildId || 1] } },
  );
  const notes = useMemo<SessionNoteItem[]>(() => {
    const documents = (docsQuery.data?.documents ?? []).map((document): SessionNoteItem => ({
      key: `document:${document.id}`,
      kind: 'document',
      childId: document.childId,
      childName: childNames.get(document.childId) ?? 'Child',
      title: document.title,
      noteType: document.format,
      status: document.status,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      document,
    }));
    const soapNotes = (docsQuery.data?.soapNotes ?? []).map((soapNote): SessionNoteItem => ({
      key: `soap:${soapNote.sessionId}`,
      kind: 'soap',
      childId: soapNote.childId,
      childName: childNames.get(soapNote.childId) ?? 'Child',
      title: soapNote.title,
      noteType: 'soap_note',
      status: soapNote.status,
      createdAt: soapNote.createdAt,
      updatedAt: soapNote.updatedAt,
      soapNote,
    }));
    return [...documents, ...soapNotes].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
  }, [childNames, docsQuery.data]);
  const filteredNotes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return notes.filter((note) => note.status !== 'recently_deleted' && (
      (childFilter === 'all' || note.childId === Number(childFilter))
      && (typeFilter === 'all' || note.noteType === typeFilter)
      && (statusFilter === 'all' || note.status === statusFilter)
      && (!needle || `${note.childName} ${note.title} ${formatLabels[note.noteType]} ${note.document?.approvedBy ?? ''} ${formatDate(note.createdAt)} ${formatDate(note.updatedAt)}`.toLowerCase().includes(needle))
    ));
  }, [childFilter, notes, search, statusFilter, typeFilter]);
  const recentlyDeleted = notes.filter((note) => note.status === 'recently_deleted');
  const lifecyclePending = deleteNote.isPending || restoreDeletedNote.isPending || archiveNote.isPending || restoreArchivedNote.isPending;
  const activeNote = notes.find((note) => note.key === activeKey);

  useEffect(() => {
    if (activeKey) return;
    const requestedDocument = requestedSessionId
      ? docsQuery.data?.documents.find((document) => document.sourceSessionId === requestedSessionId)
      : undefined;
    setActiveKey(requestedDocument ? `document:${requestedDocument.id}` : requestedSessionId ? 'new' : notes[0]?.key ?? 'new');
  }, [activeKey, docsQuery.data, notes, requestedSessionId]);

  const replaceDocument = (updated: ClinicalDocumentation) => {
    queryClient.setQueryData<ClinicalDocumentationList>(
      getListClinicalDocumentationQueryKey({ status: 'all' }),
      (current) => ({
        children: current?.children ?? [],
        soapNotes: current?.soapNotes ?? [],
        documents: current?.documents.map((document) => document.id === updated.id ? updated : document) ?? [updated],
      }),
    );
  };

  const transitionNote = async (
    note: SessionNoteItem,
    action: 'delete' | 'archive' | 'restore_deleted' | 'restore_archived',
  ) => {
    const protectedSourceCopy = note.kind === 'soap'
      ? 'The source session, transcript, reviewed utterances, dictionary evidence, recording, and session data remain unchanged.'
      : 'The recording, transcript, reviewed utterances, dictionary evidence, and source-session data remain unchanged.';
    if (action === 'delete' && !window.confirm(`Delete Draft?\n\nOnly this documentation draft will move to Recently Deleted for 30 days. ${protectedSourceCopy}`)) return;
    if (action === 'archive' && !window.confirm(`Archive Session Note?\n\nOnly this finalized documentation note will be archived. Clinical evidence, transcripts, recordings, and source-session information remain available.`)) return;
    if (action === 'restore_archived' && !window.confirm('Restore Archived Session Note?\n\nThe note will return as finalized without changing its content or source-session evidence.')) return;
    const data = {
      childId: note.childId,
      noteType: note.kind === 'document' ? 'document' as const : 'soap_note' as const,
      documentId: note.document?.id,
      sessionId: note.soapNote?.sessionId,
    };
    const mutation = action === 'delete'
      ? deleteNote
      : action === 'archive'
        ? archiveNote
        : action === 'restore_deleted'
          ? restoreDeletedNote
          : restoreArchivedNote;
    await mutation.mutateAsync({ data });
    setActiveKey(undefined);
    await docsQuery.refetch();
  };

  if (docsQuery.isLoading) return <LoadingBlocks />;

  return (
    <div className="min-w-0 max-w-full space-y-7 overflow-x-clip animate-rise">
      <SectionHeading
        eyebrow="Clinician Workspace"
        title="Documentation Center"
        description="Search, filter, draft, and review session documentation across your authorized caseload."
        action={<Button onClick={() => { if (childFilter !== 'all') setCreatorChildId(Number(childFilter)); setActiveKey('new'); }} disabled={!children.length} data-testid="button-new-document"><Plus size={16} /> New Note</Button>}
      />
      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 soft-shadow md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px_200px_180px]">
        <label className="relative">
          <span className="sr-only">Search session notes</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search child, date, session title, or clinician" className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary/60" />
        </label>
        <select value={childFilter} onChange={(event) => setChildFilter(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
          <option value="all">All children</option>
          {children.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as ClinicalDocumentationFormat | 'all')} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
          <option value="all">All note types</option>
          {Object.entries(formatLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
          <option value="all">All Notes</option><option value="draft">Drafts</option><option value="finalized">Finalized</option><option value="archived">Archived</option>
        </select>
      </div>

      <div className="grid min-w-0 max-w-full items-start gap-8 lg:grid-cols-[390px_1fr]">
        <aside className="rounded-2xl border border-border bg-card p-4 soft-shadow">
          <div className="mb-4">
            <div><h3 className="text-sm font-bold">All session notes</h3><p className="mt-1 text-xs text-muted-foreground">{filteredNotes.length} matching record{filteredNotes.length === 1 ? '' : 's'}</p></div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(['draft', 'finalized', 'archived'] as const).map((status) => <div key={status} className="rounded-xl bg-secondary px-2 py-2 text-center"><p className="text-[9px] font-bold uppercase text-muted-foreground">{status === 'draft' ? 'Drafts' : status === 'finalized' ? 'Finalized' : 'Archived'}</p><p className="font-serif text-xl">{notes.filter((note) => note.status === status).length}</p></div>)}
            </div>
          </div>
          {notes.length === 0 ? <EmptyState icon={FileText} title="No session notes yet" body="Create a note from a child's reviewed session evidence." /> : filteredNotes.length === 0 ? <EmptyState icon={Search} title="No matching notes" body="Try a different search term or filter." /> : (
            <ul className="space-y-2">
              {filteredNotes.map((note) => {
                const isActive = note.key === activeKey;
                return <li key={note.key} className={`rounded-xl border p-3 transition-colors ${isActive ? 'border-primary/30 bg-primary/5' : 'border-border'}`}><button type="button" onClick={() => setActiveKey(note.key)} className="w-full text-left focus-ring">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-primary">{note.childName}</p><p className="mt-1 truncate text-sm font-semibold">{note.title}</p><p className="mt-1 text-xs text-muted-foreground">{formatLabels[note.noteType]}</p></div><div className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${note.status === 'finalized' ? 'bg-emerald-100 text-emerald-800' : note.status === 'archived' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{note.status}</span><ChevronRight size={16} className="text-muted-foreground" /></div></div>
                  <div className="mt-3 flex justify-between border-t border-border/70 pt-2 text-[11px] text-muted-foreground"><span>Created {formatDate(note.createdAt)}</span><span>Edited {formatDate(note.updatedAt)}</span></div>
                </button><div className="mt-3 flex flex-wrap gap-2 border-t border-border/70 pt-3">
                  <Button variant="quiet" className="px-2 py-1.5 text-xs" onClick={() => setActiveKey(note.key)}>{note.status === 'draft' ? 'Edit' : 'View'}</Button>
                  {note.status === 'draft' && note.kind === 'document' ? <Button variant="quiet" className="px-2 py-1.5 text-xs" onClick={() => setActiveKey(note.key)}>Finalize</Button> : null}
                  {note.status === 'draft' ? <Button variant="quiet" className="px-2 py-1.5 text-xs text-destructive" disabled={lifecyclePending} onClick={() => void transitionNote(note, 'delete')}><Trash2 size={13} /> Delete Draft</Button> : null}
                  {note.status === 'finalized' ? <Button variant="quiet" className="px-2 py-1.5 text-xs" disabled={lifecyclePending} onClick={() => void transitionNote(note, 'archive')}><Archive size={13} /> Archive</Button> : null}
                  {note.status === 'archived' ? <Button variant="quiet" className="px-2 py-1.5 text-xs" disabled={lifecyclePending} onClick={() => void transitionNote(note, 'restore_archived')}><RotateCcw size={13} /> Restore</Button> : null}
                </div></li>;
              })}
            </ul>
          )}
          <section className="mt-6 border-t border-border pt-5">
            <h3 className="serif text-lg font-semibold">Archived Notes</h3>
            {notes.some((note) => note.status === 'archived') ? <p className="mt-1 text-xs text-muted-foreground">{notes.filter((note) => note.status === 'archived').length} archived note{notes.filter((note) => note.status === 'archived').length === 1 ? '' : 's'} available through the Archived filter.</p> : <p className="mt-1 text-sm text-muted-foreground">No archived notes found.</p>}
          </section>
          <section className="mt-5 border-t border-border pt-5">
            <h3 className="serif text-lg font-semibold">Recently Deleted</h3>
            {recentlyDeleted.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">No recently deleted drafts. Deleted drafts remain recoverable for 30 days.</p> : <ul className="mt-3 space-y-2">{recentlyDeleted.map((note) => <li key={note.key} className="rounded-xl border border-border bg-background p-3"><p className="text-xs font-bold text-primary">{note.childName}</p><p className="mt-1 text-sm font-semibold">{note.title}</p><p className="mt-1 text-xs text-muted-foreground">Deleted by {note.document?.deletedBy ?? note.soapNote?.deletedBy ?? 'Clinician'} on {formatDate(note.document?.deletedAt ?? note.soapNote?.deletedAt)} · Recoverable until {formatDate(note.document?.purgeAfter ?? note.soapNote?.purgeAfter)}</p><Button variant="outline" className="mt-3 px-3 py-2 text-xs" disabled={lifecyclePending} onClick={() => void transitionNote(note, 'restore_deleted')}><RotateCcw size={13} /> Restore Draft</Button></li>)}</ul>}
          </section>
        </aside>
        <main className="min-w-0 max-w-full">
          {activeKey === 'new' ? (
            <div className="space-y-4">
              <label className="block rounded-2xl border border-border bg-card p-5"><span className="text-sm font-bold">Child</span><select value={creatorChildId || ''} onChange={(event) => setCreatorChildId(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"><option value="" disabled>Select a child</option>{children.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
              {creatorChildId > 0 ? <DocumentCreator childId={creatorChildId} sessions={sessionsQuery.data ?? []} initialSessionId={requestedSessionId} onCreated={(newDoc) => { replaceDocument(newDoc); setActiveKey(`document:${newDoc.id}`); }} /> : null}
            </div>
          ) : activeNote?.document ? <DocumentEditor doc={activeNote.document} childId={activeNote.childId} childName={activeNote.childName} /> : activeNote?.soapNote ? <SoapNoteEditor summary={activeNote.soapNote} childName={activeNote.childName} onUpdated={() => void docsQuery.refetch()} /> : null}
        </main>
      </div>
    </div>
  );
}

function SoapNoteEditor({ summary, childName, onUpdated }: { summary: SessionSoapNoteSummary; childName: string; onUpdated: () => void }) {
  const queryClient = useQueryClient();
  const params = { childId: summary.childId, sessionId: summary.sessionId };
  const isEditable = summary.status === 'draft';
  const noteQuery = useGetSessionSoapNote(params, {
    query: { enabled: isEditable, queryKey: getGetSessionSoapNoteQueryKey(params) },
  });
  const updateNote = useUpdateSessionSoapNote();
  const [content, setContent] = useState<SoapNoteInput>();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (noteQuery.data) setContent(noteQuery.data.content);
  }, [noteQuery.data]);
  if (!isEditable) return <section className="rounded-2xl border border-border bg-card p-7 soft-shadow"><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-amber-800">SOAP Note · {summary.status.replace('_', ' ')}</p><h2 className="mt-2 font-serif text-3xl">{childName}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">This SOAP draft is read-only while it is outside the active Drafts list. Restore it before viewing or changing its clinical content. Its source session and evidence remain unchanged.</p></section>;
  if (noteQuery.isLoading || !content) return <LoadingBlocks />;
  const fields: Array<{ key: keyof SoapNoteInput; label: string }> = [
    { key: 'subjective', label: 'Subjective' },
    { key: 'objective', label: 'Objective' },
    { key: 'assessment', label: 'Assessment' },
    { key: 'nlaObservations', label: 'NLA observations' },
    { key: 'gestaltTracking', label: 'Gestalt tracking' },
    { key: 'plan', label: 'Plan' },
    { key: 'caregiverSummary', label: 'Caregiver summary' },
  ];
  const save = async () => {
    const updated = await updateNote.mutateAsync({ params, data: content });
    setContent(updated.content);
    queryClient.setQueryData(getGetSessionSoapNoteQueryKey(params), updated);
    setSaved(true);
    onUpdated();
    window.setTimeout(() => setSaved(false), 1800);
  };
  return (
    <section className="rounded-2xl border border-border bg-card soft-shadow">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-6">
        <div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">SOAP Note · Draft</p><h2 className="mt-2 font-serif text-3xl">{childName}</h2><p className="mt-2 text-xs text-muted-foreground">Session {formatDate(noteQuery.data?.sessionDate ?? summary.createdAt)} · Last edited {formatDate(summary.updatedAt)}</p></div>
        <Button onClick={() => void save()} disabled={updateNote.isPending}>{saved ? <Check size={16} /> : null}{updateNote.isPending ? 'Saving…' : saved ? 'Saved' : 'Save SOAP note'}</Button>
      </div>
      <div className="space-y-5 p-6">
        {fields.map((field) => <label key={field.key} className="block"><span className="text-sm font-bold">{field.label}</span><textarea value={content[field.key]} onChange={(event) => setContent((current) => current ? { ...current, [field.key]: event.target.value } : current)} rows={field.key === 'objective' || field.key === 'assessment' ? 5 : 3} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm leading-6 outline-none focus:border-primary/60" /></label>)}
      </div>
    </section>
  );
}

function DocumentCreator({
  childId,
  sessions,
  initialSessionId,
  onCreated,
}: {
  childId: number;
  sessions: Session[];
  initialSessionId?: number;
  onCreated: (doc: ClinicalDocumentation) => void;
}) {
  const queryClient = useQueryClient();
  const createDoc = useCreateClinicalDocumentation();
  const createAiDoc = useCreateAiSessionNote();

  const [format, setFormat] = useState<ClinicalDocumentationFormat>('session_note');
  const [sourceSessionId, setSourceSessionId] = useState<number | ''>(initialSessionId ?? '');
  const [inputObservations, setInputObservations] = useState('');
  const [inputSummary, setInputSummary] = useState('');
  const [inputQuickNote, setInputQuickNote] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setError('');
    try {
      const newDoc = await createDoc.mutateAsync({
        data: {
          childId,
          format,
          sourceSessionId: sourceSessionId ? Number(sourceSessionId) : undefined,
          inputObservations: inputObservations.trim() || undefined,
          inputSummary: inputSummary.trim() || undefined,
          inputQuickNote: inputQuickNote.trim() || undefined,
        },
      });
      queryClient.setQueryData<ClinicalDocumentationList>(
        getListClinicalDocumentationQueryKey({ status: 'all' }),
        (old) => ({
          children: old?.children ?? [],
          soapNotes: old?.soapNotes ?? [],
          documents: [newDoc, ...(old?.documents ?? []).filter((doc) => doc.id !== newDoc.id)],
        }),
      );
      onCreated(newDoc);
    } catch (e) {
      setError('Could not create draft. Please try again.');
    }
  };

  const handleAiCreate = async () => {
    if (!sourceSessionId) return;
    setError('');
    try {
      const newDoc = await createAiDoc.mutateAsync({
        data: { childId, sessionId: Number(sourceSessionId) },
      });
      queryClient.setQueryData<ClinicalDocumentationList>(
        getListClinicalDocumentationQueryKey({ status: 'all' }),
        (old) => ({
          children: old?.children ?? [],
          soapNotes: old?.soapNotes ?? [],
          documents: [newDoc, ...(old?.documents ?? []).filter((doc) => doc.id !== newDoc.id)],
        }),
      );
      onCreated(newDoc);
    } catch (e: any) {
      setError(
        e?.data?.error
          ?? e?.message
          ?? 'Could not create the AI-assisted draft. Your reviewed evidence was not changed.',
      );
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8 animate-rise">
      <h2 className="serif text-2xl font-semibold text-primary">
        Start a new draft
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Select a format, attach a reviewed session when helpful, and keep every generated section clinician-owned.
      </p>

      {error && (
        <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="mono text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">
              Format
            </span>
            <select
              value={format}
              onChange={(e) =>
                setFormat(e.target.value as ClinicalDocumentationFormat)
              }
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold outline-none focus-ring"
              data-testid="select-doc-format"
            >
              {Object.entries(formatLabels).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="mono text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">
              Reviewed Session (Optional)
            </span>
            <select
              value={sourceSessionId}
              onChange={(e) => setSourceSessionId(e.target.value ? Number(e.target.value) : '')}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold outline-none focus-ring"
              data-testid="select-doc-session"
            >
              <option value="">No session attached</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {formatDate(session.createdAt)} · {session.gestalts?.length ?? 0}{' '}
                  phrase
                  {session.gestalts?.length === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </label>
        </div>

        {sourceSessionId && format === 'session_note' && (
          <div className="rounded-2xl border border-primary/20 bg-secondary/45 p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 shrink-0 text-primary" size={19} />
              <div>
                <p className="text-sm font-semibold text-primary">Evidence-grounded session summary</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  EchoMap uses only meaning-backed utterances explicitly confirmed as Child, plus
                  eligible prior reviewed sessions and active reviewed dictionary history. Every
                  interpretation stays editable, traceable, and clinician-owned.
                </p>
                <Button
                  className="mt-4"
                  onClick={handleAiCreate}
                  disabled={createAiDoc.isPending}
                  data-testid="button-create-ai-session-note"
                >
                  <Sparkles size={16} />
                  {createAiDoc.isPending ? 'Building evidence summary…' : 'Generate evidence-grounded summary'}
                </Button>
              </div>
            </div>
          </div>
        )}

        <label className="block space-y-2">
          <span className="mono text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">
            Short Observations
          </span>
          <textarea
            value={inputObservations}
            onChange={(e) => setInputObservations(e.target.value)}
            rows={3}
            className="w-full resize-y rounded-xl border border-input bg-background p-4 text-sm leading-6 outline-none transition-shadow focus-ring"
            placeholder="What did you observe?"
            data-testid="textarea-doc-observations"
          />
        </label>

        <label className="block space-y-2">
          <span className="mono text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">
            Pasted Summary
          </span>
          <textarea
            value={inputSummary}
            onChange={(e) => setInputSummary(e.target.value)}
            rows={3}
            className="w-full resize-y rounded-xl border border-input bg-background p-4 text-sm leading-6 outline-none transition-shadow focus-ring"
            placeholder="Paste raw summary notes here..."
            data-testid="textarea-doc-summary"
          />
        </label>

        <label className="block space-y-2">
          <span className="mono text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">
            Quick Post-Session Note
          </span>
          <textarea
            value={inputQuickNote}
            onChange={(e) => setInputQuickNote(e.target.value)}
            rows={3}
            className="w-full resize-y rounded-xl border border-input bg-background p-4 text-sm leading-6 outline-none transition-shadow focus-ring"
            placeholder="Any quick final thoughts?"
            data-testid="textarea-doc-quick-note"
          />
        </label>

        <div className="flex justify-end border-t border-border pt-6">
          <Button
            variant="outline"
            onClick={handleCreate}
            disabled={createDoc.isPending || createAiDoc.isPending}
            data-testid="button-create-draft"
          >
            {createDoc.isPending ? 'Generating...' : 'Create standard draft'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DocumentEditor({
  doc,
  childId,
  childName,
}: {
  doc: ClinicalDocumentation;
  childId: number;
  childName: string;
}) {
  type EditableContentKey = Exclude<keyof ClinicalDocumentationContent, 'evidenceReferences' | 'goalConnections'>;
  const queryClient = useQueryClient();
  const updateDoc = useUpdateClinicalDocumentation();
  const approveDoc = useApproveClinicalDocumentation();
  const recordExport = useRecordReportExport();
  const isFinalized = doc.status === 'finalized' || doc.status === 'archived';
  const isEditable = doc.status === 'draft';
  const initializedForId = useRef<number | null>(null);

  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState<ClinicalDocumentationContent>(doc.content);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initializedForId.current !== doc.id) {
      setTitle(doc.title);
      setContent(doc.content);
      setNotice('');
      setError('');
      initializedForId.current = doc.id;
    }
  }, [doc]);

  const changeSection = (key: EditableContentKey, value: string) => {
    setContent((curr) => ({ ...curr, [key]: value }));
  };
  const goalConnectionSelections = () => (content.goalConnections ?? []).map((connection) => ({
    goalId: connection.goalId,
    sourceKind: connection.sourceKind,
    sourceId: connection.sourceId,
    included: connection.included,
  }));
  const setGoalConnectionIncluded = (connection: GoalConnection, included: boolean) => {
    setContent((current) => ({
      ...current,
      goalConnections: (current.goalConnections ?? []).map((item) =>
        item.goalId === connection.goalId && item.sourceKind === connection.sourceKind && item.sourceId === connection.sourceId
          ? { ...item, included }
          : item,
      ),
    }));
  };

  const handleSave = async () => {
    setNotice('');
    setError('');
    try {
      const updated = await updateDoc.mutateAsync({
        data: {
          documentId: doc.id,
          childId,
          title: title.trim() || 'Untitled Document',
          content,
          goalConnectionSelections: goalConnectionSelections(),
        },
      });
      queryClient.setQueryData<ClinicalDocumentationList>(
        getListClinicalDocumentationQueryKey({ status: 'all' }),
        (old) => replaceClinicalDocumentationInList(old, updated),
      );
      setNotice('Draft saved successfully.');
    } catch {
      setError('Could not save draft.');
    }
  };

  const handleFinalize = async () => {
    setNotice('');
    setError('');
    try {
      // Must save first before finalize, to ensure latest content is what gets finalized
      await updateDoc.mutateAsync({
        data: {
          documentId: doc.id,
          childId,
          title: title.trim() || 'Untitled Document',
          content,
          goalConnectionSelections: goalConnectionSelections(),
        },
      });

      const finalized = await approveDoc.mutateAsync({
        data: { documentId: doc.id, childId },
      });
      
      queryClient.setQueryData<ClinicalDocumentationList>(
        getListClinicalDocumentationQueryKey({ status: 'all' }),
        (old) => replaceClinicalDocumentationInList(old, finalized),
      );
      setNotice('Document finalized.');
    } catch {
      setError('Could not finalize document.');
    }
  };

  const noteText = () => {
    return `${title.toUpperCase()}
Child: ${childName}
Date: ${formatDate(doc.createdAt)}
Status: ${doc.status === 'draft' ? 'DRAFT' : 'FINALIZED'}

SESSION SUMMARY
${content.sessionSummary}

OBSERVED LANGUAGE
${content.observedLanguage}

COMMUNICATION FUNCTIONS OBSERVED
${content.communicationFunctionsObserved}

NOTABLE LANGUAGE CHANGES
${content.notableLanguageChanges}

NLA / GESTALT INSIGHTS
${content.nlaGestaltInsights}

SESSION PARTICIPATION
${content.sessionParticipation}

AAC PLANNING OPPORTUNITIES
${content.aacPlanningOpportunities}

SUGGESTED DICTIONARY CANDIDATES
${content.suggestedDictionaryCandidates}

SUGGESTED FOLLOW-UP TARGETS
${content.suggestedFollowUpTargets}

COMMUNICATION GROWTH SNAPSHOT
${content.communicationGrowthSnapshot}

FAMILY & TEAM HIGHLIGHTS
${content.familyTeamHighlights}

CLINICIAN NOTES
${content.clinicianNotes}

EVIDENCE SOURCES
${content.evidenceReferences.map((reference) => `${reference.label}: ${reference.detail}`).join('\n')}

GOAL CONNECTIONS
${formatGoalConnectionsForExport(content.goalConnections ?? [])}

AI-generated draft for clinician review only. EchoMap does not provide diagnoses, clinical decisions, or treatment recommendations. Clinical interpretation and approval remain the responsibility of the licensed professional.
`;
  };

  const downloadText = (txt: string, filename: string) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const auditThen = async (action: () => Promise<void> | void) => {
    setError('');
    setNotice('');
    try {
      await recordExport.mutateAsync({
        data: { childId, documentId: doc.id, format: doc.format },
      });
      await action();
    } catch {
      setError('We could not record this export. Please try again.');
    }
  };

  const fields: Array<{
    key: EditableContentKey;
    title: string;
    rows: number;
  }> = [
    { key: 'sessionSummary', title: 'Session Summary', rows: 5 },
    { key: 'observedLanguage', title: 'Observed Language', rows: 7 },
    { key: 'communicationFunctionsObserved', title: 'Communication Functions Observed', rows: 6 },
    { key: 'notableLanguageChanges', title: 'Notable Language Changes', rows: 8 },
    { key: 'nlaGestaltInsights', title: 'NLA / Gestalt Insights', rows: 8 },
    { key: 'sessionParticipation', title: 'Session Participation', rows: 5 },
    { key: 'aacPlanningOpportunities', title: 'AAC Planning Opportunities', rows: 6 },
    { key: 'suggestedDictionaryCandidates', title: 'Suggested Dictionary Candidates', rows: 7 },
    { key: 'suggestedFollowUpTargets', title: 'Suggested Follow-Up Targets', rows: 7 },
    { key: 'communicationGrowthSnapshot', title: 'Communication Growth Snapshot', rows: 7 },
    { key: 'familyTeamHighlights', title: 'Family & Team Highlights', rows: 8 },
    { key: 'clinicianNotes', title: 'Clinician notes', rows: 7 },
  ];
  const interpretationFields = new Set<EditableContentKey>([
    'nlaGestaltInsights',
    'aacPlanningOpportunities',
    'suggestedDictionaryCandidates',
    'suggestedFollowUpTargets',
    'communicationGrowthSnapshot',
    'familyTeamHighlights',
  ]);

  return (
    <article className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-9 print:border-none print:p-0 print:shadow-none animate-rise">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-5 border-b border-border pb-6">
        <div className="flex-1">
          <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
            {formatLabels[doc.format]} · {isFinalized ? 'Finalized' : 'Draft'}
          </p>
          {isFinalized ? (
            <h2 className="serif mt-2 text-3xl font-semibold text-primary">
              {title}
            </h2>
          ) : (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="serif mt-2 w-full max-w-xl rounded-xl border-none bg-transparent px-0 text-3xl font-semibold text-primary outline-none focus:ring-0"
              placeholder="Document Title"
              data-testid="input-doc-title"
            />
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Created on {formatDate(doc.createdAt)}
            {doc.sourceSessionId ? ` · Attached to session` : ''}
          </p>
        </div>

        <div className="flex flex-col items-end gap-3 print:hidden">
          <div className="flex items-center gap-2">
            {isEditable && (
              <Button
                variant="warm"
                onClick={handleSave}
                disabled={updateDoc.isPending || approveDoc.isPending}
                data-testid="button-save-doc"
              >
                {updateDoc.isPending ? 'Saving...' : 'Save Draft'}
              </Button>
            )}
            {isEditable && (
              <Button
                variant="primary"
                onClick={handleFinalize}
                disabled={updateDoc.isPending || approveDoc.isPending}
                data-testid="button-finalize-doc"
              >
                <Lock size={16} /> Finalize
              </Button>
            )}
          </div>
          {isFinalized ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  auditThen(async () => {
                    await navigator.clipboard.writeText(noteText());
                    setNotice('Document copied to clipboard.');
                  })
                }
                data-testid="button-copy-doc"
              >
                <ClipboardList size={16} /> Copy
              </Button>
              <Button
                variant="outline"
                onClick={() => auditThen(() => window.print())}
                data-testid="button-print-doc"
              >
                <Printer size={16} /> Print
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  auditThen(() =>
                    downloadText(noteText(), `echomap-doc-${doc.id}.txt`)
                  )
                }
                data-testid="button-export-doc"
              >
                <FileText size={16} /> Export txt
              </Button>
            </div>
          ) : (
            <p className="max-w-xs text-right text-xs leading-5 text-muted-foreground">
              Finalize this clinician-reviewed document before copying, printing, or exporting it.
            </p>
          )}
        </div>
      </header>

      {notice && (
        <div className="mb-6 rounded-xl border border-primary/20 bg-secondary/45 px-4 py-3 text-sm font-semibold text-primary">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {fields.map((field) => (
          <section
            key={field.key}
            className={`rounded-2xl border ${
              !isEditable ? 'border-border/50 bg-transparent' : 'border-border bg-background/55'
            } p-5`}
          >
            <h3 className="serif text-xl font-semibold text-primary mb-3">
              {field.title}
            </h3>
            {interpretationFields.has(field.key) && (
              <p className="mb-3 text-xs font-bold uppercase tracking-[.12em] text-accent-foreground">
                AI-generated clinical observation · Clinician review required
              </p>
            )}
            {!isEditable ? (
              <div className="whitespace-pre-wrap text-sm leading-7 text-foreground/80">
                {content[field.key]}
              </div>
            ) : (
              <textarea
                data-testid={`textarea-doc-${field.key}`}
                value={content[field.key]}
                onChange={(e) => changeSection(field.key, e.target.value)}
                rows={field.rows}
                className="w-full resize-y rounded-xl border border-input bg-card p-4 text-sm leading-6 outline-none transition-shadow focus-ring"
              />
            )}
          </section>
        ))}
        {(content.goalConnections?.length || isEditable) ? (
          <section data-testid="section-goal-connections" className="rounded-2xl border border-primary/20 bg-secondary/25 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="serif text-xl font-semibold text-primary">Goal Connections</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  <strong className="text-primary">Clinician Review Required.</strong> These informational-only connections link existing goal and source records; they do not measure progress or create a clinical conclusion.
                </p>
              </div>
              <span className="rounded-full bg-accent/20 px-2.5 py-1 text-[10px] font-bold uppercase text-primary">Informational only</span>
            </div>
            {content.goalConnections?.length ? <div className="mt-5 space-y-3">
              {content.goalConnections.map((connection) => (
                <article key={`${connection.goalId}-${connection.sourceKind}-${connection.sourceId}`} data-testid={`goal-connection-${connection.goalId}-${connection.sourceKind}-${connection.sourceId}`} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-primary">{connection.goalTitle}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground">{connection.sourceLabel} · {connection.sourceKind.replaceAll('_', ' ')} · {connection.evidenceClass.replaceAll('_', ' ')}</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/80">{connection.sourceDetail}</p>
                    </div>
                    {isEditable ? <label className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-primary/20 px-3 py-2 text-xs font-bold text-primary">
                      <input type="checkbox" checked={connection.included} onChange={(event) => setGoalConnectionIncluded(connection, event.target.checked)} data-testid={`checkbox-goal-connection-${connection.goalId}-${connection.sourceKind}-${connection.sourceId}`} className="size-4 accent-primary" />
                      Include
                    </label> : <span data-testid={`status-goal-connection-${connection.goalId}-${connection.sourceKind}-${connection.sourceId}`} className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase text-primary">Included</span>}
                  </div>
                </article>
              ))}
            </div> : <p className="mt-4 text-sm text-muted-foreground">No goal connections were found for this draft.</p>}
          </section>
        ) : null}
        <details className="rounded-2xl border border-primary/20 bg-secondary/25 p-5" data-testid="session-summary-evidence">
          <summary className="cursor-pointer font-semibold text-primary focus-ring">
            Reviewed evidence sources ({content.evidenceReferences.length})
          </summary>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            These sources are review references only. They do not include raw transcript text,
            Not Child, Unsure, Unintelligible, provisional, or pending phrase content.
          </p>
          <div className="mt-4 space-y-3">
            {content.evidenceReferences.length ? content.evidenceReferences.map((reference) => (
              <div key={reference.id} className="rounded-xl border border-border bg-card p-3">
                <p className="text-sm font-semibold">{reference.label}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{reference.detail}</p>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">No structured source references were stored for this earlier draft.</p>
            )}
          </div>
        </details>
      </div>

      <footer className="mt-8 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
        AI-generated content is a draft for clinician review only. Clinician Review Required.
        EchoMap does not assign an NLA stage or provide diagnoses, clinical decisions, or
        treatment recommendations. Saving a draft does not update the dictionary, insights,
        reports, or the finalized medical record.
      </footer>
    </article>
  );
}
