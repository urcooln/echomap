import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import {
  childCareTeamMembershipsTable,
  childProfilesTable,
  clinicalDocumentationTable,
  clinicalGestaltsTable,
  communicationGoalHistoryTable,
  communicationGoalsTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  pool,
  securityAuditLogsTable,
  usersTable,
} from "@workspace/db";
import router from "../src/routes/childled";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";

test.after(async () => {
  await pool.end();
});

test("communication goals are caseload-scoped, versioned, and safely finalized as documentation provenance", async () => {
  const suffix = randomUUID();
  const userId = `communication-goals-route-${suffix}`;
  const ids = { organizations: [] as number[], children: [] as number[], goals: [] as number[], gestalts: [] as number[], documents: [] as number[] };
  const [organization, otherOrganization] = await db.insert(organizationsTable).values([
    { slug: `goals-${suffix}`, name: "Goals route organization" },
    { slug: `goals-other-${suffix}`, name: "Other goals organization" },
  ]).returning();
  assert.ok(organization && otherOrganization);
  ids.organizations.push(organization.id, otherOrganization.id);
  await db.insert(usersTable).values({ id: userId, identityProvider: "goals-route-test", providerSubject: userId, displayName: "Goals Clinician" });
  await db.insert(organizationMembershipsTable).values({ organizationId: organization.id, userId, role: "clinician" });
  const [child, otherChild, crossOrgChild] = await db.insert(childProfilesTable).values([
    { organizationId: organization.id, displayName: "Goal child" },
    { organizationId: organization.id, displayName: "Other goal child" },
    { organizationId: otherOrganization.id, displayName: "Cross organization child" },
  ]).returning();
  assert.ok(child && otherChild && crossOrgChild);
  ids.children.push(child.id, otherChild.id, crossOrgChild.id);
  await db.insert(childCareTeamMembershipsTable).values([
    { childId: child.id, userId, role: "clinician" },
    { childId: otherChild.id, userId, role: "clinician" },
    { childId: crossOrgChild.id, userId, role: "clinician" },
  ]);

  const insertGestalt = async (childId: number, organizationId: number, phrase: string, archived = false, meaning = "Rocket requesting during play") => {
    const [row] = await db.insert(clinicalGestaltsTable).values({
      organizationId, childId, phrase, normalizedPhrase: `${phrase.toLowerCase()}-${suffix}`,
      meaning, communicationFunction: "requesting",
      contexts: ["therapy"], emotionalState: "regulated", source: "Clinician reviewed",
      createdByUserId: userId, archivedAt: archived ? new Date() : null,
    }).returning();
    assert.ok(row);
    ids.gestalts.push(row.id);
    return row;
  };
  const activeSource = await insertGestalt(child.id, organization.id, "Rocket request");
  const archivedSource = await insertGestalt(child.id, organization.id, "Rocket archived", true);
  const unrelatedSource = await insertGestalt(child.id, organization.id, "Banana song", false, "Banana dancing during music");
  const foreignSource = await insertGestalt(otherChild.id, organization.id, "Rocket other child");

  let actor: ResolvedCareTeamActor = {
    userId, author: "Goals Clinician", role: "SLP", childIds: [child.id, otherChild.id, crossOrgChild.id],
    isAdmin: false, organizationId: organization.id, expiresAt: Date.now() + 60_000,
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.childledActor = actor; next(); });
  app.use(router);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const value = app.listen(0, () => resolve(value));
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${base}${path}`, init);
    return { status: response.status, body: await response.json() as Record<string, any> };
  };
  const json = (method: string, path: string, body: Record<string, unknown>) => request(path, {
    method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const goalInput = {
    childId: child.id, title: "Rocket requesting", goalArea: "Requesting",
    description: "Use rocket words to request preferred activities", startDate: "2025-01-10", targetDate: "2025-06-10",
  };

  try {
    for (const role of ["Parent", "Teacher", "Administrator"] as const) {
      actor = { ...actor, role };
      assert.equal((await request(`/communication-goals?childId=${child.id}`)).status, 403);
      assert.equal((await json("POST", "/communication-goals", goalInput)).status, 403);
      assert.equal((await json("PATCH", "/communication-goals/999999", { childId: child.id, version: 1, title: "Nope" })).status, 403);
    }
    actor = { ...actor, role: "SLP" };
    const created = await json("POST", "/communication-goals", goalInput);
    assert.equal(created.status, 201);
    const goal = created.body;
    ids.goals.push(goal.id);
    assert.deepEqual(
      Object.keys(goal).sort(),
      ["childId", "createdAt", "description", "goalArea", "id", "startDate", "status", "targetDate", "title", "updatedAt", "version"],
    );
    assert.equal((await request(`/communication-goals?childId=${child.id}`)).body.length, 1);

    const otherGoal = await json("POST", "/communication-goals", { ...goalInput, childId: otherChild.id, title: "Other rocket goal" });
    assert.equal(otherGoal.status, 201);
    ids.goals.push(otherGoal.body.id);
    assert.equal((await json("PATCH", `/communication-goals/${goal.id}`, { childId: otherChild.id, version: goal.version, title: "cross child" })).status, 404);
    actor = { ...actor, organizationId: otherOrganization.id };
    const crossOrgList = await request(`/communication-goals?childId=${child.id}`);
    assert.equal(crossOrgList.status, 200);
    assert.deepEqual(crossOrgList.body, []);
    assert.equal((await json("PATCH", `/communication-goals/${goal.id}`, { childId: child.id, version: goal.version, title: "cross org" })).status, 404);
    actor = { ...actor, organizationId: organization.id };

    const edited = await json("PATCH", `/communication-goals/${goal.id}`, {
      childId: child.id, version: goal.version, title: "Rocket requesting edit", goalArea: "Functional requesting",
      description: "Request rocket play with a communication partner", startDate: "2025-02-01", targetDate: "2025-07-01",
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.version, 2);
    assert.equal((await json("PATCH", `/communication-goals/${goal.id}`, { childId: child.id, version: 1, title: "stale" })).status, 409);

    const archiveGoal = await json("PATCH", `/communication-goals/${goal.id}`, { childId: child.id, version: 2, status: "archived" });
    assert.equal(archiveGoal.status, 200);
    const reactivateGoal = await json("PATCH", `/communication-goals/${goal.id}`, { childId: child.id, version: 3, status: "active" });
    assert.equal(reactivateGoal.status, 200);
    const history = await db.select().from(communicationGoalHistoryTable).where(eq(communicationGoalHistoryTable.goalId, goal.id));
    assert.deepEqual(history.map((entry) => entry.action), ["created", "updated", "archived", "reactivated"]);
    assert.deepEqual(Object.keys(history[0]!.snapshot).sort(), ["archivedAt", "archivedByUserId", "description", "goalArea", "startDate", "status", "targetDate", "title", "version"]);
    assert.equal(history[0]!.snapshot.title, goalInput.title);
    assert.equal(history[1]!.snapshot.title, "Rocket requesting edit");
    assert.equal(history[2]!.snapshot.status, "archived");
    assert.equal(history[3]!.snapshot.status, "active");

    const draft = await json("POST", "/clinical-documentation", { childId: child.id, format: "session_note", inputSummary: "Rocket session documentation draft." });
    assert.equal(draft.status, 201);
    ids.documents.push(draft.body.id);
    const candidates = draft.body.content.goalConnections;
    assert.equal(candidates.length, 1);
    assert.equal(candidates.some((item: any) => item.sourceId === activeSource.id), true);
    assert.equal(candidates.some((item: any) => item.sourceId === archivedSource.id || item.sourceId === unrelatedSource.id), false);
    const selection = { goalId: goal.id, sourceKind: "dictionary_phrase", sourceId: activeSource.id, included: true };
    const save = (selections: unknown) => json("PUT", "/clinical-documentation", {
      documentId: draft.body.id, childId: child.id, title: "Saved goal-aware draft", content: draft.body.content, goalConnectionSelections: selections,
    });
    assert.equal((await save([selection, selection])).status, 422);
    assert.equal((await save([{ ...selection, sourceId: foreignSource.id }])).status, 422);
    const saved = await save([selection]);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.content.goalConnections.filter((item: any) => item.included).length, 1);

    await db.update(clinicalGestaltsTable).set({ archivedAt: new Date() }).where(eq(clinicalGestaltsTable.id, activeSource.id));
    assert.equal((await json("POST", "/clinical-documentation/approve", { documentId: draft.body.id, childId: child.id })).status, 422);
    await db.update(clinicalGestaltsTable).set({ archivedAt: null }).where(eq(clinicalGestaltsTable.id, activeSource.id));
    assert.equal((await save([selection])).status, 200);
    const archiveBeforeFinalize = await json("PATCH", `/communication-goals/${goal.id}`, { childId: child.id, version: 4, status: "archived" });
    assert.equal(archiveBeforeFinalize.status, 200);
    assert.equal((await json("POST", "/clinical-documentation/approve", { documentId: draft.body.id, childId: child.id })).status, 422);
    const restoredBeforeFinalize = await json("PATCH", `/communication-goals/${goal.id}`, { childId: child.id, version: 5, status: "active" });
    assert.equal(restoredBeforeFinalize.status, 200);
    assert.equal((await save([selection])).status, 200);
    const finalized = await json("POST", "/clinical-documentation/approve", { documentId: draft.body.id, childId: child.id });
    assert.equal(finalized.status, 200);
    assert.deepEqual(finalized.body.content.goalConnections, [expectConnection(selection, "Rocket requesting edit", "Functional requesting", 6)]);
    const editedAfterFinalize = await json("PATCH", `/communication-goals/${goal.id}`, {
      childId: child.id, version: 6, title: "Later goal title", goalArea: "Later area",
    });
    assert.equal(editedAfterFinalize.status, 200);
    const finalizedList = await request("/clinical-documentation?status=all");
    const unchangedFinalized = finalizedList.body.documents.find((item: any) => item.id === draft.body.id);
    assert.deepEqual(unchangedFinalized.content.goalConnections, [expectConnection(selection, "Rocket requesting edit", "Functional requesting", 6)]);
    const [persisted] = await db.select().from(clinicalDocumentationTable).where(eq(clinicalDocumentationTable.id, draft.body.id));
    assert.deepEqual((persisted!.content as any).goalConnections.map((item: any) => item.sourceId), [activeSource.id]);
    const audits = await db.select().from(securityAuditLogsTable).where(and(eq(securityAuditLogsTable.userId, userId), inArray(securityAuditLogsTable.action, ["COMMUNICATION_GOAL_CREATED", "COMMUNICATION_GOAL_UPDATED"])));
    assert.equal(audits.filter((audit) => audit.action === "COMMUNICATION_GOAL_CREATED").length, 2);
    assert.equal(audits.filter((audit) => audit.action === "COMMUNICATION_GOAL_UPDATED").length, 6);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (ids.documents.length) await db.delete(clinicalDocumentationTable).where(inArray(clinicalDocumentationTable.id, ids.documents));
    if (ids.goals.length) await db.delete(communicationGoalHistoryTable).where(inArray(communicationGoalHistoryTable.goalId, ids.goals));
    if (ids.goals.length) await db.delete(communicationGoalsTable).where(inArray(communicationGoalsTable.id, ids.goals));
    if (ids.gestalts.length) await db.delete(clinicalGestaltsTable).where(inArray(clinicalGestaltsTable.id, ids.gestalts));
    await db.delete(securityAuditLogsTable).where(eq(securityAuditLogsTable.userId, userId));
    await db.delete(childCareTeamMembershipsTable).where(inArray(childCareTeamMembershipsTable.childId, ids.children));
    await db.delete(childProfilesTable).where(inArray(childProfilesTable.id, ids.children));
    await db.delete(organizationMembershipsTable).where(eq(organizationMembershipsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await db.delete(organizationsTable).where(inArray(organizationsTable.id, ids.organizations));
  }
});

const expectConnection = (
  selection: { goalId: number; sourceKind: string; sourceId: number; included: boolean },
  goalTitle: string,
  goalArea: string,
  goalVersion: number,
) => ({
  ...selection,
  goalTitle,
  goalArea,
  goalVersion,
  sourceLabel: "Reviewed dictionary phrase",
  sourceDetail: "“Rocket request” · Rocket requesting during play",
  evidenceClass: "reviewed_clinical_evidence",
});