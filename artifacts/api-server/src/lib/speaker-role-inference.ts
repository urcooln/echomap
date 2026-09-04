import { createHash } from "node:crypto";

export const SPEAKER_ROLE_MODEL_VERSION = "multifactor-role-v1";
export const SPEAKER_ROLE_FEATURE_VERSION = "signals-v1";

export type InferredSpeakerRole = "child" | "slp" | "parent" | "teacher" | "caregiver" | "unknown";
export type InferenceState = "provisional" | "review_required" | "unavailable" | "confirmed" | "rejected";
export type RoleSignalName =
  | "diarization_consistency"
  | "profile_match"
  | "transcript_cues"
  | "conversation_behavior"
  | "confirmed_child_patterns"
  | "confirmed_slp_patterns"
  | "confirmed_feedback";

export type RoleInferenceSegment = {
  speakerLabel: string;
  text: string;
  position: number;
  confidenceScore: number | null;
  profileSignatureHash: string | null;
};

export type RoleInferenceProfile = {
  profileSignatureHash: string;
  role: string;
};

export type RoleLearningSignal = {
  role: string;
  featureKey: string;
  confirmedCount: number;
};

export type SpeakerRoleInference = {
  speakerLabel: string;
  state: InferenceState;
  predictedRole: InferredSpeakerRole | null;
  confidenceScore: number | null;
  competingRole: InferredSpeakerRole | null;
  competingScore: number | null;
  margin: number | null;
  signalCount: number;
  signalSummary: Array<{ signal: RoleSignalName; available: boolean; contribution: number; detail: string }>;
  inputFingerprint: string;
};

const roles: InferredSpeakerRole[] = ["child", "slp", "parent", "teacher", "caregiver", "unknown"];
const roleSet = new Set<string>(roles);
const contentWords = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter((word) => word.length > 2);
const capped = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const cueCount = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;
const normalizeRole = (role: string): InferredSpeakerRole =>
  roleSet.has(role) ? role as InferredSpeakerRole : "unknown";

/**
 * Hash only the derived, bounded feature inputs. Raw transcript material and
 * provider characteristics never leave the session/child scope in this value.
 */
export const speakerRoleInferenceFingerprint = (
  label: string,
  segments: RoleInferenceSegment[],
  profiles: RoleInferenceProfile[],
  confirmedChildPatterns: string[],
) => createHash("sha256")
  .update(JSON.stringify({
    label,
    turns: segments.map((segment) => [
      segment.position,
      segment.confidenceScore,
      Boolean(segment.profileSignatureHash),
      contentWords(segment.text).slice(0, 12),
    ]),
    profiles: profiles.map((profile) => [profile.profileSignatureHash, profile.role]).sort(),
    childPatternKeys: confirmedChildPatterns.map((value) => contentWords(value).join(" ")).sort(),
    version: SPEAKER_ROLE_FEATURE_VERSION,
  }))
  .digest("hex");

const scoreForSpeaker = (
  label: string,
  segments: RoleInferenceSegment[],
  profiles: RoleInferenceProfile[],
  confirmedChildPatterns: string[],
  learning: RoleLearningSignal[],
): SpeakerRoleInference => {
  const speakerSegments = segments.filter((segment) => segment.speakerLabel === label);
  const text = speakerSegments.map((segment) => segment.text).join(" ");
  const words = contentWords(text);
  const scores = new Map<InferredSpeakerRole, number>(roles.map((role) => [role, 0]));
  const signalSummary: SpeakerRoleInference["signalSummary"] = [];
  const roleBearingSignals = new Set<RoleSignalName>();
  const add = (role: InferredSpeakerRole, amount: number) =>
    scores.set(role, (scores.get(role) ?? 0) + amount);

  const confidenceScores = speakerSegments
    .map((segment) => segment.confidenceScore)
    .filter((score): score is number => score !== null);
  const diarization = confidenceScores.length
    ? Math.round(confidenceScores.reduce((total, score) => total + score, 0) / confidenceScores.length)
    : 0;
  signalSummary.push({
    signal: "diarization_consistency",
    available: confidenceScores.length > 0,
    contribution: diarization,
    detail: confidenceScores.length ? "Temporary cluster consistency is available." : "No cluster consistency score was returned.",
  });

  const matchingProfile = profiles.find((profile) => speakerSegments.some(
    (segment) => segment.profileSignatureHash === profile.profileSignatureHash,
  ));
  if (matchingProfile) {
    const role = normalizeRole(matchingProfile.role);
    add(role, 48);
    roleBearingSignals.add("profile_match");
    signalSummary.push({
      signal: "profile_match",
      available: true,
      contribution: 48,
      detail: "A child-scoped, clinician-confirmed profile matched this temporary cluster.",
    });
  } else {
    signalSummary.push({
      signal: "profile_match",
      available: false,
      contribution: 0,
      detail: "No child-scoped confirmed profile matched this cluster.",
    });
  }

  const questionCount = cueCount(text, /\?/gu);
  const promptCount = cueCount(text, /\b(what|would|can you|do you|tell me|show me|try|let'?s|notice|describe)\b/giu);
  const therapyCueCount = cueCount(text, /\b(gestalt|communication|regulat|model|script|language|session|therapy)\b/giu);
  const caregiverCueCount = cueCount(text, /\b(we|home|bedtime|school|your dad|your mom|snack|dinner)\b/giu);
  const childCueCount = cueCount(text, /\b(want|more|again|no|help|wow|yay|mine|go)\b/giu);
  const shortTurnCount = speakerSegments.filter((segment) => contentWords(segment.text).length <= 5).length;
  if (promptCount || therapyCueCount || caregiverCueCount || childCueCount) {
    add("slp", Math.min(26, promptCount * 5 + therapyCueCount * 7 + questionCount * 3));
    add("parent", Math.min(18, caregiverCueCount * 5));
    add("caregiver", Math.min(14, caregiverCueCount * 4));
    add("child", Math.min(20, childCueCount * 3 + shortTurnCount * 2));
    roleBearingSignals.add("transcript_cues");
    signalSummary.push({
      signal: "transcript_cues",
      available: true,
      contribution: Math.min(30, promptCount * 5 + therapyCueCount * 7 + caregiverCueCount * 4 + childCueCount * 3),
      detail: "Role cues were derived from the current speaker's words only.",
    });
  } else {
    signalSummary.push({
      signal: "transcript_cues",
      available: false,
      contribution: 0,
      detail: "No bounded role cue was found in this speaker's turns.",
    });
  }

  if (speakerSegments.length >= 2) {
    const adultBehavior = Math.min(16, questionCount * 4 + promptCount * 3);
    const childBehavior = Math.min(16, shortTurnCount * 3 + childCueCount * 2);
    add("slp", adultBehavior);
    add("parent", Math.round(adultBehavior * 0.55));
    add("teacher", Math.round(adultBehavior * 0.5));
    add("child", childBehavior);
    roleBearingSignals.add("conversation_behavior");
    signalSummary.push({
      signal: "conversation_behavior",
      available: true,
      contribution: Math.max(adultBehavior, childBehavior),
      detail: "Turn length and conversational prompts provided bounded role guidance.",
    });
  } else {
    signalSummary.push({
      signal: "conversation_behavior",
      available: false,
      contribution: 0,
      detail: "More than one turn is needed for conversational behavior guidance.",
    });
  }

  const childPatternWords = new Set(confirmedChildPatterns.flatMap(contentWords));
  const childOverlap = words.filter((word) => childPatternWords.has(word)).length;
  if (childPatternWords.size && childOverlap) {
    const contribution = Math.min(22, childOverlap * 4);
    add("child", contribution);
    roleBearingSignals.add("confirmed_child_patterns");
    signalSummary.push({
      signal: "confirmed_child_patterns",
      available: true,
      contribution,
      detail: "Only prior clinician-confirmed Child material contributed to this comparison.",
    });
  } else {
    signalSummary.push({
      signal: "confirmed_child_patterns",
      available: childPatternWords.size > 0,
      contribution: 0,
      detail: childPatternWords.size ? "No confirmed Child-language pattern matched." : "No confirmed Child-language pattern is available yet.",
    });
  }

  const slpContribution = Math.min(20, promptCount * 4 + therapyCueCount * 5);
  signalSummary.push({
    signal: "confirmed_slp_patterns",
    available: false,
    contribution: 0,
    detail: "No confirmed SLP-language pattern is available yet.",
  });
  if (slpContribution) {
    // The current-turn cue was already added above; this branch explicitly
    // avoids treating it as a historical SLP profile.
    signalSummary[signalSummary.length - 1] = {
      signal: "confirmed_slp_patterns",
      available: false,
      contribution: 0,
      detail: "Historical SLP patterns are unavailable; current cues remain separate.",
    };
  }

  const learningMatches = learning.filter((entry) => entry.confirmedCount > 0);
  if (learningMatches.length) {
    for (const entry of learningMatches) {
      add(normalizeRole(entry.role), Math.min(8, entry.confirmedCount));
    }
    roleBearingSignals.add("confirmed_feedback");
    signalSummary.push({
      signal: "confirmed_feedback",
      available: true,
      contribution: Math.min(8, learningMatches.reduce((total, entry) => total + entry.confirmedCount, 0)),
      detail: "Bounded, clinician-confirmed feedback adjusted the review guidance.",
    });
  } else {
    signalSummary.push({
      signal: "confirmed_feedback",
      available: false,
      contribution: 0,
      detail: "No bounded confirmed-feedback aggregate is available yet.",
    });
  }

  const ranked = [...scores.entries()]
    .map(([role, score]) => [role, capped(score)] as const)
    .sort((left, right) => right[1] - left[1]);
  const [topRole, topScore] = ranked[0] ?? ["unknown", 0];
  const [competingRole, competingScore] = ranked[1] ?? ["unknown", 0];
  const margin = topScore - competingScore;
  const signalCount = roleBearingSignals.size;
  const hasSufficientEvidence = signalCount >= 2 && topScore >= 55 && margin >= 10;
  const state: InferenceState = signalCount === 0
    ? "unavailable"
    : topScore >= 82 && margin >= 15 && signalCount >= 2
      ? "provisional"
      : hasSufficientEvidence
        ? "review_required"
        : "review_required";

  return {
    speakerLabel: label,
    state,
    predictedRole: state === "unavailable" ? null : topRole,
    confidenceScore: state === "unavailable" ? null : topScore,
    competingRole: state === "unavailable" ? null : competingRole,
    competingScore: state === "unavailable" ? null : competingScore,
    margin: state === "unavailable" ? null : margin,
    signalCount,
    signalSummary,
    inputFingerprint: speakerRoleInferenceFingerprint(label, speakerSegments, profiles, confirmedChildPatterns),
  };
};

export const inferSpeakerRoles = ({
  segments,
  profiles,
  confirmedChildPatterns,
  learning,
}: {
  segments: RoleInferenceSegment[];
  profiles: RoleInferenceProfile[];
  confirmedChildPatterns: string[];
  learning: RoleLearningSignal[];
}) => [...new Set(segments.map((segment) => segment.speakerLabel))]
  .map((label) => scoreForSpeaker(label, segments, profiles, confirmedChildPatterns, learning));