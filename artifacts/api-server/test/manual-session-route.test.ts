import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";
import {
  childCareTeamMembershipsTable,
  childProfilesTable,
  clinicalKnowledgeAppliedFactsTable,
  clinicalKnowledgeChunksTable,
  clinicalKnowledgeIngestionJobsTable,
  clinicalKnowledgeInsightRunsTable,
  clinicalKnowledgeInsightsTable,
  clinicalKnowledgeSourcesTable,
  clinicalKnowledgeSourceVersionsTable,
  clinicalSoapNotesTable,
  communicationGoalsTable,
  db,
  iepServiceRequirementsTable,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  securityAuditLogsTable,
  therapySessionGoalProgressTable,
  therapySessionsTable,
  usersTable,
} from "@workspace/db";
import router from "../src/routes/childled";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";

test.after(async () => {
  await pool.end();
});

test("manual and recorded sessions share IEP service delivery totals", async () => {
  const suffix = randomUUID();
  const userId = `manual-session-route-${suffix}`;
  const ids = {
    organizations: [] as number[],
    children: [] as number[],
    goals: [] as number[],
    sessions: [] as number[],
  };
  const [organization] = await db
    .insert(organizationsTable)
    .values({ slug: `manual-${suffix}`, name: "Manual session test" })
    .returning();
  assert.ok(organization);
  ids.organizations.push(organization.id);
  await db.insert(usersTable).values({
    id: userId,
    identityProvider: "manual-session-route-test",
    providerSubject: userId,
    displayName: "Manual Session Clinician",
  });
  await db.insert(organizationMembershipsTable).values({
    organizationId: organization.id,
    userId,
    role: "clinician",
  });
  const [child] = await db
    .insert(childProfilesTable)
    .values({
      organizationId: organization.id,
      displayName: "Manual session child",
    })
    .returning();
  assert.ok(child);
  ids.children.push(child.id);
  await db.insert(childCareTeamMembershipsTable).values({
    childId: child.id,
    userId,
    role: "clinician",
  });
  const [goal] = await db
    .insert(communicationGoalsTable)
    .values({
      organizationId: organization.id,
      childId: child.id,
      title: "Functional requesting",
      goalArea: "Expressive communication",
      description: "Request preferred activities with available communication.",
      startDate: "2026-09-01",
      targetDate: "2027-01-01",
      createdByUserId: userId,
      updatedByUserId: userId,
    })
    .returning();
  assert.ok(goal);
  ids.goals.push(goal.id);
  const additionalGoals = await db
    .insert(communicationGoalsTable)
    .values([
      {
        organizationId: organization.id,
        childId: child.id,
        title: "WH questions",
        goalArea: "Receptive communication",
        description:
          "Respond to familiar WH questions during shared activities.",
        startDate: "2026-09-01",
        createdByUserId: userId,
        updatedByUserId: userId,
      },
      {
        organizationId: organization.id,
        childId: child.id,
        title: "Peer interaction",
        goalArea: "Social communication",
        description: "Initiate a familiar interaction with a peer.",
        startDate: "2026-09-01",
        createdByUserId: userId,
        updatedByUserId: userId,
      },
      {
        organizationId: organization.id,
        childId: child.id,
        title: "Archived language goal",
        goalArea: "Expressive communication",
        description: "An archived goal must not appear in session review.",
        status: "archived",
        startDate: "2026-01-01",
        archivedAt: new Date(),
        archivedByUserId: userId,
        createdByUserId: userId,
        updatedByUserId: userId,
      },
    ])
    .returning();
  assert.equal(additionalGoals.length, 3);
  ids.goals.push(...additionalGoals.map((item) => item.id));
  const whGoal = additionalGoals[0]!;
  const notAddressedGoal = additionalGoals[1]!;
  const archivedGoal = additionalGoals[2]!;

  const [unassignedChild] = await db
    .insert(childProfilesTable)
    .values({
      organizationId: organization.id,
      displayName: "Unassigned goal child",
    })
    .returning();
  assert.ok(unassignedChild);
  ids.children.push(unassignedChild.id);
  const [unrelatedGoal] = await db
    .insert(communicationGoalsTable)
    .values({
      organizationId: organization.id,
      childId: unassignedChild.id,
      title: "Unrelated child goal",
      goalArea: "Expressive communication",
      description: "Must not attach to another child's session.",
      startDate: "2026-09-01",
      createdByUserId: userId,
      updatedByUserId: userId,
    })
    .returning();
  assert.ok(unrelatedGoal);
  ids.goals.push(unrelatedGoal.id);

  let actor: ResolvedCareTeamActor = {
    userId,
    author: "Manual Session Clinician",
    role: "SLP",
    childIds: [child.id],
    isAdmin: false,
    organizationId: organization.id,
    expiresAt: Date.now() + 60_000,
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.childledActor = actor;
    next();
  });
  app.use(router);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const value = app.listen(0, () => resolve(value));
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${base}${path}`, init);
    const responseText = await response.text();
    return {
      status: response.status,
      body: responseText
        ? (JSON.parse(responseText) as Record<string, any>)
        : ({} as Record<string, any>),
    };
  };
  const json = (method: string, path: string, body: Record<string, unknown>) =>
    request(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  try {
    actor = { ...actor, role: "Parent" };
    assert.equal(
      (await request(`/manual-sessions/setup?childId=${child.id}`)).status,
      403,
    );
    assert.equal(
      (
        await json("PUT", `/caseload-service-settings?childId=${child.id}`, {
          primaryServiceDeliveryType: "consult",
        })
      ).status,
      403,
    );

    actor = { ...actor, role: "SLP" };
    const setup = await request(`/manual-sessions/setup?childId=${child.id}`);
    assert.equal(setup.status, 200);
    assert.deepEqual(
      setup.body.goals.map((item: { id: number }) => item.id),
      [goal.id, whGoal.id, notAddressedGoal.id],
    );
    assert.equal(
      setup.body.goals.some(
        (item: { id: number }) => item.id === archivedGoal.id,
      ),
      false,
    );

    const serviceSettings = await json(
      "PUT",
      `/caseload-service-settings?childId=${child.id}`,
      { primaryServiceDeliveryType: "group" },
    );
    assert.equal(serviceSettings.status, 200);
    assert.equal(serviceSettings.body.primaryServiceDeliveryType, "group");

    const requirement = await json(
      "PUT",
      `/iep-service-requirements?childId=${child.id}`,
      {
        serviceType: "individual",
        requiredSessions: 2,
        requiredMinutes: 60,
        sessionDurationMinutes: 30,
        period: "custom",
        customFrequencyDescription: "September reporting period",
        effectiveFrom: "2026-09-01",
        effectiveTo: "2026-09-30",
      },
    );
    assert.equal(requirement.status, 200);
    assert.equal(requirement.body.sessionsCompleted, 0);
    assert.equal(requirement.body.minutesCompleted, 0);

    const coTreatRequirement = await json(
      "PUT",
      `/iep-service-requirements?childId=${child.id}`,
      {
        serviceType: "co_treat_ot",
        requiredSessions: 1,
        requiredMinutes: 30,
        sessionDurationMinutes: 30,
        period: "custom",
        customFrequencyDescription: "September OT co-treatment",
        effectiveFrom: "2026-09-01",
        effectiveTo: "2026-09-30",
      },
    );
    assert.equal(coTreatRequirement.status, 200);

    const nextPeriod = await json(
      "PUT",
      `/iep-service-requirements?childId=${child.id}`,
      {
        serviceType: "individual",
        requiredSessions: 8,
        requiredMinutes: 240,
        sessionDurationMinutes: 30,
        period: "custom",
        customFrequencyDescription: "October reporting period",
        effectiveFrom: "2026-10-01",
        effectiveTo: "2026-10-31",
      },
    );
    assert.equal(nextPeriod.status, 200);
    const savedPeriods = await db
      .select({ id: iepServiceRequirementsTable.id })
      .from(iepServiceRequirementsTable)
      .where(eq(iepServiceRequirementsTable.childId, child.id));
    assert.equal(savedPeriods.length, 3);

    const wrongPeriod = await json(
      "POST",
      `/manual-sessions?childId=${child.id}`,
      {
        serviceRequirementId: nextPeriod.body.id,
        sessionDate: "2026-09-10",
        startedAt: null,
        endedAt: null,
        durationSeconds: 1_800,
        timerElapsedSeconds: 0,
        durationSource: "manual",
        durationEdited: false,
        goals: [
          {
            goalId: goal.id,
            accuracyPercent: 80,
            successfulAttempts: null,
            totalAttempts: null,
            promptingLevel: null,
            progressNote: "Valid progress for the wrong service period.",
          },
        ],
        note: "This should not be saved outside the service date range.",
      },
    );
    assert.equal(wrongPeriod.status, 400);

    const invalid = await json("POST", `/manual-sessions?childId=${child.id}`, {
      serviceRequirementId: requirement.body.id,
      sessionDate: "2026-09-10",
      startedAt: null,
      endedAt: null,
      durationSeconds: 1_800,
      timerElapsedSeconds: 0,
      durationSource: "manual",
      durationEdited: false,
      goals: [
        {
          goalId: goal.id,
          accuracyPercent: null,
          successfulAttempts: 8,
          totalAttempts: 5,
          promptingLevel: null,
          progressNote: "",
        },
      ],
      note: "Invalid attempts should not save.",
    });
    assert.equal(invalid.status, 400);

    const saved = await json("POST", `/manual-sessions?childId=${child.id}`, {
      serviceRequirementId: requirement.body.id,
      sessionDate: "2026-09-10",
      startedAt: "2026-09-10T14:00:00.000Z",
      endedAt: "2026-09-10T14:27:00.000Z",
      durationSeconds: 1_800,
      timerElapsedSeconds: 1_620,
      durationSource: "timer_edited",
      durationEdited: true,
      goals: [
        {
          goalId: goal.id,
          accuracyPercent: 80,
          successfulAttempts: 8,
          totalAttempts: 10,
          promptingLevel: "minimal",
          progressNote: "Requested during structured play.",
        },
      ],
      note: "Participated in structured and child-led activities.",
    });
    assert.equal(saved.status, 201);
    ids.sessions.push(saved.body.id);
    assert.equal(saved.body.sessionMode, "manual");
    assert.equal(saved.body.serviceRequirementId, requirement.body.id);
    assert.equal(saved.body.durationSource, "timer_edited");
    assert.equal(saved.body.durationEdited, true);
    assert.equal(saved.body.goalProgress[0].goalTitle, goal.title);

    const history = await request(`/sessions?childId=${child.id}`);
    assert.equal(history.status, 200);
    const historySession = history.body.find(
      (session: { id: number }) => session.id === saved.body.id,
    );
    assert.equal(historySession.sessionMode, "manual");
    assert.equal(historySession.slpName, "Manual Session Clinician");
    assert.equal(historySession.goalProgress[0].successfulAttempts, 8);

    const updatedSetup = await request(
      `/manual-sessions/setup?childId=${child.id}`,
    );
    assert.equal(updatedSetup.status, 200);
    const updatedIndividual = updatedSetup.body.serviceRequirements.find(
      (service: { id: number }) => service.id === requirement.body.id,
    );
    const updatedCoTreat = updatedSetup.body.serviceRequirements.find(
      (service: { id: number }) => service.id === coTreatRequirement.body.id,
    );
    assert.equal(updatedIndividual.sessionsCompleted, 1);
    assert.equal(updatedIndividual.sessionsRemaining, 1);
    assert.equal(updatedIndividual.minutesCompleted, 30);
    assert.equal(updatedIndividual.minutesRemaining, 30);
    assert.equal(updatedCoTreat.sessionsCompleted, 0);
    assert.equal(updatedCoTreat.sessionsRemaining, 1);

    const overview = await request("/clinician-overview");
    assert.equal(overview.status, 200);
    const overviewChild = overview.body.children.find(
      (item: { childId: number }) => item.childId === child.id,
    );
    assert.ok(overviewChild);
    assert.equal(overviewChild.serviceRequirements.length, 2);
    const overviewIndividual = overviewChild.serviceRequirements.find(
      (service: { id: number }) => service.id === requirement.body.id,
    );
    const overviewCoTreat = overviewChild.serviceRequirements.find(
      (service: { id: number }) => service.id === coTreatRequirement.body.id,
    );
    assert.equal(overviewIndividual.sessionsCompleted, 1);
    assert.equal(overviewIndividual.sessionsRemaining, 1);
    assert.equal(overviewIndividual.minutesCompleted, 30);
    assert.equal(overviewIndividual.minutesRemaining, 30);
    assert.equal(overviewCoTreat.sessionsCompleted, 0);
    assert.equal(overviewChild.primaryServiceDeliveryType, "group");
    assert.equal(overviewChild.lastSessionDate, "2026-09-10");
    assert.deepEqual(overviewChild.teacherNames, []);
    assert.equal(overviewChild.nextSessionDate, null);

    const recordedBody = {
      serviceRequirementId: requirement.body.id,
      durationSeconds: 1_800,
      gestalts: [],
      clinicalObservations: "Participated in structured play.",
      nextSteps: "Continue familiar requesting opportunities.",
      note: "Finalized recorded session with clinician-reviewed goal progress.",
      audioId: null,
      transcriptionId: null,
      calibrationAudioIds: [],
      consentConfirmed: true,
      consentConfirmedAt: new Date().toISOString(),
    };
    const duplicateReview = await json(
      "POST",
      `/sessions?childId=${child.id}`,
      {
        ...recordedBody,
        goalReviews: [
          {
            goalId: goal.id,
            progressStatus: "progressed",
            promptingLevel: "minimal",
            comments: "First copy.",
          },
          {
            goalId: goal.id,
            progressStatus: "regressed",
            promptingLevel: "moderate",
            comments: "Duplicate copy.",
          },
        ],
      },
    );
    assert.equal(duplicateReview.status, 400);

    const unrelatedReview = await json(
      "POST",
      `/sessions?childId=${child.id}`,
      {
        ...recordedBody,
        goalReviews: [
          {
            goalId: unrelatedGoal.id,
            progressStatus: "progressed",
            promptingLevel: "minimal",
            comments: "Must be rejected.",
          },
        ],
      },
    );
    assert.equal(unrelatedReview.status, 400);

    const archivedReview = await json("POST", `/sessions?childId=${child.id}`, {
      ...recordedBody,
      goalReviews: [
        {
          goalId: archivedGoal.id,
          progressStatus: "progressed",
          promptingLevel: "minimal",
          comments: "Archived goals must be rejected.",
        },
      ],
    });
    assert.equal(archivedReview.status, 400);

    const progressBeforeFinalization = await db
      .select()
      .from(therapySessionGoalProgressTable)
      .where(eq(therapySessionGoalProgressTable.childId, child.id));
    assert.equal(progressBeforeFinalization.length, 1);

    const recordedSession = await json(
      "POST",
      `/sessions?childId=${child.id}`,
      {
        ...recordedBody,
        goalReviews: [
          {
            goalId: goal.id,
            progressStatus: "progressed",
            promptingLevel: "minimal",
            comments: "Requested during structured play.",
          },
          {
            goalId: whGoal.id,
            progressStatus: "goal_met",
            promptingLevel: "independent",
            comments: "Responded independently across familiar activities.",
          },
        ],
      },
    );
    assert.equal(recordedSession.status, 201);
    ids.sessions.push(recordedSession.body.id);
    assert.equal(recordedSession.body.goalProgress.length, 2);
    assert.equal(
      recordedSession.body.goalProgress[0].progressStatus,
      "progressed",
    );
    assert.equal(
      recordedSession.body.goalProgress[0].promptingLevel,
      "minimal",
    );
    assert.equal(
      recordedSession.body.goalProgress[1].progressStatus,
      "goal_met",
    );
    assert.equal(
      recordedSession.body.goalProgress[1].promptingLevel,
      "independent",
    );
    assert.equal(
      recordedSession.body.goalProgress.some(
        (entry: { goalId: number }) => entry.goalId === notAddressedGoal.id,
      ),
      false,
    );
    const goalStatuses = await db
      .select({
        id: communicationGoalsTable.id,
        status: communicationGoalsTable.status,
      })
      .from(communicationGoalsTable)
      .where(inArray(communicationGoalsTable.id, [goal.id, whGoal.id]));
    assert.ok(goalStatuses.every((entry) => entry.status === "active"));

    const generatedNote = await request(
      `/session-soap-note?childId=${child.id}&sessionId=${recordedSession.body.id}`,
    );
    assert.equal(generatedNote.status, 200);
    assert.match(
      generatedNote.body.content.objective,
      /Functional requesting: Progressed with minimal prompting/,
    );
    assert.match(
      generatedNote.body.content.objective,
      /WH questions: Goal Met with independent prompting/,
    );
    assert.doesNotMatch(
      generatedNote.body.content.objective,
      /Peer interaction/,
    );

    const setupWithRecordedSession = await request(
      `/manual-sessions/setup?childId=${child.id}`,
    );
    const combinedIndividual =
      setupWithRecordedSession.body.serviceRequirements.find(
        (service: { id: number }) => service.id === requirement.body.id,
      );
    assert.equal(combinedIndividual.sessionsCompleted, 2);
    assert.equal(combinedIndividual.sessionsRemaining, 0);
    assert.equal(combinedIndividual.minutesCompleted, 60);
    assert.equal(combinedIndividual.minutesRemaining, 0);

    const overviewWithRecordedSession = await request("/clinician-overview");
    const overviewChildWithRecordedSession =
      overviewWithRecordedSession.body.children.find(
        (item: { childId: number }) => item.childId === child.id,
      );
    const overviewCombinedIndividual =
      overviewChildWithRecordedSession.serviceRequirements.find(
        (service: { id: number }) => service.id === requirement.body.id,
      );
    assert.equal(overviewCombinedIndividual.sessionsCompleted, 2);
    assert.equal(overviewCombinedIndividual.sessionsRemaining, 0);
    assert.equal(
      overviewChildWithRecordedSession.lastSessionDate,
      "2026-09-12",
    );

    await db
      .update(therapySessionsTable)
      .set({ archivedAt: new Date("2026-09-12T12:00:00.000Z") })
      .where(eq(therapySessionsTable.id, recordedSession.body.id));
    const setupAfterRecordedSessionArchive = await request(
      `/manual-sessions/setup?childId=${child.id}`,
    );
    const recalculatedIndividual =
      setupAfterRecordedSessionArchive.body.serviceRequirements.find(
        (service: { id: number }) => service.id === requirement.body.id,
      );
    assert.equal(recalculatedIndividual.sessionsCompleted, 1);
    assert.equal(recalculatedIndividual.sessionsRemaining, 1);
    assert.equal(recalculatedIndividual.sessionsMissed, 0);
    assert.equal(recalculatedIndividual.outstandingMakeups, 0);

    actor = { ...actor, role: "Parent" };
    const unauthorizedMiss = await json(
      "POST",
      `/missed-sessions?childId=${child.id}`,
      {
        serviceRequirementId: requirement.body.id,
        sessionDate: "2026-09-11",
        missedReason: "student_absent",
        missedReasonDetail: null,
        note: "Should not save for a parent account.",
        makeupStatus: "needed",
      },
    );
    assert.equal(unauthorizedMiss.status, 403);

    actor = { ...actor, role: "SLP" };
    const missed = await json("POST", `/missed-sessions?childId=${child.id}`, {
      serviceRequirementId: requirement.body.id,
      sessionDate: "2026-09-11",
      missedReason: "student_absent",
      missedReasonDetail: null,
      note: "Student was absent for the scheduled session.",
      makeupStatus: "needed",
    });
    assert.equal(missed.status, 201);
    ids.sessions.push(missed.body.id);
    assert.equal(missed.body.makeupStatus, "needed");

    actor = { ...actor, role: "Parent" };
    const unauthorizedMissUpdate = await json(
      "PATCH",
      `/missed-sessions/${missed.body.id}`,
      {
        sessionDate: "2026-09-11",
        missedReason: "student_absent",
        missedReasonDetail: null,
        note: "A parent cannot change clinical makeup tracking.",
        makeupStatus: "not_required",
      },
    );
    assert.equal(unauthorizedMissUpdate.status, 403);
    actor = { ...actor, role: "SLP" };

    const setupWithMissed = await request(
      `/manual-sessions/setup?childId=${child.id}`,
    );
    const individualWithMissed = setupWithMissed.body.serviceRequirements.find(
      (service: { id: number }) => service.id === requirement.body.id,
    );
    assert.equal(individualWithMissed.sessionsCompleted, 1);
    assert.equal(individualWithMissed.sessionsMissed, 1);
    assert.equal(individualWithMissed.sessionsRemaining, 0);
    assert.equal(individualWithMissed.outstandingMakeups, 1);
    assert.equal(individualWithMissed.minutesCompleted, 30);

    const makeup = await json("POST", `/manual-sessions?childId=${child.id}`, {
      serviceRequirementId: requirement.body.id,
      makeupForSessionId: missed.body.id,
      sessionDate: "2026-09-12",
      startedAt: null,
      endedAt: null,
      durationSeconds: 1_800,
      timerElapsedSeconds: 0,
      durationSource: "manual",
      durationEdited: false,
      goals: [
        {
          goalId: goal.id,
          accuracyPercent: 90,
          successfulAttempts: 9,
          totalAttempts: 10,
          promptingLevel: "independent",
          progressNote: "Progress recorded during the makeup session.",
        },
      ],
      note: "Completed makeup for the September 11 absence.",
    });
    assert.equal(makeup.status, 201);
    ids.sessions.push(makeup.body.id);
    assert.equal(makeup.body.makeupForSessionId, missed.body.id);
    assert.equal(makeup.body.makeupForSessionDate.slice(0, 10), "2026-09-11");

    const setupAfterMakeup = await request(
      `/manual-sessions/setup?childId=${child.id}`,
    );
    const individualAfterMakeup =
      setupAfterMakeup.body.serviceRequirements.find(
        (service: { id: number }) => service.id === requirement.body.id,
      );
    assert.equal(individualAfterMakeup.sessionsCompleted, 2);
    assert.equal(individualAfterMakeup.sessionsMissed, 1);
    assert.equal(individualAfterMakeup.sessionsRemaining, 0);
    assert.equal(individualAfterMakeup.outstandingMakeups, 0);
    assert.equal(individualAfterMakeup.minutesCompleted, 60);

    const missedHistory = await request(
      `/missed-sessions?childId=${child.id}&serviceRequirementId=${requirement.body.id}`,
    );
    assert.equal(missedHistory.status, 200);
    const completedMiss = missedHistory.body.find(
      (session: { id: number }) => session.id === missed.body.id,
    );
    assert.equal(completedMiss.makeupStatus, "completed");
    assert.equal(completedMiss.makeupSessionId, makeup.body.id);

    const duplicateMakeup = await json(
      "POST",
      `/manual-sessions?childId=${child.id}`,
      {
        serviceRequirementId: requirement.body.id,
        makeupForSessionId: missed.body.id,
        sessionDate: "2026-09-13",
        startedAt: null,
        endedAt: null,
        durationSeconds: 1_800,
        timerElapsedSeconds: 0,
        durationSource: "manual",
        durationEdited: false,
        goals: [
          {
            goalId: goal.id,
            accuracyPercent: 90,
            successfulAttempts: null,
            totalAttempts: null,
            promptingLevel: null,
            progressNote: "This duplicate should be rejected.",
          },
        ],
        note: "Duplicate makeup.",
      },
    );
    assert.equal(duplicateMakeup.status, 409);

    const unifiedHistory = await request(`/sessions?childId=${child.id}`);
    const missedHistoryRow = unifiedHistory.body.find(
      (session: { id: number }) => session.id === missed.body.id,
    );
    const makeupHistoryRow = unifiedHistory.body.find(
      (session: { id: number }) => session.id === makeup.body.id,
    );
    assert.equal(missedHistoryRow.sessionStatus, "missed");
    assert.equal(missedHistoryRow.missedReason, "student_absent");
    assert.equal(missedHistoryRow.makeupStatus, "completed");
    assert.equal(makeupHistoryRow.sessionStatus, "completed");
    assert.equal(makeupHistoryRow.makeupForSessionId, missed.body.id);

    actor = { ...actor, role: "Parent" };
    const unauthorizedArchive = await request(
      `/children/${child.id}/iep-services/${requirement.body.id}`,
      { method: "DELETE" },
    );
    assert.equal(unauthorizedArchive.status, 403);

    actor = { ...actor, role: "SLP" };
    const archived = await request(
      `/children/${child.id}/iep-services/${requirement.body.id}`,
      { method: "DELETE" },
    );
    assert.equal(archived.status, 204);
    const setupAfterArchive = await request(
      `/manual-sessions/setup?childId=${child.id}`,
    );
    assert.equal(
      setupAfterArchive.body.serviceRequirements.some(
        (service: { id: number }) => service.id === requirement.body.id,
      ),
      false,
    );
    const historyAfterArchive = await request(`/sessions?childId=${child.id}`);
    const retainedSession = historyAfterArchive.body.find(
      (session: { id: number }) => session.id === saved.body.id,
    );
    assert.equal(retainedSession.serviceRequirementId, requirement.body.id);
    assert.equal(retainedSession.serviceName, "Individual");
    const [archivedRow] = await db
      .select({ status: iepServiceRequirementsTable.status })
      .from(iepServiceRequirementsTable)
      .where(eq(iepServiceRequirementsTable.id, requirement.body.id));
    assert.equal(archivedRow?.status, "archived");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const runs = await db
        .select({ status: clinicalKnowledgeInsightRunsTable.status })
        .from(clinicalKnowledgeInsightRunsTable)
        .where(eq(clinicalKnowledgeInsightRunsTable.childId, child.id));
      if (
        !runs.length ||
        runs.every(
          (run) => run.status === "completed" || run.status === "failed",
        )
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await db
      .delete(clinicalKnowledgeInsightsTable)
      .where(eq(clinicalKnowledgeInsightsTable.childId, child.id));
    await db
      .delete(clinicalKnowledgeAppliedFactsTable)
      .where(eq(clinicalKnowledgeAppliedFactsTable.childId, child.id));
    await db
      .delete(clinicalKnowledgeInsightRunsTable)
      .where(eq(clinicalKnowledgeInsightRunsTable.childId, child.id));
    await db
      .delete(clinicalSoapNotesTable)
      .where(eq(clinicalSoapNotesTable.childId, child.id));
    const knowledgeSources = await db
      .select({ id: clinicalKnowledgeSourcesTable.id })
      .from(clinicalKnowledgeSourcesTable)
      .where(eq(clinicalKnowledgeSourcesTable.organizationId, organization.id));
    if (knowledgeSources.length) {
      const sourceIds = knowledgeSources.map((source) => source.id);
      const sourceVersions = await db
        .select({ id: clinicalKnowledgeSourceVersionsTable.id })
        .from(clinicalKnowledgeSourceVersionsTable)
        .where(
          inArray(clinicalKnowledgeSourceVersionsTable.sourceId, sourceIds),
        );
      if (sourceVersions.length) {
        const versionIds = sourceVersions.map((version) => version.id);
        await db
          .delete(clinicalKnowledgeIngestionJobsTable)
          .where(
            inArray(
              clinicalKnowledgeIngestionJobsTable.sourceVersionId,
              versionIds,
            ),
          );
        await db
          .delete(clinicalKnowledgeChunksTable)
          .where(
            inArray(clinicalKnowledgeChunksTable.sourceVersionId, versionIds),
          );
        await db
          .delete(clinicalKnowledgeSourceVersionsTable)
          .where(inArray(clinicalKnowledgeSourceVersionsTable.id, versionIds));
      }
      await db
        .delete(clinicalKnowledgeSourcesTable)
        .where(inArray(clinicalKnowledgeSourcesTable.id, sourceIds));
    }
    if (ids.sessions.length) {
      await db
        .delete(therapySessionGoalProgressTable)
        .where(
          inArray(therapySessionGoalProgressTable.sessionId, ids.sessions),
        );
      await db
        .update(therapySessionsTable)
        .set({ makeupForSessionId: null })
        .where(inArray(therapySessionsTable.id, ids.sessions));
      await db
        .delete(therapySessionsTable)
        .where(inArray(therapySessionsTable.id, ids.sessions));
    }
    await db
      .delete(iepServiceRequirementsTable)
      .where(eq(iepServiceRequirementsTable.childId, child.id));
    await db
      .delete(communicationGoalsTable)
      .where(inArray(communicationGoalsTable.id, ids.goals));
    await db
      .delete(securityAuditLogsTable)
      .where(eq(securityAuditLogsTable.userId, userId));
    await db
      .delete(childCareTeamMembershipsTable)
      .where(inArray(childCareTeamMembershipsTable.childId, ids.children));
    await db
      .delete(childProfilesTable)
      .where(inArray(childProfilesTable.id, ids.children));
    await db
      .delete(organizationMembershipsTable)
      .where(eq(organizationMembershipsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await db
      .delete(organizationsTable)
      .where(inArray(organizationsTable.id, ids.organizations));
  }
});
