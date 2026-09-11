export type ServicePeriod =
  "weekly" | "monthly" | "quarterly" | "yearly" | "custom";

type ServicePeriodBounds = {
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

export const dateString = (value: Date) => value.toISOString().slice(0, 10);

export const servicePeriodWindow = (
  period: ServicePeriod | string,
  current = new Date(),
  bounds: ServicePeriodBounds = {},
) => {
  const day = new Date(
    Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth(),
      current.getUTCDate(),
    ),
  );
  let start: Date;
  let endExclusive: Date;
  let label: string;
  if (period === "custom" || period === "reporting_period") {
    if (!bounds.effectiveFrom || !bounds.effectiveTo) {
      throw new Error(
        "Custom periods require an effective start and end date.",
      );
    }
    start = new Date(`${bounds.effectiveFrom}T00:00:00.000Z`);
    const end = new Date(`${bounds.effectiveTo}T00:00:00.000Z`);
    endExclusive = new Date(end);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const dateLabel = (value: Date) =>
      value.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
    label = `${dateLabel(start)} - ${dateLabel(end)}`;
  } else if (period === "weekly") {
    const mondayOffset = (day.getUTCDay() + 6) % 7;
    start = new Date(day);
    start.setUTCDate(start.getUTCDate() - mondayOffset);
    endExclusive = new Date(start);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 7);
    label = `Week of ${start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })}`;
  } else if (period === "monthly") {
    start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
    endExclusive = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 1),
    );
    label = start.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  } else if (period === "quarterly") {
    const quarterStartMonth = Math.floor(day.getUTCMonth() / 3) * 3;
    start = new Date(Date.UTC(day.getUTCFullYear(), quarterStartMonth, 1));
    endExclusive = new Date(
      Date.UTC(day.getUTCFullYear(), quarterStartMonth + 3, 1),
    );
    label = `Q${Math.floor(quarterStartMonth / 3) + 1} ${day.getUTCFullYear()}`;
  } else if (period === "yearly") {
    start = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
    endExclusive = new Date(Date.UTC(day.getUTCFullYear() + 1, 0, 1));
    label = String(day.getUTCFullYear());
  } else {
    throw new Error(`Unsupported service frequency period: ${period}`);
  }
  if (period !== "custom" && period !== "reporting_period") {
    if (bounds.effectiveFrom && bounds.effectiveFrom > dateString(start)) {
      start = new Date(`${bounds.effectiveFrom}T00:00:00.000Z`);
    }
    if (bounds.effectiveTo) {
      const requirementEndExclusive = new Date(
        `${bounds.effectiveTo}T00:00:00.000Z`,
      );
      requirementEndExclusive.setUTCDate(
        requirementEndExclusive.getUTCDate() + 1,
      );
      if (requirementEndExclusive < endExclusive) {
        endExclusive = requirementEndExclusive;
      }
    }
  }
  const end = new Date(endExclusive);
  end.setUTCDate(end.getUTCDate() - 1);
  return {
    start: dateString(start),
    end: dateString(end),
    endExclusive: dateString(endExclusive),
    label,
    progress: Math.min(
      1,
      Math.max(
        0,
        (current.getTime() - start.getTime()) /
          Math.max(1, endExclusive.getTime() - start.getTime()),
      ),
    ),
  };
};

export const serviceDeliveryStatus = ({
  requiredSessions,
  requiredMinutes,
  sessionsCompleted,
  minutesCompleted,
  periodProgress,
}: {
  requiredSessions: number;
  requiredMinutes: number;
  sessionsCompleted: number;
  minutesCompleted: number;
  periodProgress: number;
}) => {
  const sessionsRemaining = Math.max(0, requiredSessions - sessionsCompleted);
  const minutesRemaining = Math.max(0, requiredMinutes - minutesCompleted);
  const complete = sessionsRemaining === 0 && minutesRemaining === 0;
  const sessionDeficit = requiredSessions * periodProgress - sessionsCompleted;
  const needsAttention =
    !complete && (sessionDeficit > 0.01 || periodProgress >= 1);
  const behind =
    needsAttention &&
    sessionsRemaining > 0 &&
    (periodProgress >= 1 ||
      sessionDeficit >= Math.max(2, requiredSessions * 0.25));

  return {
    sessionsRemaining,
    minutesRemaining,
    status: complete
      ? "complete"
      : behind
        ? "behind"
        : needsAttention
          ? "needs_attention"
          : "on_track",
  } as const;
};
