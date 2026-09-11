import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";
import {
  childCareTeamMembershipsTable,
  childProfilesTable,
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

test("manual sessions persist goal progress and update IEP service delivery totals", async () => {
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
    return {
      status: response.status,
      body: (await response.json()) as Record<string, any>,
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
      [goal.id],
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
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    if (ids.sessions.length) {
      await db
        .delete(therapySessionGoalProgressTable)
        .where(
          inArray(therapySessionGoalProgressTable.sessionId, ids.sessions),
        );
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
