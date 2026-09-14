import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Bookmark,
  Check,
  ChevronLeft,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircleMore,
  TabletSmartphone,
} from "lucide-react";
import { Link } from "wouter";
import {
  downloadTeacherResourceHandbook,
  getGetCommunicationPassportQueryKey,
  getGetTeacherResourceCenterQueryKey,
  useGetCommunicationPassport,
  useGetTeacherResourceCenter,
  useUpdateTeacherResourceProgress,
  type Child,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

type TeacherResourcesPageProps = {
  childId?: number;
  children: Child[];
  childrenLoading?: boolean;
  onSelectChild: (childId: number) => void;
};

const firstValues = (values: string[] | undefined, limit = 3) =>
  (values ?? []).filter((value) => value.trim()).slice(0, limit);

function SnapshotItem({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MessageCircleMore;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 border-t border-border py-4 first:border-t-0 md:border-l md:border-t-0 md:px-5 md:first:border-l-0 md:first:pl-0">
      <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
        <Icon size={16} className="text-primary" />
        {label}
      </div>
      <div className="mt-2 text-sm leading-6 text-foreground">{children}</div>
    </div>
  );
}

export function TeacherResourcesPage({
  childId,
  children,
  childrenLoading = false,
  onSelectChild,
}: TeacherResourcesPageProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [category, setCategory] = useState("All resources");
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const queryClient = useQueryClient();
  const selectedChild =
    children.find((child) => child.id === childId) ?? children[0];
  const selectedChildId = selectedChild?.id;
  const resourceParams = { childId: selectedChildId ?? 0 };
  const resourceQueryKey = getGetTeacherResourceCenterQueryKey(resourceParams);
  const { data, isLoading, isError, refetch } = useGetTeacherResourceCenter(
    resourceParams,
    {
      query: {
        enabled: Boolean(selectedChildId),
        queryKey: resourceQueryKey,
      },
    },
  );
  const passportQuery = useGetCommunicationPassport(resourceParams, {
    query: {
      enabled: Boolean(selectedChildId),
      queryKey: getGetCommunicationPassportQueryKey(resourceParams),
    },
  });
  const update = useUpdateTeacherResourceProgress();
  const resource = data?.items.find((item) => item.resourceKey === selected);
  const visible = useMemo(
    () =>
      data?.items.filter(
        (item) => category === "All resources" || item.category === category,
      ) ?? [],
    [category, data?.items],
  );
  const preferredStudentName =
    selectedChild?.preferredName ||
    selectedChild?.firstName ||
    selectedChild?.name;
  const passport = passportQuery.data;
  const sharedGoals = firstValues(passport?.content?.currentGoals);
  const supportStrategies = firstValues(
    passport?.content?.helpfulStrategies.length
      ? passport.content.helpfulStrategies
      : selectedChild?.sensorySupports?.length
        ? selectedChild.sensorySupports
        : selectedChild?.sensoryPreferences,
  );

  useEffect(() => {
    setSelected(null);
    setDownloadError("");
  }, [selectedChildId]);

  const save = (
    resourceKey: string,
    patch: { bookmarked?: boolean; completed?: boolean; markViewed?: boolean },
  ) => {
    if (!selectedChildId) return;
    update.mutate(
      { data: { childId: selectedChildId, resourceKey, ...patch } },
      {
        onSuccess: () =>
          queryClient.invalidateQueries({ queryKey: resourceQueryKey }),
      },
    );
  };

  useEffect(() => {
    if (resource && !resource.lastViewedAt) {
      save(resource.resourceKey, { markViewed: true });
    }
  }, [resource?.lastViewedAt, resource?.resourceKey]);

  const download = async () => {
    if (!selectedChildId) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const blob = await downloadTeacherResourceHandbook({
        childId: selectedChildId,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "ChildLed-Teacher-Resources.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError(
        "The protected Teacher handbook could not be downloaded. Try again.",
      );
    } finally {
      setDownloading(false);
    }
  };

  if (childrenLoading && !selectedChild) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }
  if (!selectedChild) {
    return (
      <Empty
        title="No assigned students"
        body="Teacher Resources will become available when a student is assigned to your account."
      />
    );
  }
  if (isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Empty
        title="Resources unavailable"
        body="Teacher Resources could not be loaded. Please try again."
        action={<Button onClick={() => void refetch()}>Try again</Button>}
      />
    );
  }
  if (resource) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <button
          onClick={() => setSelected(null)}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ChevronLeft size={16} /> All teacher resources
        </button>
        <article className="rounded-md border border-border bg-card p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mono text-[10px] font-bold uppercase text-accent">
                {resource.category}
              </p>
              <h1 className="serif mt-2 text-3xl font-semibold sm:text-4xl">
                {resource.title}
              </h1>
              <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
                {resource.summary}
              </p>
            </div>
            <button
              aria-label={
                resource.bookmarked ? "Remove bookmark" : "Bookmark resource"
              }
              onClick={() =>
                save(resource.resourceKey, {
                  bookmarked: !resource.bookmarked,
                })
              }
              className="grid h-11 w-11 place-items-center rounded-md border border-border text-primary"
            >
              {resource.bookmarked ? (
                <Bookmark fill="currentColor" />
              ) : (
                <Bookmark />
              )}
            </button>
          </div>
          <div className="mt-8 space-y-8">
            {resource.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="serif text-2xl font-semibold">
                  {section.heading}
                </h2>
                {section.body && (
                  <p className="mt-3 text-base leading-8 text-foreground/85">
                    {section.body}
                  </p>
                )}
                {section.bullets?.length ? (
                  <ul className="mt-3 list-disc space-y-2 pl-6 leading-7 text-foreground/85">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
          <div className="mt-10 border-t border-border pt-6">
            <Button
              onClick={() =>
                save(resource.resourceKey, { completed: !resource.completed })
              }
              variant={resource.completed ? "outline" : "default"}
            >
              <Check size={16} />
              {resource.completed ? "Completed" : "Mark complete"}
            </Button>
          </div>
        </article>
        <p className="rounded-md bg-secondary/35 p-4 text-xs leading-5 text-muted-foreground">
          {data.disclaimer}
        </p>
      </div>
    );
  }

  const viewUrl = `/api/teacher-resource-center/download?childId=${selectedChildId}&disposition=inline`;

  return (
    <div className="min-w-0 space-y-7" data-testid="page-teacher-resources">
      <header className="border-b border-border pb-6">
        <p className="mono text-[10px] font-bold uppercase text-accent">
          Teacher portal
        </p>
        <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="serif text-4xl font-semibold">Teacher Resources</h1>
            <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
              Practical tools and guidance to support your student's
              communication throughout the school day.
            </p>
          </div>
          {children.length > 1 ? (
            <label className="w-full shrink-0 text-sm font-semibold lg:w-72">
              Supporting student
              <select
                value={selectedChildId}
                onChange={(event) => onSelectChild(Number(event.target.value))}
                className="mt-2 min-h-12 w-full rounded-md border border-border bg-card px-3 text-base text-foreground"
              >
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <p className="mt-5 text-sm font-semibold text-primary">
          Resources for supporting {preferredStudentName}
        </p>
      </header>

      <section className="rounded-md border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-accent/20 text-primary">
              <FileText size={24} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-muted-foreground">
                Featured handbook
              </p>
              <h2 className="serif mt-1 text-2xl font-semibold">
                Classroom Companion &amp; Educator Reference Guide
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Practical classroom guidance for supporting communication,
                language development, regulation, and participation.
              </p>
            </div>
          </div>
          {data.pdfAvailable ? (
            <div className="grid shrink-0 gap-2 sm:grid-cols-2 md:flex">
              <Button asChild variant="outline" className="w-full md:w-auto">
                <a href={viewUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} /> View PDF
                </a>
              </Button>
              <Button
                onClick={download}
                disabled={downloading}
                className="w-full md:w-auto"
              >
                {downloading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                {downloading ? "Preparing..." : "Download handbook"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Handbook temporarily unavailable
            </p>
          )}
        </div>
        {downloadError && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {downloadError}
          </p>
        )}
      </section>

      <section className="border-y border-border py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground">
              Student Communication Snapshot
            </p>
            <h2 className="serif mt-1 text-2xl font-semibold">
              Supporting {preferredStudentName}
            </h2>
          </div>
          {passport?.exists ? (
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href={`/communication-passport?childId=${selectedChildId}`}>
                <FileText size={16} /> View Communication Passport
              </Link>
            </Button>
          ) : null}
        </div>
        <div className="mt-5 grid md:grid-cols-3">
          <SnapshotItem icon={MessageCircleMore} label="Communication approach">
            {selectedChild.communicationStyle || "Not yet shared"}
          </SnapshotItem>
          <SnapshotItem icon={TabletSmartphone} label="AAC support">
            {selectedChild.aacSnapshot?.isUser
              ? [
                  selectedChild.aacSnapshot.vocabularySystem,
                  selectedChild.aacSnapshot.device,
                  selectedChild.aacSnapshot.accessMethod,
                ]
                  .filter(Boolean)
                  .join(" · ") || "AAC user"
              : "No confirmed AAC snapshot is currently shared."}
          </SnapshotItem>
          <SnapshotItem icon={BookOpen} label="Current shared goals">
            {passportQuery.isLoading ? (
              "Loading shared passport..."
            ) : sharedGoals.length ? (
              <ul className="space-y-1">
                {sharedGoals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            ) : (
              "No goals have been selected for the shared passport."
            )}
          </SnapshotItem>
        </div>
        {supportStrategies.length ? (
          <div className="border-t border-border pt-4">
            <p className="text-xs font-bold uppercase text-muted-foreground">
              Helpful strategies
            </p>
            <ul className="mt-2 grid gap-2 text-sm leading-6 sm:grid-cols-2">
              {supportStrategies.map((strategy) => (
                <li key={strategy} className="flex gap-2">
                  <Check size={16} className="mt-1 shrink-0 text-primary" />
                  <span>{strategy}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground">
              Classroom guidance
            </p>
            <h2 className="serif mt-1 text-3xl font-semibold">
              Practical resource library
            </h2>
          </div>
          <span className="text-sm text-muted-foreground">
            {data.completionPercentage}% reviewed
          </span>
        </div>
        <nav
          className="mt-5 flex gap-2 overflow-x-auto pb-2"
          aria-label="Resource categories"
        >
          {["All resources", ...data.categories].map((value) => (
            <button
              key={value}
              onClick={() => setCategory(value)}
              className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                category === value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-foreground"
              }`}
            >
              {value}
            </button>
          ))}
        </nav>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <button
              key={item.resourceKey}
              onClick={() => setSelected(item.resourceKey)}
              className="min-w-0 rounded-md border border-border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex justify-between gap-4">
                <BookOpen className="text-primary" size={21} />
                {item.completed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    <Check size={14} /> Complete
                  </span>
                ) : item.bookmarked ? (
                  <Bookmark
                    size={16}
                    fill="currentColor"
                    className="text-accent"
                  />
                ) : null}
              </div>
              <p className="mono mt-5 text-[9px] font-bold uppercase text-muted-foreground">
                {item.category}
              </p>
              <h3 className="serif mt-2 text-xl font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {item.summary}
              </p>
              <p className="mt-4 text-xs font-semibold text-primary">
                {item.readingMinutes} min read
              </p>
            </button>
          ))}
        </div>
      </section>

      <p className="rounded-md bg-secondary/35 p-4 text-xs leading-5 text-muted-foreground">
        {data.disclaimer}
      </p>
    </div>
  );
}

function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-xl rounded-md border border-border bg-card p-8 text-center">
      <BookOpen className="mx-auto text-primary" />
      <h1 className="serif mt-4 text-3xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
