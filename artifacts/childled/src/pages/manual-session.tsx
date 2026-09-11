import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  getGetManualSessionSetupQueryKey,
  getGetClinicianOverviewQueryKey,
  getGetSessionsDashboardQueryKey,
  getListSessionsQueryKey,
  useCreateManualSession,
  useGetManualSessionSetup,
  type Child,
  type ManualSessionGoalProgressInput,
  type Session,
} from "@workspace/api-client-react";
import {
  ArrowLeft,
  Check,
  Clock3,
  FileText,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Square,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { serviceTypeLabel } from "@/components/service-requirement-form";

type TimerStatus = "idle" | "running" | "paused" | "ended";

type StoredTimer = {
  childId: number;
  serviceRequirementId: number | null;
  status: TimerStatus;
  accumulatedSeconds: number;
  runningSince: number | null;
  startedAt: string | null;
  endedAt: string | null;
};

type GoalEntry = {
  selected: boolean;
  accuracyPercent: string;
  successfulAttempts: string;
  totalAttempts: string;
  promptingLevel: string;
  progressNote: string;
};

const emptyTimer = (
  childId: number,
  serviceRequirementId: number | null = null,
): StoredTimer => ({
  childId,
  serviceRequirementId,
  status: "idle",
  accumulatedSeconds: 0,
  runningSince: null,
  startedAt: null,
  endedAt: null,
});

const timerStorageKey = (childId: number) =>
  `childled.manual-session.timer.v1.${childId}`;

const localDate = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const elapsedFor = (timer: StoredTimer, now = Date.now()) =>
  Math.max(
    0,
    timer.accumulatedSeconds +
      (timer.status === "running" && timer.runningSince
        ? Math.floor((now - timer.runningSince) / 1_000)
        : 0),
  );

const formattedDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  return hours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};

const numberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const statusStyle = {
  on_track: "bg-emerald-100 text-emerald-800",
  needs_attention: "bg-amber-100 text-amber-900",
  behind: "bg-red-100 text-red-800",
  complete: "bg-primary/10 text-primary",
} as const;

export function ManualSessionTrackingPage({
  children,
  initialChildId,
  initialServiceId,
  onSaved,
}: {
  children: Child[];
  initialChildId?: number;
  initialServiceId?: number;
  onSaved?: (session: Session) => void;
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [childId, setChildId] = useState(
    initialChildId ?? children[0]?.id ?? 0,
  );
  const [serviceRequirementId, setServiceRequirementId] = useState<
    number | undefined
  >(initialServiceId);
  const child = children.find((item) => item.id === childId);
  const [timer, setTimer] = useState<StoredTimer>(() =>
    emptyTimer(childId, initialServiceId ?? null),
  );
  const [hydratedTimerChildId, setHydratedTimerChildId] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [sessionDate, setSessionDate] = useState(localDate);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [durationEdited, setDurationEdited] = useState(false);
  const [goalEntries, setGoalEntries] = useState<Record<number, GoalEntry>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [savedSession, setSavedSession] = useState<Session>();

  const setupQuery = useGetManualSessionSetup(
    { childId },
    {
      query: {
        queryKey: getGetManualSessionSetupQueryKey({ childId }),
        enabled: childId > 0,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  );
  const saveSession = useCreateManualSession();
  const services = useMemo(
    () => setupQuery.data?.serviceRequirements ?? [],
    [setupQuery.data?.serviceRequirements],
  );
  const selectedService = services.find(
    (service) => service.id === serviceRequirementId,
  );
  const elapsedSeconds = elapsedFor(timer, clock);
  const selectedGoals = useMemo(
    () =>
      (setupQuery.data?.goals ?? []).filter(
        (goal) => goalEntries[goal.id]?.selected,
      ),
    [goalEntries, setupQuery.data?.goals],
  );

  useEffect(() => {
    if (!childId && children[0]?.id) setChildId(children[0].id);
  }, [childId, children]);

  useEffect(() => {
    if (!childId) return;
    const stored = window.localStorage.getItem(timerStorageKey(childId));
    if (!stored) {
      setTimer(emptyTimer(childId, serviceRequirementId ?? null));
      setDurationSeconds(0);
      setDurationEdited(false);
      setHydratedTimerChildId(childId);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as StoredTimer;
      if (parsed.childId !== childId) throw new Error("Timer child mismatch");
      if (parsed.serviceRequirementId)
        setServiceRequirementId(parsed.serviceRequirementId);
      setTimer(parsed);
      const elapsed = elapsedFor(parsed);
      setDurationSeconds(elapsed);
      setDurationEdited(false);
      setHydratedTimerChildId(childId);
    } catch {
      window.localStorage.removeItem(timerStorageKey(childId));
      setTimer(emptyTimer(childId, serviceRequirementId ?? null));
      setHydratedTimerChildId(childId);
    }
  }, [childId]);

  useEffect(() => {
    if (!childId || hydratedTimerChildId !== childId) return;
    window.localStorage.setItem(
      timerStorageKey(childId),
      JSON.stringify(timer),
    );
  }, [childId, hydratedTimerChildId, timer]);

  useEffect(() => {
    if (timer.status !== "running") return;
    const interval = window.setInterval(() => setClock(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [timer.status]);

  useEffect(() => {
    if (setupQuery.isLoading) return;
    if (!services.length) {
      setServiceRequirementId(undefined);
      return;
    }
    if (serviceRequirementId && selectedService) return;
    if (
      timer.serviceRequirementId &&
      services.some((service) => service.id === timer.serviceRequirementId)
    ) {
      setServiceRequirementId(timer.serviceRequirementId);
      return;
    }
    setServiceRequirementId(services.length === 1 ? services[0].id : undefined);
  }, [
    selectedService,
    serviceRequirementId,
    services,
    setupQuery.isLoading,
    timer.serviceRequirementId,
  ]);

  const updateTimer = (next: StoredTimer) => {
    setTimer(next);
    setClock(Date.now());
  };

  const startTimer = () => {
    if (!serviceRequirementId) {
      setError("Select the service this session should count toward.");
      return;
    }
    const now = new Date();
    updateTimer({
      ...emptyTimer(childId, serviceRequirementId),
      status: "running",
      runningSince: now.getTime(),
      startedAt: now.toISOString(),
    });
    setDurationSeconds(0);
    setDurationEdited(false);
    setError("");
  };

  const pauseTimer = () => {
    const accumulatedSeconds = elapsedFor(timer);
    updateTimer({
      ...timer,
      status: "paused",
      accumulatedSeconds,
      runningSince: null,
    });
  };

  const resumeTimer = () =>
    updateTimer({
      ...timer,
      status: "running",
      runningSince: Date.now(),
      endedAt: null,
    });

  const endTimer = () => {
    const endedAt = new Date();
    const finalElapsed = elapsedFor(timer, endedAt.getTime());
    updateTimer({
      ...timer,
      status: "ended",
      accumulatedSeconds: finalElapsed,
      runningSince: null,
      endedAt: endedAt.toISOString(),
    });
    setDurationSeconds(finalElapsed);
    setDurationEdited(false);
  };

  const resetTimer = () => {
    updateTimer(emptyTimer(childId, serviceRequirementId ?? null));
    setDurationSeconds(0);
    setDurationEdited(false);
  };

  const updateGoal = (goalId: number, update: Partial<GoalEntry>) =>
    setGoalEntries((current) => {
      const previous = current[goalId] ?? {
        selected: false,
        accuracyPercent: "",
        successfulAttempts: "",
        totalAttempts: "",
        promptingLevel: "",
        progressNote: "",
      };
      return {
        ...current,
        [goalId]: {
          ...previous,
          ...update,
        },
      };
    });

  const completeSession = async () => {
    setError("");
    if (timer.status === "running" || timer.status === "paused") {
      setError("End the timer before saving the completed session.");
      return;
    }
    if (!serviceRequirementId || !selectedService) {
      setError("Select the service this session should count toward.");
      return;
    }
    if (!selectedGoals.length) {
      setError("Select at least one IEP goal worked on during this session.");
      return;
    }
    if (durationSeconds < 60) {
      setError("Enter a final session duration of at least one minute.");
      return;
    }
    if (!note.trim()) {
      setError("Add a general session note before saving.");
      return;
    }
    const incompleteGoal = selectedGoals.find((goal) => {
      const entry = goalEntries[goal.id]!;
      const accuracy = numberOrNull(entry.accuracyPercent);
      const successful = numberOrNull(entry.successfulAttempts);
      const total = numberOrNull(entry.totalAttempts);
      return (
        (accuracy != null && (accuracy < 0 || accuracy > 100)) ||
        (successful != null &&
          (!Number.isInteger(successful) ||
            total == null ||
            successful > total)) ||
        (total != null && !Number.isInteger(total)) ||
        (accuracy == null &&
          total == null &&
          !entry.promptingLevel &&
          !entry.progressNote.trim())
      );
    });
    if (incompleteGoal) {
      setError(
        `Add valid progress data for ${incompleteGoal.title}. Successful attempts need a whole-number total and cannot exceed it.`,
      );
      return;
    }
    const goals: ManualSessionGoalProgressInput[] = selectedGoals.map(
      (goal) => {
        const entry = goalEntries[goal.id]!;
        return {
          goalId: goal.id,
          accuracyPercent: numberOrNull(entry.accuracyPercent),
          successfulAttempts: numberOrNull(entry.successfulAttempts),
          totalAttempts: numberOrNull(entry.totalAttempts),
          promptingLevel: (entry.promptingLevel ||
            null) as ManualSessionGoalProgressInput["promptingLevel"],
          progressNote: entry.progressNote,
        };
      },
    );
    try {
      const timerElapsedSeconds = timer.accumulatedSeconds;
      const durationSource = timerElapsedSeconds
        ? durationEdited
          ? "timer_edited"
          : "timer"
        : "manual";
      const session = await saveSession.mutateAsync({
        params: { childId },
        data: {
          serviceRequirementId,
          sessionDate,
          startedAt: timer.startedAt,
          endedAt: timer.endedAt,
          durationSeconds,
          timerElapsedSeconds,
          durationSource,
          durationEdited: Boolean(timerElapsedSeconds && durationEdited),
          goals,
          note: note.trim(),
        },
      });
      window.localStorage.removeItem(timerStorageKey(childId));
      setSavedSession(session);
      onSaved?.(session);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getListSessionsQueryKey({ childId }),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetSessionsDashboardQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetManualSessionSetupQueryKey({ childId }),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetClinicianOverviewQueryKey(),
        }),
      ]);
    } catch (requestError: any) {
      setError(
        requestError?.data?.error ??
          requestError?.message ??
          "The session could not be saved. Your timer and entries are still here.",
      );
    }
  };

  if (savedSession) {
    return (
      <main className="mx-auto max-w-2xl py-6 animate-rise">
        <section className="border-y border-primary/20 bg-card px-5 py-10 text-center sm:border sm:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-800">
            <Check size={28} />
          </span>
          <h1 className="serif mt-5 text-3xl font-semibold">Session saved</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {child?.name}&apos;s manual session and IEP goal data are now in
            session history.
          </p>
          <Button
            className="mt-6 min-h-12"
            onClick={() => setLocation(`/session?childId=${childId}`)}
          >
            View session history
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 py-4 animate-rise">
      <header className="flex flex-wrap items-center justify-between gap-4 px-1">
        <div>
          <Button
            variant="ghost"
            className="mb-2 px-0"
            onClick={() =>
              setLocation(`/session${childId ? `?childId=${childId}` : ""}`)
            }
          >
            <ArrowLeft size={16} /> Sessions
          </Button>
          <h1 className="serif text-3xl font-semibold md:text-4xl">
            Manual Session Tracking
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Document IEP goal progress without recording audio.
          </p>
        </div>
        <div className="grid w-full gap-3 sm:w-80">
          <label>
            <span className="mb-2 block text-xs font-bold uppercase text-muted-foreground">
              Student
            </span>
            <select
              className="h-12 w-full rounded-md border border-input bg-card px-3 text-sm font-semibold"
              value={childId || ""}
              disabled={timer.status === "running" || timer.status === "paused"}
              onChange={(event) => {
                const nextChildId = Number(event.target.value);
                setChildId(nextChildId);
                setServiceRequirementId(undefined);
                setGoalEntries({});
                setError("");
              }}
            >
              <option value="">Select a student</option>
              {children.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase text-muted-foreground">
              Service
            </span>
            <select
              className="h-12 w-full rounded-md border border-input bg-card px-3 text-sm font-semibold"
              value={serviceRequirementId ?? ""}
              disabled={timer.status === "running" || timer.status === "paused"}
              onChange={(event) => {
                setServiceRequirementId(
                  Number(event.target.value) || undefined,
                );
                setError("");
              }}
            >
              <option value="">Select a service</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {serviceTypeLabel(service.serviceType)} · {service.period}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="order-2 min-w-0 space-y-7 lg:order-none">
          <section className="border-y border-border bg-card px-4 py-5 sm:border sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-primary">
                  Session details
                </p>
                <h2 className="serif mt-1 text-xl font-semibold">
                  {child?.name ?? "Select a student"}
                </h2>
              </div>
              <label>
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Date
                </span>
                <Input
                  type="date"
                  value={sessionDate}
                  onChange={(event) => setSessionDate(event.target.value)}
                />
              </label>
            </div>
          </section>

          <section>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-primary">
                  IEP goals
                </p>
                <h2 className="serif mt-1 text-2xl font-semibold">
                  Goals addressed
                </h2>
              </div>
              <span className="text-sm font-semibold text-muted-foreground">
                {selectedGoals.length} selected
              </span>
            </div>
            {setupQuery.isLoading ? (
              <div className="mt-4 h-32 animate-pulse bg-muted" />
            ) : setupQuery.isError ? (
              <div className="mt-4 border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
                Goals could not be loaded. Retry before documenting this
                session.
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => void setupQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : !setupQuery.data?.goals.length ? (
              <div className="mt-4 border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
                This child has no active communication goals. Add an active goal
                from the child profile before tracking a manual session.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {setupQuery.data.goals.map((goal) => {
                  const entry = goalEntries[goal.id];
                  const selected = Boolean(entry?.selected);
                  return (
                    <article
                      key={goal.id}
                      className="rounded-md border border-border bg-card p-4 sm:p-5"
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <Checkbox
                          checked={selected}
                          onCheckedChange={(checked) =>
                            updateGoal(goal.id, { selected: checked === true })
                          }
                          className="mt-1 size-5"
                        />
                        <span className="min-w-0">
                          <span className="block font-semibold">
                            {goal.title}
                          </span>
                          <span className="mt-1 block text-xs font-bold uppercase text-primary">
                            {goal.goalArea}
                          </span>
                          <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                            {goal.description}
                          </span>
                        </span>
                      </label>
                      {selected && (
                        <div className="mt-5 border-t border-border pt-5">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <label>
                              <span className="mb-1.5 block text-xs font-semibold">
                                Accuracy (%)
                              </span>
                              <Input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                max="100"
                                placeholder="80"
                                value={entry?.accuracyPercent ?? ""}
                                onChange={(event) =>
                                  updateGoal(goal.id, {
                                    accuracyPercent: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              <span className="mb-1.5 block text-xs font-semibold">
                                Prompting/support
                              </span>
                              <select
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={entry?.promptingLevel ?? ""}
                                onChange={(event) =>
                                  updateGoal(goal.id, {
                                    promptingLevel: event.target.value,
                                  })
                                }
                              >
                                <option value="">Not recorded</option>
                                <option value="independent">Independent</option>
                                <option value="minimal">Minimal support</option>
                                <option value="moderate">
                                  Moderate support
                                </option>
                                <option value="maximal">Maximal support</option>
                                <option value="total">Total support</option>
                              </select>
                            </label>
                            <label>
                              <span className="mb-1.5 block text-xs font-semibold">
                                Successful attempts
                              </span>
                              <Input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                placeholder="7"
                                value={entry?.successfulAttempts ?? ""}
                                onChange={(event) =>
                                  updateGoal(goal.id, {
                                    successfulAttempts: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              <span className="mb-1.5 block text-xs font-semibold">
                                Total attempts
                              </span>
                              <Input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                placeholder="10"
                                value={entry?.totalAttempts ?? ""}
                                onChange={(event) =>
                                  updateGoal(goal.id, {
                                    totalAttempts: event.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>
                          <label className="mt-4 block">
                            <span className="mb-1.5 block text-xs font-semibold">
                              Progress note
                            </span>
                            <Textarea
                              rows={3}
                              maxLength={4000}
                              placeholder="Briefly document performance, context, or supports used."
                              value={entry?.progressNote ?? ""}
                              onChange={(event) =>
                                updateGoal(goal.id, {
                                  progressNote: event.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="border-y border-border bg-card px-4 py-5 sm:border sm:p-6">
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-primary" />
              <h2 className="serif text-xl font-semibold">
                General session note
              </h2>
            </div>
            <Textarea
              className="mt-4"
              rows={5}
              maxLength={10000}
              placeholder="Participation, activities, response to supports, and relevant follow-up."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </section>
        </div>

        <aside className="contents lg:sticky lg:top-20 lg:block lg:space-y-5">
          <section className="order-1 border border-primary/20 bg-primary px-4 py-5 text-primary-foreground shadow-lg sm:px-5 sm:py-6 lg:order-none">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clock3 size={18} /> Session Time
            </div>
            <p
              className="mono mt-4 text-center text-5xl font-bold"
              aria-live="off"
            >
              {formattedDuration(elapsedSeconds)}
            </p>
            <p className="mt-2 text-center text-xs text-primary-foreground/75">
              {timer.status === "running"
                ? "Timer running"
                : timer.status === "paused"
                  ? "Timer paused"
                  : timer.status === "ended"
                    ? "Session ended"
                    : "Ready to begin"}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {timer.status === "idle" || timer.status === "ended" ? (
                <Button
                  className="col-span-2 min-h-12 bg-accent text-primary hover:bg-accent/90"
                  onClick={startTimer}
                  disabled={!childId}
                >
                  <Play size={17} /> Start Timer
                </Button>
              ) : timer.status === "running" ? (
                <Button
                  className="min-h-12 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={pauseTimer}
                >
                  <Pause size={17} /> Pause
                </Button>
              ) : (
                <Button
                  className="min-h-12 bg-accent text-primary hover:bg-accent/90"
                  onClick={resumeTimer}
                >
                  <Play size={17} /> Resume
                </Button>
              )}
              {(timer.status === "running" || timer.status === "paused") && (
                <Button
                  className="min-h-12 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                  onClick={endTimer}
                >
                  <Square size={16} /> End Session
                </Button>
              )}
            </div>
            {timer.status !== "idle" && timer.status !== "running" && (
              <Button
                variant="ghost"
                className="mt-3 w-full text-primary-foreground hover:bg-primary-foreground/10"
                onClick={resetTimer}
              >
                <RotateCcw size={15} /> Reset timer
              </Button>
            )}
          </section>

          <section className="order-3 border border-border bg-card p-4 sm:p-5 lg:order-none">
            <label>
              <span className="text-xs font-bold uppercase text-muted-foreground">
                Final duration
              </span>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="480"
                  step="0.1"
                  inputMode="decimal"
                  value={
                    durationSeconds
                      ? Number((durationSeconds / 60).toFixed(1))
                      : ""
                  }
                  placeholder="Minutes"
                  onChange={(event) => {
                    setDurationSeconds(
                      Math.round(Number(event.target.value || 0) * 60),
                    );
                    setDurationEdited(timer.accumulatedSeconds > 0);
                  }}
                />
                <span className="text-sm font-semibold text-muted-foreground">
                  min
                </span>
              </div>
            </label>
            {timer.accumulatedSeconds > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Timer recorded {formattedDuration(timer.accumulatedSeconds)}
                {durationEdited ? "; final duration was edited." : "."}
              </p>
            )}
          </section>

          <section className="order-3 border border-border bg-card p-4 sm:p-5 lg:order-none">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">
                  Selected service
                </p>
                <h2 className="mt-1 font-semibold">
                  {selectedService
                    ? serviceTypeLabel(selectedService.serviceType)
                    : "Choose a service"}
                </h2>
              </div>
              <Button
                variant="ghost"
                className="size-9 p-0"
                title="Manage services"
                onClick={() => setLocation(`/service-setup?childId=${childId}`)}
              >
                <Settings size={16} />
              </Button>
            </div>
            {selectedService ? (
              <div className="mt-4 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {selectedService.periodLabel}
                  </p>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${statusStyle[selectedService.status]}`}
                  >
                    {selectedService.status.replace("_", " ")}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Sessions</dt>
                    <dd className="font-bold">
                      {selectedService.sessionsCompleted} /{" "}
                      {selectedService.requiredSessions}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Remaining</dt>
                    <dd className="font-bold">
                      {selectedService.sessionsRemaining}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Minutes</dt>
                    <dd className="font-bold">
                      {selectedService.minutesCompleted} /{" "}
                      {selectedService.requiredMinutes}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Remaining</dt>
                    <dd className="font-bold">
                      {selectedService.minutesRemaining}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() =>
                  services.length
                    ? setError("Choose a service from the selector above.")
                    : setLocation(`/service-setup?childId=${childId}`)
                }
              >
                <Target size={16} />
                {services.length ? "Select service" : "Add service"}
              </Button>
            )}
          </section>

          <Button
            className="order-3 min-h-14 w-full text-base lg:order-none"
            disabled={
              saveSession.isPending || !childId || !serviceRequirementId
            }
            onClick={() => void completeSession()}
          >
            <Check size={18} />{" "}
            {saveSession.isPending
              ? "Saving session…"
              : "Save completed session"}
          </Button>
        </aside>
      </div>
    </main>
  );
}
