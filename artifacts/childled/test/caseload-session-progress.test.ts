import assert from "node:assert/strict";
import test from "node:test";
import {
  sessionsAccountedFor,
  sessionRequirementProgress,
} from "../src/lib/caseload-session-progress.ts";

test("accounts for a missed session without claiming therapy was delivered", () => {
  const service = {
    requiredSessions: 27,
    sessionsRemaining: 26,
    sessionsCompleted: 0,
    sessionsMissed: 1,
    minutesCompleted: 0,
  };

  assert.equal(sessionsAccountedFor(service), 1);
  assert.equal(sessionRequirementProgress(service), 4);
  assert.equal(service.sessionsCompleted, 0);
  assert.equal(service.sessionsMissed, 1);
  assert.equal(service.minutesCompleted, 0);
});

test("accounts for delivered and missed sessions together", () => {
  const service = {
    requiredSessions: 27,
    sessionsRemaining: 25,
    sessionsCompleted: 1,
    sessionsMissed: 1,
  };

  assert.equal(sessionsAccountedFor(service), 2);
  assert.equal(sessionRequirementProgress(service), 7);
});

test("keeps delivered-only progress when no sessions were missed", () => {
  const service = {
    requiredSessions: 27,
    sessionsRemaining: 26,
    sessionsCompleted: 1,
    sessionsMissed: 0,
  };

  assert.equal(sessionsAccountedFor(service), 1);
  assert.equal(sessionRequirementProgress(service), 4);
  assert.equal(service.sessionsCompleted, 1);
  assert.equal(service.sessionsMissed, 0);
});

test("does not credit a makeup twice when remaining already includes the absence", () => {
  const service = {
    requiredSessions: 2,
    sessionsRemaining: 1,
    sessionsCompleted: 1,
    sessionsMissed: 1,
  };

  assert.equal(sessionsAccountedFor(service), 1);
  assert.equal(sessionRequirementProgress(service), 50);
});
