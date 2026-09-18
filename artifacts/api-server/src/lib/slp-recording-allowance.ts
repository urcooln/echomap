import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db, slpRecordingUsageTable } from "@workspace/db";
import type { ResolvedCareTeamActor } from "./auth-context";
import { runtimeConfig } from "./runtime-config";
import {
  recordingWeekFor,
  remainingRecordingMilliseconds,
  SLP_WEEKLY_RECORDING_LIMIT_MILLISECONDS,
  SLP_WEEKLY_RECORDING_LIMIT_SECONDS,
} from "./slp-recording-week";

const activeStatuses = ["reserved", "consumed"] as const;
const staleReservationMilliseconds = 2 * 60 * 60 * 1_000;

export const hasUnlimitedRecording = (actor: ResolvedCareTeamActor) =>
  Boolean(actor.isDevelopmentDemo && runtimeConfig.demoLogin.enabled);

const usedInWeek = async (
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  periodStart: string,
) => {
  const [row] = await transaction
    .select({
      used: sql<number>`coalesce(sum(${slpRecordingUsageTable.durationMilliseconds}), 0)::integer`,
    })
    .from(slpRecordingUsageTable)
    .where(
      and(
        eq(slpRecordingUsageTable.userId, userId),
        eq(slpRecordingUsageTable.periodStart, periodStart),
        inArray(slpRecordingUsageTable.status, [...activeStatuses]),
      ),
    );
  return Number(row?.used ?? 0);
};

const lockUserAndExpireStale = async (
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  now: Date,
) => {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(77312, hashtext(${userId}))`,
  );
  await transaction
    .update(slpRecordingUsageTable)
    .set({ status: "released", updatedAt: now })
    .where(
      and(
        eq(slpRecordingUsageTable.userId, userId),
        eq(slpRecordingUsageTable.status, "reserved"),
        lt(
          slpRecordingUsageTable.updatedAt,
          new Date(now.getTime() - staleReservationMilliseconds),
        ),
      ),
    );
};

export const recordingAllowanceFor = async (
  actor: ResolvedCareTeamActor,
  now = new Date(),
) => {
  const week = recordingWeekFor(now);
  if (hasUnlimitedRecording(actor)) {
    return {
      unlimited: true as const,
      limitSeconds: null,
      usedSeconds: 0,
      remainingSeconds: null,
      resetAt: null,
      timeZone: week.timeZone,
    };
  }
  const usedMilliseconds = await db.transaction(async (transaction) => {
    await lockUserAndExpireStale(transaction, actor.userId, now);
    return usedInWeek(transaction, actor.userId, week.periodStart);
  });
  return {
    unlimited: false as const,
    limitSeconds: SLP_WEEKLY_RECORDING_LIMIT_SECONDS,
    usedSeconds: Math.ceil(usedMilliseconds / 1_000),
    remainingSeconds: Math.floor(
      remainingRecordingMilliseconds(usedMilliseconds) / 1_000,
    ),
    resetAt: week.periodEnd.toISOString(),
    timeZone: week.timeZone,
  };
};

export type RecordingReservationResult =
  | { status: "reserved" | "already_consumed" }
  | { status: "in_progress" }
  | { status: "limit_reached"; remainingSeconds: number };

export const reserveRecordingUsage = async ({
  actor,
  audioId,
  durationMilliseconds,
  now = new Date(),
}: {
  actor: ResolvedCareTeamActor;
  audioId: string;
  durationMilliseconds: number;
  now?: Date;
}): Promise<RecordingReservationResult> => {
  if (!Number.isSafeInteger(durationMilliseconds) || durationMilliseconds < 1) {
    throw new Error("A verified recording duration is required.");
  }
  if (hasUnlimitedRecording(actor)) return { status: "reserved" };
  const week = recordingWeekFor(now);
  return db.transaction(async (transaction) => {
    await lockUserAndExpireStale(transaction, actor.userId, now);
    const [existing] = await transaction
      .select()
      .from(slpRecordingUsageTable)
      .where(eq(slpRecordingUsageTable.audioId, audioId))
      .limit(1);
    if (existing && existing.userId !== actor.userId) {
      throw new Error("This recording belongs to another SLP account.");
    }
    if (existing?.status === "consumed") return { status: "already_consumed" };
    if (existing?.status === "reserved") return { status: "in_progress" };

    const used = await usedInWeek(transaction, actor.userId, week.periodStart);
    const remaining = remainingRecordingMilliseconds(used);
    if (durationMilliseconds > remaining) {
      return {
        status: "limit_reached",
        remainingSeconds: Math.floor(remaining / 1_000),
      };
    }
    if (existing) {
      await transaction
        .update(slpRecordingUsageTable)
        .set({
          periodStart: week.periodStart,
          durationMilliseconds,
          status: "reserved",
          updatedAt: now,
        })
        .where(eq(slpRecordingUsageTable.id, existing.id));
    } else {
      await transaction.insert(slpRecordingUsageTable).values({
        audioId,
        userId: actor.userId,
        periodStart: week.periodStart,
        durationMilliseconds,
        status: "reserved",
        createdAt: now,
        updatedAt: now,
      });
    }
    return { status: "reserved" };
  });
};

export const consumeRecordingUsage = async (
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  audioId: string,
) => {
  const [row] = await transaction
    .update(slpRecordingUsageTable)
    .set({ status: "consumed", updatedAt: new Date() })
    .where(
      and(
        eq(slpRecordingUsageTable.audioId, audioId),
        eq(slpRecordingUsageTable.status, "reserved"),
      ),
    )
    .returning({ id: slpRecordingUsageTable.id });
  if (!row) throw new Error("The recording allowance reservation expired.");
};

export const releaseRecordingUsage = async (audioId: string) => {
  await db
    .update(slpRecordingUsageTable)
    .set({ status: "released", updatedAt: new Date() })
    .where(
      and(
        eq(slpRecordingUsageTable.audioId, audioId),
        eq(slpRecordingUsageTable.status, "reserved"),
      ),
    );
};
