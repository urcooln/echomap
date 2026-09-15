import type { SlpOnboardingProfileInput } from "@workspace/api-client-react";

const draftVersion = 1;
const draftLifetimeMs = 8 * 60 * 60 * 1000;
const draftKeyPrefix = "childled-slp-onboarding-draft:";

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type StoredSlpOnboardingDraft = {
  version: number;
  savedAt: number;
  profile: SlpOnboardingProfileInput;
  acceptedAgreementKeys: string[];
};

const draftKey = (userId: string) => `${draftKeyPrefix}${userId}`;

const isNullableString = (value: unknown) =>
  value === null || typeof value === "string";

const isProfile = (value: unknown): value is SlpOnboardingProfileInput => {
  if (!value || typeof value !== "object") return false;
  const profile = value as Record<string, unknown>;
  return (
    typeof profile.firstName === "string" &&
    typeof profile.lastName === "string" &&
    typeof profile.professionalTitle === "string" &&
    typeof profile.school === "string" &&
    typeof profile.schoolDistrict === "string" &&
    typeof profile.licensureState === "string" &&
    typeof profile.licenseNumber === "string" &&
    isNullableString(profile.licenseExpirationDate) &&
    isNullableString(profile.ashaCccSlpNumber)
  );
};

export const loadSlpOnboardingDraft = (
  userId: string,
  storage: DraftStorage = window.sessionStorage,
  now = Date.now(),
) => {
  try {
    const raw = storage.getItem(draftKey(userId));
    if (!raw) return undefined;
    const draft = JSON.parse(raw) as Partial<StoredSlpOnboardingDraft>;
    if (
      draft.version !== draftVersion ||
      typeof draft.savedAt !== "number" ||
      now - draft.savedAt > draftLifetimeMs ||
      !isProfile(draft.profile) ||
      !Array.isArray(draft.acceptedAgreementKeys) ||
      !draft.acceptedAgreementKeys.every((key) => typeof key === "string")
    ) {
      storage.removeItem(draftKey(userId));
      return undefined;
    }
    return {
      profile: draft.profile,
      acceptedAgreementKeys: draft.acceptedAgreementKeys,
    };
  } catch {
    try {
      storage.removeItem(draftKey(userId));
    } catch {
      // Ignore unavailable browser storage and fall back to live form state.
    }
    return undefined;
  }
};

export const saveSlpOnboardingDraft = ({
  userId,
  profile,
  acceptedAgreementKeys,
  storage = window.sessionStorage,
  now = Date.now(),
}: {
  userId: string;
  profile: SlpOnboardingProfileInput;
  acceptedAgreementKeys: string[];
  storage?: DraftStorage;
  now?: number;
}) => {
  try {
    storage.setItem(
      draftKey(userId),
      JSON.stringify({
        version: draftVersion,
        savedAt: now,
        profile,
        acceptedAgreementKeys,
      } satisfies StoredSlpOnboardingDraft),
    );
  } catch {
    // The live form remains usable when browser storage is unavailable.
  }
};

export const clearSlpOnboardingDraft = (
  userId: string,
  storage: DraftStorage = window.sessionStorage,
) => {
  try {
    storage.removeItem(draftKey(userId));
  } catch {
    // Storage cleanup must never block successful account activation.
  }
};

export const slpOnboardingDraftLifetimeMs = draftLifetimeMs;
