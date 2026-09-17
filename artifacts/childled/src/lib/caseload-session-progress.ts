import type { IepServiceRequirement } from "@workspace/api-client-react";

type SessionRequirementProgress = Pick<
  IepServiceRequirement,
  "requiredSessions" | "sessionsRemaining"
>;

// Remaining already credits absences without crediting a later makeup twice.
export const sessionsAccountedFor = (
  requirement: SessionRequirementProgress,
) => Math.max(0, requirement.requiredSessions - requirement.sessionsRemaining);

export const sessionRequirementProgress = (
  requirement: SessionRequirementProgress,
) =>
  requirement.requiredSessions > 0
    ? Math.round(
        (sessionsAccountedFor(requirement) / requirement.requiredSessions) *
          100,
      )
    : 0;
