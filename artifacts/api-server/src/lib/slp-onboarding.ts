export const SLP_AGREEMENTS = [
  {
    type: "terms_of_service",
    version: "1.0",
    title: "Terms of Service",
    statement: "I have read and agree to the ChildLed Terms of Service.",
    documentPath: "/terms",
  },
  {
    type: "privacy_policy",
    version: "1.0",
    title: "Privacy Policy",
    statement: "I acknowledge the ChildLed Privacy Policy.",
    documentPath: "/privacy",
  },
  {
    type: "student_data_confidentiality",
    version: "1.0",
    title: "Student Data & Confidentiality",
    statement:
      "I understand that student information may only be accessed and used for authorized educational or therapeutic purposes.",
    documentPath: "/privacy#student-data-confidentiality",
  },
  {
    type: "account_security",
    version: "1.0",
    title: "Account Security",
    statement:
      "I agree not to share my ChildLed account or allow unauthorized individuals to access student information.",
    documentPath: "/terms#account-security",
  },
  {
    type: "recording_authorization",
    version: "1.0",
    title: "Recording Authorization",
    statement:
      "I understand that I am responsible for ensuring that all required school, parent/guardian, and other applicable authorizations are in place before recording or uploading a student's voice or other protected information to ChildLed.",
    documentPath: "/terms#recording-authorization",
  },
  {
    type: "ai_output_acknowledgment",
    version: "1.0",
    title: "AI-Assisted Output",
    statement:
      "I understand that ChildLed may use AI-assisted tools and that generated transcripts, notes, summaries, classifications, or suggestions must be reviewed for accuracy before professional use.",
    documentPath: "/terms#ai-assisted-output",
  },
] as const;

export type SlpAgreementType = (typeof SLP_AGREEMENTS)[number]["type"];

export const invitationRequiresSlpOnboarding = ({
  membershipRole,
  existingMembership,
}: {
  membershipRole: "clinician" | "parent" | "teacher";
  existingMembership?: {
    role: string;
    accountStatus: string;
    onboardingCompletedAt: Date | null;
  };
}) =>
  membershipRole === "clinician" &&
  (!existingMembership ||
    existingMembership.role !== "clinician" ||
    existingMembership.accountStatus !== "active" ||
    !existingMembership.onboardingCompletedAt);

export const hasEveryCurrentSlpAgreement = (
  submitted: Array<{ type: string; version: string }>,
) => {
  const accepted = new Set(
    submitted.map((item) => `${item.type}:${item.version}`),
  );
  return SLP_AGREEMENTS.every((agreement) =>
    accepted.has(`${agreement.type}:${agreement.version}`),
  );
};
