import type { CommunicationGoal } from "@workspace/api-client-react";

export const sessionGoalProgressStatuses = [
  "not_addressed",
  "progressed",
  "progressing_gradually",
  "regressed",
  "goal_met",
] as const;

export const sessionGoalPromptingLevels = [
  "na",
  "independent",
  "minimal",
  "moderate",
  "maximal",
] as const;

export type SessionGoalProgressStatus =
  (typeof sessionGoalProgressStatuses)[number];
export type SessionGoalPromptingLevel =
  (typeof sessionGoalPromptingLevels)[number];

export type SessionGoalReviewValue = {
  progressStatus: SessionGoalProgressStatus;
  promptingLevel: SessionGoalPromptingLevel;
  comments: string;
};

export const emptySessionGoalReview = (): SessionGoalReviewValue => ({
  progressStatus: "not_addressed",
  promptingLevel: "na",
  comments: "",
});

export const sessionGoalProgressLabel = (status: SessionGoalProgressStatus) =>
  ({
    not_addressed: "Not Addressed",
    progressed: "Progressed",
    progressing_gradually: "Progressing Gradually",
    regressed: "Regressed",
    goal_met: "Goal Met",
  })[status];

export const sessionGoalPromptingLabel = (level: SessionGoalPromptingLevel) =>
  ({
    na: "N/A",
    independent: "Independent",
    minimal: "Minimal",
    moderate: "Moderate",
    maximal: "Maximal",
  })[level];

export function SessionGoalReview({
  goals,
  values,
  onChange,
  loading = false,
  error = false,
  onRetry,
}: {
  goals: CommunicationGoal[];
  values: Record<number, SessionGoalReviewValue>;
  onChange: (goalId: number, value: SessionGoalReviewValue) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <div
        className="mt-4 grid gap-3"
        role="status"
        aria-label="Loading active communication goals"
      >
        <div className="h-24 animate-pulse rounded-md bg-muted" />
        <div className="h-24 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 rounded-md border border-destructive/25 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">
          Active goals could not be loaded. Your recording review is preserved.
        </p>
        {onRetry && (
          <button
            type="button"
            className="mt-3 min-h-11 rounded-md border border-input bg-background px-4 text-sm font-semibold text-primary focus-ring"
            onClick={onRetry}
          >
            Retry goals
          </button>
        )}
      </div>
    );
  }

  if (!goals.length) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
        This child has no active communication goals. You can continue without
        adding goal progress.
      </div>
    );
  }

  const addressedCount = goals.filter(
    (goal) =>
      (values[goal.id] ?? emptySessionGoalReview()).progressStatus !==
      "not_addressed",
  ).length;

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground">
        {addressedCount} of {goals.length} marked as addressed
      </p>
      {goals.map((goal) => {
        const value = values[goal.id] ?? emptySessionGoalReview();
        const addressed = value.progressStatus !== "not_addressed";
        return (
          <article
            key={goal.id}
            data-testid={`session-goal-review-${goal.id}`}
            className={`rounded-md border p-4 sm:p-5 ${
              addressed
                ? "border-primary/30 bg-secondary/25"
                : "border-border bg-background"
            }`}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_11rem_11rem] lg:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{goal.title}</h3>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      addressed
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {addressed ? "Addressed" : "Not addressed"}
                  </span>
                </div>
                <p className="mt-1 text-xs font-bold uppercase text-primary">
                  {goal.goalArea}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {goal.description}
                </p>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold">
                  Progress
                </span>
                <select
                  data-testid={`select-goal-progress-${goal.id}`}
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={value.progressStatus}
                  onChange={(event) => {
                    const progressStatus = event.target
                      .value as SessionGoalProgressStatus;
                    onChange(goal.id, {
                      ...value,
                      progressStatus,
                      promptingLevel:
                        progressStatus === "not_addressed"
                          ? "na"
                          : value.promptingLevel,
                    });
                  }}
                >
                  {sessionGoalProgressStatuses.map((status) => (
                    <option key={status} value={status}>
                      {sessionGoalProgressLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold">
                  Prompting
                </span>
                <select
                  data-testid={`select-goal-prompting-${goal.id}`}
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  value={value.promptingLevel}
                  disabled={!addressed}
                  onChange={(event) =>
                    onChange(goal.id, {
                      ...value,
                      promptingLevel: event.target
                        .value as SessionGoalPromptingLevel,
                    })
                  }
                >
                  {sessionGoalPromptingLevels.map((level) => (
                    <option key={level} value={level}>
                      {sessionGoalPromptingLabel(level)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-semibold">
                Goal-specific notes{" "}
                <span className="font-normal">(optional)</span>
              </span>
              <textarea
                data-testid={`textarea-goal-comments-${goal.id}`}
                value={value.comments}
                onChange={(event) =>
                  onChange(goal.id, { ...value, comments: event.target.value })
                }
                maxLength={4000}
                placeholder="Briefly note what you observed for this goal."
                className="min-h-20 w-full resize-y rounded-md border border-input bg-background p-3 text-sm outline-none focus-ring"
              />
            </label>
          </article>
        );
      })}
    </div>
  );
}
