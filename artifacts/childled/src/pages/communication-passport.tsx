import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  getGetCommunicationPassportQueryKey,
  useGenerateCommunicationPassport,
  useGetCommunicationPassport,
  useSaveCommunicationPassport,
  type CommunicationPassportContent,
  type CommunicationPassportPhrase,
} from "@workspace/api-client-react";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Mode = "edit" | "preview";

const emptyContent = (): CommunicationPassportContent => ({
  childName: "",
  preferredName: "",
  aboutMe: "",
  communicationMethods: [],
  communicationStrengths: [],
  wantsAndNeeds: "",
  commonPhrases: [],
  gestures: [],
  aacInformation: "",
  helpfulStrategies: [],
  communicationChallenges: [],
  frustrationSupports: [],
  importantWords: [],
  interests: [],
  currentGoals: [],
  additionalInformation: "",
});

function FieldHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function TextListEditor({
  title,
  hint,
  values,
  placeholder,
  onChange,
}: {
  title: string;
  hint?: string;
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  return (
    <section className="space-y-3 border-t border-border/70 pt-5">
      <FieldHeading title={title} hint={hint} />
      {values.map((value, index) => (
        <div key={index} className="flex min-w-0 items-center gap-2">
          <Input
            aria-label={`${title} item ${index + 1}`}
            value={value}
            maxLength={500}
            placeholder={placeholder}
            className="min-h-11 min-w-0 flex-1"
            onChange={(event) => {
              const next = [...values];
              next[index] = event.target.value;
              onChange(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 text-muted-foreground hover:text-destructive"
            title={`Remove ${title.toLocaleLowerCase()} item`}
            onClick={() => onChange(values.filter((_, item) => item !== index))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full sm:w-auto"
        disabled={values.length >= 20}
        onClick={() => onChange([...values, ""])}
      >
        <Plus className="size-4" /> Add item
      </Button>
    </section>
  );
}

function PhraseListEditor({
  title,
  hint,
  values,
  onChange,
}: {
  title: string;
  hint?: string;
  values: CommunicationPassportPhrase[];
  onChange: (values: CommunicationPassportPhrase[]) => void;
}) {
  const update = (
    index: number,
    field: keyof CommunicationPassportPhrase,
    value: string,
  ) => {
    const next = values.map((entry, item) =>
      item === index ? { ...entry, [field]: value } : entry,
    );
    onChange(next);
  };
  return (
    <section className="space-y-3 border-t border-border/70 pt-5">
      <FieldHeading title={title} hint={hint} />
      {values.map((entry, index) => (
        <div
          key={index}
          className="grid min-w-0 gap-2 rounded-md border border-border/70 p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]"
        >
          <Input
            aria-label={`${title} phrase ${index + 1}`}
            value={entry.phrase}
            maxLength={300}
            placeholder="Word or phrase"
            className="min-h-11 min-w-0"
            onChange={(event) => update(index, "phrase", event.target.value)}
          />
          <Input
            aria-label={`${title} meaning ${index + 1}`}
            value={entry.meaning}
            maxLength={600}
            placeholder="What it may mean"
            className="min-h-11 min-w-0"
            onChange={(event) => update(index, "meaning", event.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 justify-self-end text-muted-foreground hover:text-destructive sm:justify-self-auto"
            title={`Remove ${title.toLocaleLowerCase()} phrase`}
            onClick={() => onChange(values.filter((_, item) => item !== index))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full sm:w-auto"
        disabled={values.length >= 20}
        onClick={() => onChange([...values, { phrase: "", meaning: "" }])}
      >
        <Plus className="size-4" /> Add phrase
      </Button>
    </section>
  );
}

function ParagraphField({
  title,
  hint,
  value,
  placeholder,
  maxLength = 1500,
  onChange,
}: {
  title: string;
  hint?: string;
  value: string;
  placeholder: string;
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  return (
    <section className="space-y-3 border-t border-border/70 pt-5">
      <FieldHeading title={title} hint={hint} />
      <Textarea
        aria-label={title}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        className="min-h-24 resize-y"
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  );
}

function PrintSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="passport-section space-y-2 border-t border-black/20 pt-3">
      <h2 className="text-sm font-bold uppercase text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function TextList({ values }: { values: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
      {values.map((value, index) => (
        <li key={`${value}-${index}`}>{value}</li>
      ))}
    </ul>
  );
}

function PassportDocument({
  content,
  updatedAt,
}: {
  content: CommunicationPassportContent;
  updatedAt: string | null;
}) {
  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Not saved yet";
  const personName = content.preferredName || content.childName;
  const communication = [content.wantsAndNeeds, ...content.gestures].filter(
    Boolean,
  );
  const difficulty = [
    ...content.communicationChallenges,
    ...content.frustrationSupports,
  ];
  return (
    <article
      id="communication-passport-document"
      className="mx-auto w-full max-w-[8.5in] bg-white px-5 py-6 text-neutral-950 sm:px-8 sm:py-8"
    >
      <header className="passport-section border-b-2 border-primary pb-4">
        <p className="text-xs font-bold uppercase text-primary">
          Communication Passport
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-normal text-neutral-950">
          {personName}
        </h1>
        {content.preferredName &&
        content.preferredName !== content.childName ? (
          <p className="mt-1 text-sm text-neutral-700">
            Full name: {content.childName}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-neutral-600">
          Last updated {updatedLabel}
        </p>
      </header>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 print:grid-cols-2">
        <div className="space-y-5">
          {content.aboutMe ? (
            <PrintSection title="About Me">
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {content.aboutMe}
              </p>
            </PrintSection>
          ) : null}
          {content.communicationMethods.length || communication.length ? (
            <PrintSection title="How I Communicate">
              {content.communicationMethods.length ? (
                <TextList values={content.communicationMethods} />
              ) : null}
              {communication.map((value, index) => (
                <p
                  key={`${value}-${index}`}
                  className="whitespace-pre-line text-sm leading-relaxed"
                >
                  {value}
                </p>
              ))}
            </PrintSection>
          ) : null}
          {content.aacInformation ? (
            <PrintSection title="AAC Information">
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {content.aacInformation}
              </p>
            </PrintSection>
          ) : null}
          {content.commonPhrases.length ? (
            <PrintSection title="You May Hear Me Say">
              <dl className="space-y-2 text-sm">
                {content.commonPhrases.map((entry, index) => (
                  <div key={`${entry.phrase}-${index}`}>
                    <dt className="font-semibold">
                      &quot;{entry.phrase}&quot;
                    </dt>
                    {entry.meaning ? (
                      <dd className="text-neutral-700">{entry.meaning}</dd>
                    ) : null}
                  </div>
                ))}
              </dl>
            </PrintSection>
          ) : null}
          {content.importantWords.length ? (
            <PrintSection title="Important Words and Phrases">
              <dl className="space-y-2 text-sm">
                {content.importantWords.map((entry, index) => (
                  <div key={`${entry.phrase}-${index}`}>
                    <dt className="font-semibold">{entry.phrase}</dt>
                    {entry.meaning ? (
                      <dd className="text-neutral-700">{entry.meaning}</dd>
                    ) : null}
                  </div>
                ))}
              </dl>
            </PrintSection>
          ) : null}
        </div>

        <div className="space-y-5">
          {content.communicationStrengths.length ? (
            <PrintSection title="Communication Strengths">
              <TextList values={content.communicationStrengths} />
            </PrintSection>
          ) : null}
          {content.helpfulStrategies.length ? (
            <PrintSection title="What Helps Me Communicate">
              <TextList values={content.helpfulStrategies} />
            </PrintSection>
          ) : null}
          {difficulty.length ? (
            <PrintSection title="When I'm Having Difficulty">
              <TextList values={difficulty} />
            </PrintSection>
          ) : null}
          {content.interests.length ? (
            <PrintSection title="Things I Enjoy">
              <TextList values={content.interests} />
            </PrintSection>
          ) : null}
          {content.currentGoals.length ? (
            <PrintSection title="Current Communication Goals">
              <TextList values={content.currentGoals} />
            </PrintSection>
          ) : null}
          {content.additionalInformation ? (
            <PrintSection title="Important Communication Information">
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {content.additionalInformation}
              </p>
            </PrintSection>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function CommunicationPassportPage({ childId }: { childId: number }) {
  const queryClient = useQueryClient();
  const passportQuery = useGetCommunicationPassport(
    { childId },
    {
      query: {
        queryKey: getGetCommunicationPassportQueryKey({ childId }),
        enabled: childId > 0,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  );
  const generatePassport = useGenerateCommunicationPassport();
  const savePassport = useSaveCommunicationPassport();
  const [draft, setDraft] = useState<CommunicationPassportContent>();
  const [mode, setMode] = useState<Mode>("preview");
  const [message, setMessage] = useState("");
  const [hydratedVersion, setHydratedVersion] = useState<string>();

  const savedContent = passportQuery.data?.content ?? undefined;
  const savedSignature = passportQuery.data
    ? `${passportQuery.data.version ?? "empty"}:${passportQuery.data.updatedAt ?? ""}`
    : undefined;

  useEffect(() => {
    if (!passportQuery.data || savedSignature === hydratedVersion) return;
    setDraft(passportQuery.data.content ?? undefined);
    setMode(passportQuery.data.content ? "preview" : "edit");
    setHydratedVersion(savedSignature);
  }, [hydratedVersion, passportQuery.data, savedSignature]);

  const isDirty = useMemo(() => {
    if (!draft) return false;
    return JSON.stringify(draft) !== JSON.stringify(savedContent ?? null);
  }, [draft, savedContent]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const cleanup = () =>
      document.body.classList.remove("printing-communication-passport");
    window.addEventListener("afterprint", cleanup);
    return () => {
      cleanup();
      window.removeEventListener("afterprint", cleanup);
    };
  }, []);

  const update = <Key extends keyof CommunicationPassportContent>(
    key: Key,
    value: CommunicationPassportContent[Key],
  ) =>
    setDraft((current) => ({ ...(current ?? emptyContent()), [key]: value }));

  const generate = async () => {
    setMessage("");
    if (
      isDirty &&
      !window.confirm("Replace your unsaved changes with a new draft?")
    )
      return;
    try {
      const result = await generatePassport.mutateAsync({
        data: { childId, templateKey: "general", language: "en" },
      });
      setDraft(result.content);
      setMode("edit");
      setMessage(
        "Draft generated from shared profile information. Review every section before saving.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The passport draft could not be generated. Try again.",
      );
    }
  };

  const save = async () => {
    if (!draft) return;
    setMessage("");
    try {
      const result = await savePassport.mutateAsync({
        data: {
          childId,
          templateKey: passportQuery.data?.templateKey ?? "general",
          language: passportQuery.data?.language ?? "en",
          content: draft,
          version: passportQuery.data?.version ?? null,
        },
      });
      queryClient.setQueryData(
        getGetCommunicationPassportQueryKey({ childId }),
        result,
      );
      setDraft(result.content ?? undefined);
      setHydratedVersion(
        `${result.version ?? "empty"}:${result.updatedAt ?? ""}`,
      );
      setMode("preview");
      setMessage("Communication passport saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The passport could not be saved. Your draft is still here.",
      );
    }
  };

  const print = () => {
    if (isDirty) {
      setMessage("Save your changes before printing the passport.");
      return;
    }
    document.body.classList.add("printing-communication-passport");
    window.print();
  };

  if (passportQuery.isLoading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Loading communication
          passport...
        </div>
      </main>
    );
  }

  if (passportQuery.isError) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-5">
          <AlertCircle className="size-5 text-destructive" />
          <h1 className="mt-3 text-xl font-semibold">Passport unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {passportQuery.error instanceof Error
              ? passportQuery.error.message
              : "The communication passport could not be loaded."}
          </p>
          <Button
            className="mt-4 min-h-11"
            onClick={() => passportQuery.refetch()}
          >
            <RefreshCw className="size-4" /> Try again
          </Button>
        </div>
      </main>
    );
  }

  const canEdit = Boolean(passportQuery.data?.canEdit);
  if (!draft) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href={`/children?childId=${childId}`}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to child profile
        </Link>
        <div className="mt-6 rounded-md border border-border bg-card p-5 sm:p-8">
          <BookOpen className="size-8 text-primary" />
          <h1 className="mt-4 text-2xl font-semibold tracking-normal">
            Communication Passport
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {canEdit
              ? "Generate an editable draft from the child's shared communication profile, reviewed dictionary phrases, confirmed AAC information, and active goals."
              : "The child's SLP has not shared a communication passport yet."}
          </p>
          {canEdit ? (
            <Button
              className="mt-6 min-h-11 w-full sm:w-auto"
              disabled={generatePassport.isPending}
              onClick={generate}
            >
              {generatePassport.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <BookOpen className="size-4" />
              )}
              Generate passport draft
            </Button>
          ) : null}
          {message ? (
            <p className="mt-4 text-sm text-destructive">{message}</p>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="communication-passport-screen mb-4 flex min-w-0 flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            href={`/children?childId=${childId}`}
            className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to child profile
          </Link>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-normal sm:text-3xl">
            Communication Passport
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {passportQuery.data?.updatedAt
              ? `Last updated ${new Date(passportQuery.data.updatedAt).toLocaleDateString()}`
              : "Unsaved draft"}
            {passportQuery.data?.updatedBy
              ? ` by ${passportQuery.data.updatedBy}`
              : ""}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          {canEdit ? (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
            >
              {mode === "edit" ? (
                <Eye className="size-4" />
              ) : (
                <Pencil className="size-4" />
              )}
              {mode === "edit" ? "Preview" : "Edit"}
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="min-h-11"
            disabled={!passportQuery.data?.exists || isDirty}
            title={isDirty ? "Save changes before printing" : "Print passport"}
            onClick={print}
          >
            <Printer className="size-4" /> Print
          </Button>
          {canEdit && mode === "edit" ? (
            <>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={generatePassport.isPending}
                onClick={generate}
              >
                {generatePassport.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Refresh draft
              </Button>
              <Button
                className="min-h-11"
                disabled={savePassport.isPending || !draft.childName.trim()}
                onClick={save}
              >
                {savePassport.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {message ? (
        <div
          className={`communication-passport-screen mb-4 rounded-md border px-4 py-3 text-sm ${message.includes("saved") || message.includes("generated") ? "border-primary/25 bg-primary/5 text-foreground" : "border-destructive/30 bg-destructive/5 text-destructive"}`}
        >
          {message}
        </div>
      ) : null}

      {mode === "edit" && canEdit ? (
        <div className="communication-passport-screen mx-auto max-w-3xl space-y-5 rounded-md border border-border bg-card p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Child name
              <Input
                value={draft.childName}
                maxLength={160}
                className="mt-2 min-h-11"
                onChange={(event) => update("childName", event.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Preferred name
              <Input
                value={draft.preferredName}
                maxLength={160}
                className="mt-2 min-h-11"
                onChange={(event) =>
                  update("preferredName", event.target.value)
                }
              />
            </label>
          </div>
          <ParagraphField
            title="About Me"
            hint="Include only background information a communication partner needs."
            value={draft.aboutMe}
            placeholder="A short introduction to the child's communication style"
            onChange={(value) => update("aboutMe", value)}
          />
          <TextListEditor
            title="Communication Methods"
            values={draft.communicationMethods}
            placeholder="Spoken language, AAC, gestures..."
            onChange={(value) => update("communicationMethods", value)}
          />
          <TextListEditor
            title="Communication Strengths"
            values={draft.communicationStrengths}
            placeholder="A communication strength"
            onChange={(value) => update("communicationStrengths", value)}
          />
          <ParagraphField
            title="How Wants and Needs Are Communicated"
            value={draft.wantsAndNeeds}
            placeholder="How the child usually asks, refuses, seeks help, or indicates a need"
            onChange={(value) => update("wantsAndNeeds", value)}
          />
          <PhraseListEditor
            title="Common Phrases and Scripts"
            hint="Only reviewed dictionary phrases are suggested automatically."
            values={draft.commonPhrases}
            onChange={(value) => update("commonPhrases", value)}
          />
          <TextListEditor
            title="Gestures and Nonverbal Communication"
            values={draft.gestures}
            placeholder="Gesture, body language, pointing, or another signal"
            onChange={(value) => update("gestures", value)}
          />
          <ParagraphField
            title="AAC Device or System"
            hint="Device notes and other private clinical details are never added automatically."
            value={draft.aacInformation}
            placeholder="Device, vocabulary system, and access method"
            onChange={(value) => update("aacInformation", value)}
          />
          <TextListEditor
            title="Helpful Communication Strategies"
            values={draft.helpfulStrategies}
            placeholder="A strategy that helps"
            onChange={(value) => update("helpfulStrategies", value)}
          />
          <TextListEditor
            title="Things That Make Communication More Difficult"
            values={draft.communicationChallenges}
            placeholder="A situation or barrier to be aware of"
            onChange={(value) => update("communicationChallenges", value)}
          />
          <TextListEditor
            title="Support When Frustrated or Not Understood"
            values={draft.frustrationSupports}
            placeholder="A supportive response or regulation strategy"
            onChange={(value) => update("frustrationSupports", value)}
          />
          <PhraseListEditor
            title="Important Words and Phrases"
            values={draft.importantWords}
            onChange={(value) => update("importantWords", value)}
          />
          <TextListEditor
            title="Interests and Motivators"
            values={draft.interests}
            placeholder="An interest, preferred topic, or motivator"
            onChange={(value) => update("interests", value)}
          />
          <TextListEditor
            title="Current Relevant Communication Goals"
            hint="Remove any goal that is not appropriate to share in this passport."
            values={draft.currentGoals}
            placeholder="A current communication goal"
            onChange={(value) => update("currentGoals", value)}
          />
          <ParagraphField
            title="Important Communication Information"
            value={draft.additionalInformation}
            maxLength={2000}
            placeholder="Anything else an approved communication partner should know"
            onChange={(value) => update("additionalInformation", value)}
          />
          <div className="sticky bottom-2 z-10 flex flex-col gap-2 rounded-md border border-border bg-background/95 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Review the preview before sharing or printing.
            </p>
            <Button
              className="min-h-11 w-full sm:w-auto"
              disabled={savePassport.isPending || !draft.childName.trim()}
              onClick={save}
            >
              {savePassport.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save and preview
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-white shadow-sm">
          <PassportDocument
            content={draft}
            updatedAt={passportQuery.data?.updatedAt ?? null}
          />
        </div>
      )}
    </main>
  );
}
