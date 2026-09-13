import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "@workspace/api-client-react";
import { GetSessionsDashboardResponse } from "../../../lib/api-zod/src/generated/api.ts";
import {
  currentWeekStartKey,
  formatSessionDate,
  formatSessionWeek,
  isCompletedSession,
  isSessionInWeek,
  sessionDateKey,
  sessionServiceLabel,
  sessionSourceLabel,
  sessionStatusLabel,
  sortSessionsByDate,
} from "../src/lib/session-history.ts";

const session = (overrides: Partial<Session>): Session =>
  ({
    id: 1,
    childId: 3,
    serviceRequirementId: 7,
    serviceName: "Speech Therapy",
    serviceType: "individual",
    durationSeconds: 1_800,
    gestalts: [],
    clinicalObservations: "",
    nextSteps: "",
    note: "",
    audioUrl: null,
    createdAt: "2026-09-13T20:00:00.000Z",
    createdBy: "slp-user",
    role: "SLP",
    consent: null,
    sessionMode: "manual",
    sessionStatus: "completed",
    sessionDate: "2026-09-13",
    ...overrides,
  }) as Session;

test("formats date-only session values without shifting the calendar day", () => {
  assert.equal(sessionDateKey("2026-09-13"), "2026-09-13");
  assert.equal(
    formatSessionDate("2026-09-13", { month: "short", day: "numeric" }),
    "Sep 13",
  );
});

test("labels legacy sessions without inventing a current service relationship", () => {
  assert.equal(
    sessionServiceLabel({ serviceName: null, serviceType: null }),
    "Legacy session · service not recorded",
  );
  assert.equal(
    sessionServiceLabel({
      serviceName: "Speech Therapy",
      serviceType: "co_treat_ot",
    }),
    "Co Treat Ot",
  );
});

test("keeps session source separate from delivery status", () => {
  assert.equal(
    sessionSourceLabel(session({ sessionMode: "manual" })),
    "Manual",
  );
  assert.equal(
    sessionSourceLabel(session({ sessionMode: "recorded" })),
    "Recorded",
  );
  assert.equal(
    sessionSourceLabel(session({ makeupForSessionId: 12 })),
    "Makeup",
  );
  assert.equal(
    sessionStatusLabel(session({ sessionStatus: "completed" })),
    "Completed",
  );
  assert.equal(
    sessionStatusLabel(
      session({ sessionMode: "missed", sessionStatus: "missed" }),
    ),
    "Missed",
  );
});

test("formats a valid Monday through Sunday week range", () => {
  assert.equal(formatSessionWeek("2026-09-07"), "Sep 7 – Sep 13");
  assert.equal(
    formatSessionWeek(new Date("2026-09-07T00:00:00.000Z")),
    "Sep 7 – Sep 13",
  );
  assert.equal(formatSessionWeek("not-a-date"), "Week unavailable");
});

test("derives the visible week from the clinician's local calendar", () => {
  assert.equal(
    currentWeekStartKey(new Date(2026, 8, 13, 23, 30)),
    "2026-09-07",
  );
  assert.equal(currentWeekStartKey(new Date(2026, 8, 14, 0, 30)), "2026-09-14");
});

test("dashboard date-only fields remain strings across response validation", () => {
  const dashboard = GetSessionsDashboardResponse.parse({
    requiresReview: [],
    completedSessions: [
      {
        sessionId: 2,
        childId: 3,
        childName: "Student",
        sessionDate: "2026-09-13",
        sessionMode: "manual",
        sessionStatus: "completed",
      },
    ],
    draftDocumentation: [],
    weeklySnapshot: {
      weekStart: "2026-09-07",
      sessionsRecorded: 1,
      awaitingReview: 0,
      draftNotes: 0,
      completedNotes: 1,
    },
  });
  assert.equal(dashboard.weeklySnapshot.weekStart, "2026-09-07");
  assert.equal(dashboard.completedSessions[0]?.sessionDate, "2026-09-13");
});

test("orders history by therapy date and finds only qualifying completions", () => {
  const sessions = [
    session({
      id: 1,
      sessionDate: "2026-09-12",
      createdAt: "2026-09-14T00:00:00.000Z",
    }),
    session({
      id: 2,
      sessionDate: "2026-09-13",
      createdAt: "2026-09-13T00:00:00.000Z",
    }),
    session({
      id: 3,
      sessionDate: "2026-09-14",
      sessionMode: "missed",
      sessionStatus: "missed",
    }),
  ];
  const qualifying = sortSessionsByDate(sessions).filter(isCompletedSession);
  assert.deepEqual(
    qualifying.map((item) => item.id),
    [2, 1],
  );
});

test("weekly membership uses the session date rather than creation time", () => {
  assert.equal(
    isSessionInWeek(
      session({
        sessionDate: "2026-09-13",
        createdAt: "2026-10-01T00:00:00.000Z",
      }),
      "2026-09-07",
    ),
    true,
  );
  assert.equal(
    isSessionInWeek(session({ sessionDate: "2026-09-14" }), "2026-09-07"),
    false,
  );
});
