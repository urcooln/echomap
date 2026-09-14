import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import {
  betaControlsTable,
  betaNoticeAcknowledgementsTable,
  db,
} from "@workspace/db";
import type { ResolvedCareTeamActor } from "./auth-context";
import { logger } from "./logger";
import { runtimeConfig } from "./runtime-config";

export const BETA_CONFIDENTIALITY_AGREEMENT_TYPE = "beta_confidentiality";
export const BETA_CONFIDENTIALITY_FALLBACK_VERSION = "1.0";
export const BETA_CONFIDENTIALITY_FALLBACK_TEXT = `By participating in the ChildLed beta, you understand that:
- The software is under active development.
- Features may change, be removed, or behave differently during testing.
- You agree not to publicly share screenshots, screen recordings, unreleased features, confidential product information, or other non-public information about ChildLed.
- You will not share your account credentials with unauthorized individuals.
- Feedback you provide may be used by ChildLed to improve the product.
- Beta access may be modified or revoked during the testing period.

ChildLed beta software is provided for testing and evaluation purposes and should not be relied upon as the sole source for clinical, educational, legal, or compliance decisions.`;

export const betaLoginSessionHash = (loginSessionId: string) =>
  createHash("sha256").update(loginSessionId, "utf8").digest("hex");

export const currentBetaAgreementVersion = async () => {
  const [controls] = await db
    .select({ version: betaControlsTable.currentNoticeVersion })
    .from(betaControlsTable)
    .where(eq(betaControlsTable.id, 1))
    .limit(1);
  return controls?.version?.trim() || BETA_CONFIDENTIALITY_FALLBACK_VERSION;
};

export const betaAgreementAcceptedForSession = async ({
  actor,
  version,
}: {
  actor: ResolvedCareTeamActor;
  version: string;
}) => {
  if (!actor.loginSessionId) return false;
  const [acceptance] = await db
    .select({ id: betaNoticeAcknowledgementsTable.id })
    .from(betaNoticeAcknowledgementsTable)
    .where(
      and(
        eq(betaNoticeAcknowledgementsTable.userId, actor.userId),
        eq(
          betaNoticeAcknowledgementsTable.agreementType,
          BETA_CONFIDENTIALITY_AGREEMENT_TYPE,
        ),
        eq(betaNoticeAcknowledgementsTable.noticeVersion, version),
        eq(
          betaNoticeAcknowledgementsTable.loginSessionHash,
          betaLoginSessionHash(actor.loginSessionId),
        ),
      ),
    )
    .limit(1);
  return Boolean(acceptance);
};

export const attachBetaAgreementStatus = async (
  request: Request,
  _response: Response,
  next: NextFunction,
) => {
  const actor = request.childledActor;
  if (
    !runtimeConfig.betaAgreement.required ||
    !actor ||
    request.childledAuthFailure
  ) {
    return next();
  }
  try {
    const version = await currentBetaAgreementVersion();
    if (!(await betaAgreementAcceptedForSession({ actor, version }))) {
      request.childledAuthFailure = "beta_notice_unacknowledged";
    }
  } catch (error) {
    request.childledAuthFailure = "session_invalid";
    logger.error(
      { err: error, userId: actor.userId },
      "Could not verify the beta agreement for the current login session",
    );
  }
  return next();
};
