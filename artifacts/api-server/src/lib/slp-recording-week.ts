export const SLP_WEEKLY_RECORDING_LIMIT_SECONDS = 60 * 60;
export const SLP_WEEKLY_RECORDING_LIMIT_MILLISECONDS =
  SLP_WEEKLY_RECORDING_LIMIT_SECONDS * 1_000;

export const RECORDING_ALLOWANCE_TIME_ZONE =
  process.env.CHILDLED_RECORDING_TIME_ZONE?.trim() || "America/New_York";

const formatterFor = (timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

const partsFor = (date: Date, formatter: Intl.DateTimeFormat) => {
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
};

const midnightInZone = (date: Date, formatter: Intl.DateTimeFormat) => {
  const target = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  let instant = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = partsFor(new Date(instant), formatter);
    const wallClock = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const correction = target - wallClock;
    if (!correction) break;
    instant += correction;
  }
  return new Date(instant);
};

export const recordingWeekFor = (
  now = new Date(),
  timeZone = RECORDING_ALLOWANCE_TIME_ZONE,
) => {
  const formatter = formatterFor(timeZone);
  const local = partsFor(now, formatter);
  const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const daysSinceMonday = (localDate.getUTCDay() + 6) % 7;
  const weekStartDate = new Date(
    localDate.getTime() - daysSinceMonday * 86_400_000,
  );
  const nextMondayDate = new Date(weekStartDate.getTime() + 7 * 86_400_000);
  return {
    periodStart: weekStartDate.toISOString().slice(0, 10),
    periodEnd: midnightInZone(nextMondayDate, formatter),
    timeZone,
  };
};

export const remainingRecordingMilliseconds = (usedMilliseconds: number) =>
  Math.max(0, SLP_WEEKLY_RECORDING_LIMIT_MILLISECONDS - usedMilliseconds);
