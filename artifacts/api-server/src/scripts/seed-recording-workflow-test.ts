import { and, eq, isNull } from "drizzle-orm";
import {
  childCareTeamMembershipsTable,
  childProfilesTable,
  communicationGoalHistoryTable,
  communicationGoalsTable,
  db,
  iepServiceRequirementsTable,
  pool,
} from "@workspace/db";
import { seedDevelopmentDemo } from "../lib/development-demo";
import { DEVELOPMENT_DEMO_PERSONAS } from "../lib/development-demo-personas";

const fixtureName = "Avery Morgan (Recording Test)";
const fixtureKey = "CL-003-CL-004";
const goals = [
  {
    title: "Request a preferred item",
    goalArea: "Functional requesting",
    description:
      "During a play routine, Avery will request a preferred item using speech or AAC in 4 of 5 observed opportunities, with no more than one verbal prompt.",
  },
  {
    title: "Request help with a task",
    goalArea: "Self-advocacy",
    description:
      "When a task is difficult, Avery will request help using speech or AAC in 4 of 5 observed opportunities, with no more than one verbal prompt.",
  },
  {
    title: "Communicate a need for a break",
    goalArea: "Self-advocacy",
    description:
      "During a transition or challenging activity, Avery will communicate a need for a break using speech or AAC in 4 of 5 observed opportunities, with no more than one verbal prompt.",
  },
] as const;

const databaseUrl = process.env.DATABASE_URL;
if (
  process.env.NODE_ENV === "production" ||
  process.env.CHILDLED_ENABLE_DEMO_LOGIN !== "true" ||
  !databaseUrl ||
  !["localhost", "127.0.0.1", "::1"].includes(new URL(databaseUrl).hostname)
) {
  throw new Error("Recording test data may only be seeded in a local development demo database.");
}

try {
  const { organizationId } = await seedDevelopmentDemo();
  const clinicianId = DEVELOPMENT_DEMO_PERSONAS.SLP.id;
  const today = new Date();
  const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 7))
    .toISOString().slice(0, 10);
  const endDate = new Date(Date.UTC(today.getUTCFullYear() + 1, today.getUTCMonth(), today.getUTCDate()))
    .toISOString().slice(0, 10);

  const seeded = await db.transaction(async (tx) => {
    const existing = await tx.select().from(childProfilesTable).where(and(
      eq(childProfilesTable.organizationId, organizationId),
      eq(childProfilesTable.displayName, fixtureName),
      isNull(childProfilesTable.archivedAt),
    ));
    if (existing.length > 1) throw new Error("Multiple active recording test profiles exist; refusing to guess which one to use.");
    if (existing[0] && existing[0].profileDetails.testFixture !== fixtureKey) {
      throw new Error("A student with the recording test name already exists but is not this fixture.");
    }
    const [child] = existing.length ? existing : await tx.insert(childProfilesTable).values({
      organizationId,
      displayName: fixtureName,
      firstName: "Avery",
      lastName: "Morgan",
      school: "ChildLed Test School",
      grade: "2nd grade",
      profileDetails: { testFixture: fixtureKey, syntheticData: true },
    }).returning();
    if (!child) throw new Error("Could not create the recording test student.");

    await tx.insert(childCareTeamMembershipsTable).values({
      childId: child.id,
      userId: clinicianId,
      role: "clinician",
      active: true,
    }).onConflictDoUpdate({
      target: [childCareTeamMembershipsTable.childId, childCareTeamMembershipsTable.userId],
      set: { role: "clinician", active: true, updatedAt: new Date() },
    });

    const services = await tx.select().from(iepServiceRequirementsTable).where(and(
      eq(iepServiceRequirementsTable.organizationId, organizationId),
      eq(iepServiceRequirementsTable.childId, child.id),
      eq(iepServiceRequirementsTable.status, "active"),
    ));
    if (!services.length) {
      await tx.insert(iepServiceRequirementsTable).values({
        organizationId,
        childId: child.id,
        serviceType: "individual",
        serviceName: "Individual",
        normalizedServiceName: "individual",
        requiredSessions: 2,
        requiredMinutes: 60,
        sessionDurationMinutes: 30,
        period: "weekly",
        effectiveFrom: startDate,
        effectiveTo: endDate,
        createdByUserId: clinicianId,
        updatedByUserId: clinicianId,
      });
    }

    const existingGoals = await tx.select().from(communicationGoalsTable).where(and(
      eq(communicationGoalsTable.organizationId, organizationId),
      eq(communicationGoalsTable.childId, child.id),
      eq(communicationGoalsTable.status, "active"),
    ));
    for (const goal of goals) {
      if (existingGoals.some((item) => item.title === goal.title)) continue;
      const [created] = await tx.insert(communicationGoalsTable).values({
        organizationId,
        childId: child.id,
        ...goal,
        startDate,
        targetDate: endDate,
        createdByUserId: clinicianId,
        updatedByUserId: clinicianId,
      }).returning();
      if (!created) throw new Error(`Could not create goal: ${goal.title}`);
      await tx.insert(communicationGoalHistoryTable).values({
        organizationId,
        childId: child.id,
        goalId: created.id,
        action: "created",
        version: created.version,
        actorUserId: clinicianId,
        snapshot: {
          title: created.title,
          goalArea: created.goalArea,
          description: created.description,
          status: created.status,
          startDate: created.startDate,
          targetDate: created.targetDate,
          version: created.version,
          archivedAt: null,
          archivedByUserId: null,
        },
      });
    }

    return { id: child.id, childLedId: child.childLedId };
  });

  console.log(`Recording QA student ready: ${fixtureName} (${seeded.childLedId}; internal childId=${seeded.id}).`);
  console.log("Sign in to the development demo as SLP Dr. Lena Ortiz to test the workflow.");
} finally {
  await pool.end();
}
