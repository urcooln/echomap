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

test("marks service delivery behind when either measure trails period progress", () => {
  const result = serviceDeliveryStatus({
    requiredSessions: 8,
    requiredMinutes: 240,
    sessionsCompleted: 5,
    minutesCompleted: 100,
    periodProgress: 0.5,
  });

  assert.equal(result.status, "behind");
  assert.equal(result.sessionsRemaining, 3);
  assert.equal(result.minutesRemaining, 140);
});
