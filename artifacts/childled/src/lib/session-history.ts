import type { Session } from "@workspace/api-client-react";

type DateValue = string | Date | null | undefined;

export const sessionDateKey = (value: DateValue) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, 10);
  }

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12);
    return parsed.getFullYear() === Number(year) &&
      parsed.getMonth() === Number(month) - 1 &&
      parsed.getDate() === Number(day)
      ? `${year}-${month}-${day}`
      : null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
};

const calendarDate = (value: DateValue) => {
  const key = sessionDateKey(value);
  if (!key) return null;
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

export const formatSessionDate = (
  value: DateValue,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  },
) => {
  const parsed = calendarDate(value);
  return parsed
    ? parsed.toLocaleDateString("en-US", options)
    : "Date unavailable";
};

export const formatSessionWeek = (weekStart: DateValue) => {
  const start = calendarDate(weekStart);
  if (!start) return "Week unavailable";
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const format = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${format(start)} – ${format(end)}`;
};

export const currentWeekStartKey = (today = new Date()) => {
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    12,
  );
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const isCompletedSession = (
  session: Pick<Session, "sessionMode" | "sessionStatus">,
) => session.sessionStatus === "completed" && session.sessionMode !== "missed";

export const sortSessionsByDate = (sessions: Session[]) =>
  [...sessions].sort((left, right) => {
    const dateOrder = (
      sessionDateKey(right.sessionDate ?? right.createdAt) ?? ""
    ).localeCompare(sessionDateKey(left.sessionDate ?? left.createdAt) ?? "");
    return dateOrder || right.id - left.id;
  });

export const isSessionInWeek = (session: Session, weekStart: DateValue) => {
  const startKey = sessionDateKey(weekStart);
  const sessionKey = sessionDateKey(session.sessionDate ?? session.createdAt);
  if (!startKey || !sessionKey) return false;
  const start = calendarDate(startKey)!;
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const endKey = sessionDateKey(end)!;
  return sessionKey >= startKey && sessionKey <= endKey;
};

export const sessionSourceLabel = (
  session: Pick<Session, "makeupForSessionId" | "sessionMode">,
) =>
  session.makeupForSessionId
    ? "Makeup"
    : session.sessionMode === "recorded"
      ? "Recorded"
      : "Manual";

export const sessionStatusLabel = (session: Pick<Session, "sessionStatus">) =>
  session.sessionStatus === "missed"
    ? "Missed"
    : session.sessionStatus === "scheduled"
      ? "Scheduled"
      : "Completed";

export const sessionServiceLabel = (
  session: Pick<Session, "serviceName" | "serviceType">,
) => {
  const value = session.serviceType ?? session.serviceName;
  if (!value) return "Legacy session · service not recorded";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};
