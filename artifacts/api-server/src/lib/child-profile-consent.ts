export const CHILD_PROFILE_CONSENT_STATEMENT_VERSION = "2026-08-child-profile-authority-v1";

export const CHILD_PROFILE_CONSENT_STATEMENT =
  "I confirm that I am the parent/legal guardian of this child or have authorization to collect and store this information for educational or therapeutic purposes.";

export const hasLegalAuthorityConsent = (input: {
  legalAuthorityConfirmed?: boolean;
}) => input.legalAuthorityConfirmed === true;

export const buildChildProfileConsentRecord = ({
  childId,
  userId,
  confirmedBy,
}: {
  childId: number;
  userId: string;
  confirmedBy: string;
}) => ({
  childId,
  userId,
  confirmedBy,
  statementVersion: CHILD_PROFILE_CONSENT_STATEMENT_VERSION,
  statement: CHILD_PROFILE_CONSENT_STATEMENT,
  confirmedAt: new Date(),
});