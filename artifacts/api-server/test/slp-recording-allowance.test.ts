import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  childProfilesTable,
  db,
  organizationsTable,
  pool,
  sessionAudioObjectsTable,
  slpRecordingUsageTable,
  usersTable,
} from "@workspace/db";
import type { ResolvedCareTeamActor } from "../src/lib/auth-context";
import {
  consumeRecordingUsage,
  recordingAllowanceFor,
  releaseRecordingUsage,
  reserveRecordingUsage,
} from "../src/lib/slp-recording-allowance";

test.after(async () => pool.end());

test("weekly quota is atomic, idempotent and resets without a job", async () => {
  const suffix = randomUUID();
  const userId = `recording-quota-${suffix}`;
  const audioIds = Array.from(
    { length: 5 },
    (_, index) => `recording-${index}-${suffix}`,
  );
  const [organization] = await db
    .insert(organizationsTable)
    .values({
      slug: `recording-quota-${suffix}`,
      name: "Recording Quota Test",
    })
    .returning();
  assert.ok(organization);
  let childId: number | undefined;
  try {
    await db.insert(usersTable).values({
      id: userId,
      identityProvider: "recording-quota-test",
      providerSubject: userId,
      displayName: "Quota Test SLP",
    });
    const [child] = await db
      .insert(childProfilesTable)
      .values({
        organizationId: organization.id,
        displayName: "Quota Test Child",
      })
      .returning();
    assert.ok(child);
    childId = child.id;
    await db.insert(sessionAudioObjectsTable).values(
      audioIds.map((id) => ({
        id,
        organizationId: organization.id,
        childId: child.id,
        storageDriver: "local-encrypted",
        objectKey: id,
        contentType: "audio/webm",
        sizeBytes: 200,
        uploadedByUserId: userId,
        consentConfirmedAt: new Date(),
        consentConfirmedByUserId: userId,
      })),
    );
    const actor: ResolvedCareTeamActor = {
      userId,
      author: "Quota Test SLP",
      role: "SLP",
      childIds: [child.id],
      isAdmin: false,
      isSuperAdmin: false,
      organizationId: organization.id,
      onboardingComplete: true,
      expiresAt: Date.now() + 60_000,
    };
    const monday = new Date("2026-09-14T16:00:00.000Z");
    assert.equal(
      (await recordingAllowanceFor(actor, monday)).remainingSeconds,
      3600,
    );

    const [first, second] = await Promise.all([
      reserveRecordingUsage({
        actor,
        audioId: audioIds[0]!,
        durationMilliseconds: 2_400_000,
        now: monday,
      }),
      reserveRecordingUsage({
        actor,
        audioId: audioIds[1]!,
        durationMilliseconds: 2_400_000,
        now: monday,
      }),
    ]);
    assert.deepEqual([first.status, second.status].sort(), [
      "limit_reached",
      "reserved",
    ]);
    assert.equal(
      (await recordingAllowanceFor(actor, monday)).remainingSeconds,
      1200,
    );

    const winningId = first.status === "reserved" ? audioIds[0]! : audioIds[1]!;
    assert.equal(
      (
        await reserveRecordingUsage({
          actor,
          audioId: winningId,
          durationMilliseconds: 2_400_000,
          now: monday,
        })
      ).status,
      "in_progress",
    );
    await db.transaction((transaction) =>
      consumeRecordingUsage(transaction, winningId),
    );
    assert.equal(
      (
        await reserveRecordingUsage({
          actor,
          audioId: winningId,
          durationMilliseconds: 2_400_000,
          now: monday,
        })
      ).status,
      "already_consumed",
    );
    assert.equal(
      (await recordingAllowanceFor(actor, monday)).remainingSeconds,
      1200,
    );
    await assert.rejects(
      reserveRecordingUsage({
        actor: { ...actor, userId: `another-${suffix}` },
        audioId: winningId,
        durationMilliseconds: 1_000,
        now: monday,
      }),
      /another SLP account/,
    );

    const devActor: ResolvedCareTeamActor = {
      ...actor,
      isDevelopmentDemo: true,
    };
    assert.equal(
      (await recordingAllowanceFor(devActor, monday)).unlimited,
      true,
    );
    assert.equal(
      (
        await reserveRecordingUsage({
          actor: devActor,
          audioId: audioIds[2]!,
          durationMilliseconds: 3_600_000,
          now: monday,
        })
      ).status,
      "reserved",
    );
    assert.equal(
      (await recordingAllowanceFor(actor, monday)).remainingSeconds,
      1200,
    );

    const releaseId = audioIds[2]!;
    assert.equal(
      (
        await reserveRecordingUsage({
          actor,
          audioId: releaseId,
          durationMilliseconds: 600_000,
          now: monday,
        })
      ).status,
      "reserved",
    );
    assert.equal(
      (await recordingAllowanceFor(actor, monday)).remainingSeconds,
      600,
    );
    await releaseRecordingUsage(releaseId);
    assert.equal(
      (await recordingAllowanceFor(actor, monday)).remainingSeconds,
      1200,
    );
    assert.equal(
      (
        await reserveRecordingUsage({
          actor,
          audioId: releaseId,
          durationMilliseconds: 600_000,
          now: monday,
        })
      ).status,
      "reserved",
    );
    assert.equal(
      (await recordingAllowanceFor(actor, monday)).remainingSeconds,
      600,
    );
    await releaseRecordingUsage(releaseId);
    assert.equal(
      (await recordingAllowanceFor(actor, monday)).remainingSeconds,
      1200,
    );
    const nextMonday = new Date("2026-09-21T04:00:00.000Z");
    assert.equal(
      (await recordingAllowanceFor(actor, nextMonday)).remainingSeconds,
      3600,
    );
    assert.equal(
      (
        await reserveRecordingUsage({
          actor,
          audioId: audioIds[1]!,
          durationMilliseconds: 1_350_000,
          now: nextMonday,
        })
      ).status,
      "reserved",
    );
    assert.equal(
      (await recordingAllowanceFor(actor, nextMonday)).remainingSeconds,
      2_250,
    );
    assert.equal(
      (
        await reserveRecordingUsage({
          actor,
          audioId: audioIds[2]!,
          durationMilliseconds: 600_000,
          now: nextMonday,
        })
      ).status,
      "reserved",
    );
    assert.equal(
      (await recordingAllowanceFor(actor, nextMonday)).remainingSeconds,
      1_650,
    );
    assert.equal(
      (
        await reserveRecordingUsage({
          actor,
          audioId: audioIds[3]!,
          durationMilliseconds: 1_650_000,
          now: nextMonday,
        })
      ).status,
      "reserved",
    );
    assert.equal(
      (await recordingAllowanceFor(actor, nextMonday)).remainingSeconds,
      0,
    );
    assert.equal(
      (
        await reserveRecordingUsage({
          actor,
          audioId: audioIds[4]!,
          durationMilliseconds: 1_000,
          now: nextMonday,
        })
      ).status,
      "limit_reached",
    );
  } finally {
    await db
      .delete(slpRecordingUsageTable)
      .where(eq(slpRecordingUsageTable.userId, userId));
    for (const id of audioIds)
      await db
        .delete(sessionAudioObjectsTable)
        .where(eq(sessionAudioObjectsTable.id, id));
    if (childId)
      await db
        .delete(childProfilesTable)
        .where(eq(childProfilesTable.id, childId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await db
      .delete(organizationsTable)
      .where(eq(organizationsTable.id, organization.id));
  }
});
