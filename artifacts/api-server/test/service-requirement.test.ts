import assert from "node:assert/strict";
import test from "node:test";
import {
  serviceDeliveryStatus,
  servicePeriodWindow,
} from "../src/lib/service-requirement";

test("uses Monday through Sunday for weekly service periods", () => {
  const window = servicePeriodWindow(
    "weekly",
    new Date("2026-09-10T12:00:00.000Z"),
  );

  assert.equal(window.start, "2026-09-07");
  assert.equal(window.end, "2026-09-13");
  assert.equal(window.endExclusive, "2026-09-14");
  assert.equal(window.label, "Week of Sep 7");
});

test("uses the calendar month for monthly service periods", () => {
  const window = servicePeriodWindow(
    "monthly",
    new Date("2026-09-10T12:00:00.000Z"),
  );

  assert.equal(window.start, "2026-09-01");
  assert.equal(window.end, "2026-09-30");
  assert.equal(window.endExclusive, "2026-10-01");
  assert.equal(window.label, "September 2026");
});

test("uses explicit dates for custom service periods", () => {
  const window = servicePeriodWindow(
    "custom",
    new Date("2026-09-15T12:00:00.000Z"),
    { effectiveFrom: "2026-09-01", effectiveTo: "2026-10-31" },
  );

  assert.equal(window.start, "2026-09-01");
  assert.equal(window.end, "2026-10-31");
  assert.equal(window.endExclusive, "2026-11-01");
  assert.equal(window.label, "Sep 1, 2026 - Oct 31, 2026");
  assert.ok(window.progress > 0 && window.progress < 1);
});

test("uses calendar quarters and years for longer service periods", () => {
  const current = new Date("2026-09-10T12:00:00.000Z");
  const quarter = servicePeriodWindow("quarterly", current);
  const year = servicePeriodWindow("yearly", current);

  assert.equal(quarter.start, "2026-07-01");
  assert.equal(quarter.end, "2026-09-30");
  assert.equal(quarter.label, "Q3 2026");
  assert.equal(year.start, "2026-01-01");
  assert.equal(year.end, "2026-12-31");
  assert.equal(year.label, "2026");
});

test("marks service delivery complete only when sessions and minutes are met", () => {
  assert.equal(
    serviceDeliveryStatus({
      requiredSessions: 8,
      requiredMinutes: 240,
      sessionsCompleted: 8,
      minutesCompleted: 240,
      periodProgress: 0.5,
    }).status,
    "complete",
  );
  assert.equal(
    serviceDeliveryStatus({
      requiredSessions: 8,
      requiredMinutes: 240,
      sessionsCompleted: 8,
      minutesCompleted: 220,
      periodProgress: 0.5,
    }).status,
    "on_track",
  );
});

test("marks a small pacing gap as needing attention", () => {
  const result = serviceDeliveryStatus({
    requiredSessions: 8,
    requiredMinutes: 240,
    sessionsCompleted: 3,
    minutesCompleted: 100,
    periodProgress: 0.5,
  });

  assert.equal(result.status, "needs_attention");
  assert.equal(result.sessionsRemaining, 5);
  assert.equal(result.minutesRemaining, 140);
});

test("marks a material pacing gap as behind", () => {
  assert.equal(
    serviceDeliveryStatus({
      requiredSessions: 8,
      requiredMinutes: 240,
      sessionsCompleted: 1,
      minutesCompleted: 30,
      periodProgress: 0.75,
    }).status,
    "behind",
  );
});
