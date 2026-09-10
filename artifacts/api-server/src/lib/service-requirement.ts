export type ServicePeriod = "weekly" | "monthly";

export const dateString = (value: Date) => value.toISOString().slice(0, 10);

export const servicePeriodWindow = (
  period: ServicePeriod | string,
  current = new Date(),
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
  if (period === "weekly") {
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
  } else {
    start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
    endExclusive = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 1),
    );
    label = start.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  const end = new Date(endExclusive);
  end.setUTCDate(end.getUTCDate() - 1);
  return {
    start: dateString(start),
    end: dateString(end),
    endExclusive: dateString(endExclusive),
    label,
    progress:
      Math.min(
        1,
        Math.max(0, current.getTime() - start.getTime()) /
          Math.max(1, endExclusive.getTime() - start.getTime()),
      ) || 0,
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
  const behind =
    !complete &&
    (sessionsCompleted + 0.01 < requiredSessions * periodProgress ||
      minutesCompleted + 0.01 < requiredMinutes * periodProgress);

  return {
    sessionsRemaining,
    minutesRemaining,
    status: complete ? "complete" : behind ? "behind" : "on_track",
  } as const;
};
