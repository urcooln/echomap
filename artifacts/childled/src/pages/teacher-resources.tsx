import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, Bookmark, Check, ChevronLeft, Download, Loader2 } from 'lucide-react';
import {
  downloadTeacherResourceHandbook,
  getGetTeacherResourceCenterQueryKey,
  useGetTeacherResourceCenter,
  useUpdateTeacherResourceProgress,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';

export function TeacherResourcesPage({ childId }: { childId?: number }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [category, setCategory] = useState('All resources');
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const queryClient = useQueryClient();
  const queryKey = getGetTeacherResourceCenterQueryKey({ childId: childId! });
  const { data, isLoading, isError } = useGetTeacherResourceCenter(
    { childId: childId! },
    { query: { enabled: !!childId, queryKey } },
  );
  const update = useUpdateTeacherResourceProgress();
  const resource = data?.items.find((item) => item.resourceKey === selected);
  const visible = useMemo(() => data?.items.filter((item) => category === 'All resources' || item.category === category) ?? [], [data, category]);
  const save = (resourceKey: string, patch: { bookmarked?: boolean; completed?: boolean; markViewed?: boolean }) =>
    childId && update.mutate({ data: { childId, resourceKey, ...patch } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey }) });
  useEffect(() => { if (resource && !resource.lastViewedAt) save(resource.resourceKey, { markViewed: true }); }, [resource?.resourceKey]);
  if (!childId) return <Empty title="Choose a student" body="Select an assigned student to open classroom resources." />;
  if (isLoading) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (isError || !data) return <Empty title="Resources unavailable" body="Teacher Resources could not be loaded. Please try again." />;
  if (resource) return (
    <div className="mx-auto max-w-4xl space-y-6">
      <button onClick={() => setSelected(null)} className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ChevronLeft size={16} /> All teacher resources</button>
      <article className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-accent">{resource.category}</p><h1 className="serif mt-2 text-4xl font-semibold">{resource.title}</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">{resource.summary}</p></div>
          <button aria-label={resource.bookmarked ? 'Remove bookmark' : 'Bookmark resource'} onClick={() => save(resource.resourceKey, { bookmarked: !resource.bookmarked })} className="rounded-xl border border-border p-3 text-primary">{resource.bookmarked ? <Bookmark fill="currentColor" /> : <Bookmark />}</button>
        </div>
        <div className="mt-8 space-y-8">
          {resource.sections.map((section) => <section key={section.heading}><h2 className="serif text-2xl font-semibold">{section.heading}</h2>{section.body && <p className="mt-3 text-base leading-8 text-foreground/85">{section.body}</p>}{section.bullets?.length ? <ul className="mt-3 list-disc space-y-2 pl-6 leading-7 text-foreground/85">{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}</section>)}
        </div>
        <div className="mt-10 border-t border-border pt-6"><Button onClick={() => save(resource.resourceKey, { completed: !resource.completed })} variant={resource.completed ? 'outline' : 'default'}><Check size={16} /> {resource.completed ? 'Completed' : 'Mark complete'}</Button></div>
      </article>
      <p className="rounded-2xl bg-secondary/35 p-4 text-xs leading-5 text-muted-foreground">{data.disclaimer}</p>
    </div>
  );
  const download = async () => {
    if (!childId) return; setDownloading(true); setDownloadError('');
    try { const blob = await downloadTeacherResourceHandbook({ childId }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'ChildLed-Teacher-Resources.pdf'; a.click(); URL.revokeObjectURL(url); }
    catch { setDownloadError('The protected handbook could not be downloaded.'); } finally { setDownloading(false); }
  };
  return (
    <div className="space-y-7">
      <header className="rounded-3xl bg-primary p-7 text-primary-foreground sm:p-10"><p className="mono text-[10px] font-bold uppercase tracking-[.2em] text-accent">Teacher portal</p><h1 className="serif mt-3 text-4xl font-semibold">{data.title}</h1><p className="mt-3 max-w-2xl text-primary-foreground/75">{data.description}</p><div className="mt-6 flex flex-wrap items-center gap-3"><span className="rounded-full bg-primary-foreground/10 px-4 py-2 text-sm">{data.completionPercentage}% complete</span>{data.pdfAvailable && <Button onClick={download} disabled={downloading} variant="secondary"><Download size={16} /> {downloading ? 'Preparing…' : 'Download handbook'}</Button>}</div>{downloadError && <p className="mt-3 text-sm text-destructive">{downloadError}</p>}</header>
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Resource categories">{['All resources', ...data.categories].map((value) => <button key={value} onClick={() => setCategory(value)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${category === value ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground'}`}>{value}</button>)}</nav>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((item) => <button key={item.resourceKey} onClick={() => setSelected(item.resourceKey)} className="rounded-2xl border border-border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex justify-between gap-4"><BookOpen className="text-primary" size={21} />{item.completed ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Check size={14} /> Complete</span> : item.bookmarked ? <Bookmark size={16} fill="currentColor" className="text-accent" /> : null}</div><p className="mono mt-5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{item.category}</p><h2 className="serif mt-2 text-xl font-semibold">{item.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p><p className="mt-4 text-xs font-semibold text-primary">{item.readingMinutes} min read</p></button>)}</div>
      <p className="rounded-2xl bg-secondary/35 p-4 text-xs leading-5 text-muted-foreground">{data.disclaimer}</p>
    </div>
  );
}
function Empty({ title, body }: { title: string; body: string }) { return <section className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-8 text-center"><BookOpen className="mx-auto text-primary" /><h1 className="serif mt-4 text-3xl font-semibold">{title}</h1><p className="mt-2 text-muted-foreground">{body}</p></section>; }