import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  clearSlpOnboardingDraft,
  loadSlpOnboardingDraft,
  saveSlpOnboardingDraft,
  slpOnboardingDraftLifetimeMs,
} from "../src/lib/slp-onboarding-draft.ts";

const profile = {
  firstName: "Lena",
  lastName: "Ortiz",
  professionalTitle: "Speech-Language Pathologist",
  school: "Maple Grove",
  schoolDistrict: "North District",
  licensureState: "NY",
  licenseNumber: "SLP-123",
  licenseExpirationDate: "2027-09-15",
  ashaCccSlpNumber: "ASHA-456",
};

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
};

test("SLP onboarding drafts restore profile fields and agreement checkboxes", () => {
  const storage = memoryStorage();
  saveSlpOnboardingDraft({
    userId: "slp-one",
    profile,
    acceptedAgreementKeys: ["terms_of_service:1.0"],
    storage,
    now: 100,
  });

  assert.deepEqual(loadSlpOnboardingDraft("slp-one", storage, 200), {
    profile,
    acceptedAgreementKeys: ["terms_of_service:1.0"],
  });
  assert.equal(loadSlpOnboardingDraft("slp-two", storage, 200), undefined);
});

test("SLP onboarding drafts expire and are cleared after completion", () => {
  const storage = memoryStorage();
  saveSlpOnboardingDraft({
    userId: "slp-one",
    profile,
    acceptedAgreementKeys: [],
    storage,
    now: 100,
  });
  assert.equal(
    loadSlpOnboardingDraft(
      "slp-one",
      storage,
      100 + slpOnboardingDraftLifetimeMs + 1,
    ),
    undefined,
  );

  saveSlpOnboardingDraft({
    userId: "slp-one",
    profile,
    acceptedAgreementKeys: [],
    storage,
  });
  clearSlpOnboardingDraft("slp-one", storage);
  assert.equal(loadSlpOnboardingDraft("slp-one", storage), undefined);
});

test("agreement documents open without navigating away from SLP onboarding", () => {
  const source = readFileSync(
    new URL("../src/pages/slp-onboarding.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /<AgreementDocumentDialog/);
  assert.match(source, /setActiveDocument/);
  assert.match(source, /Return to account setup/);
  assert.doesNotMatch(source, /target="_blank"/);
});
