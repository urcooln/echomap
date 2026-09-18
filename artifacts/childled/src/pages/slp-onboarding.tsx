import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  useCompleteSlpOnboarding,
  useGetSlpOnboarding,
  type SlpOnboardingProfileInput,
} from "@workspace/api-client-react";
import { BookOpen, Check, Leaf, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LEGAL_REVIEW_NOTICE,
  privacyPolicySections,
  termsOfUseSections,
} from "@/content/legal";
import {
  clearSlpOnboardingDraft,
  loadSlpOnboardingDraft,
  saveSlpOnboardingDraft,
} from "@/lib/slp-onboarding-draft";

const emptyProfile: SlpOnboardingProfileInput = {
  firstName: "",
  lastName: "",
  professionalTitle: "Speech-Language Pathologist",
  school: "",
  districtId: 0,
  licensureState: "",
  licenseNumber: "",
  licenseExpirationDate: null,
  ashaCccSlpNumber: null,
};

const fieldClass =
  "mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-ring sm:h-10 sm:text-sm";

export function SlpOnboardingPage({
  onCompleted,
  userId,
}: {
  onCompleted: () => void;
  userId: string;
}) {
  const setup = useGetSlpOnboarding();
  const completion = useCompleteSlpOnboarding({
    mutation: {
      onSuccess: () => {
        clearSlpOnboardingDraft(userId);
        onCompleted();
      },
    },
  });
  const [profile, setProfile] =
    useState<SlpOnboardingProfileInput>(emptyProfile);
  const [accepted, setAccepted] = useState<Set<string>>(() => new Set());
  const [initialized, setInitialized] = useState(false);
  const [activeDocument, setActiveDocument] = useState<{
    title: string;
    documentPath: string;
  } | null>(null);

  useEffect(() => {
    if (!setup.data || initialized) return;
    const serverProfile = {
      firstName: setup.data.profile.firstName,
      lastName: setup.data.profile.lastName,
      professionalTitle: setup.data.profile.professionalTitle,
      school: setup.data.profile.school,
      districtId: setup.data.profile.districtId ?? 0,
      licensureState: setup.data.profile.licensureState,
      licenseNumber: setup.data.profile.licenseNumber,
      licenseExpirationDate: setup.data.profile.licenseExpirationDate,
      ashaCccSlpNumber: setup.data.profile.ashaCccSlpNumber,
    };
    const currentAgreementKeys = new Set(
      setup.data.agreements.map(
        (agreement) => `${agreement.type}:${agreement.version}`,
      ),
    );
    const acceptedByServer = setup.data.agreements
      .filter((agreement) => agreement.accepted)
      .map((agreement) => `${agreement.type}:${agreement.version}`);
    const draft = loadSlpOnboardingDraft(userId);
    const restored = draft?.profile ?? serverProfile;
    setProfile({
      ...restored,
      districtId: setup.data.districts.some(
        (district) => district.id === restored.districtId,
      )
        ? restored.districtId
        : 0,
    });
    setAccepted(
      new Set([
        ...acceptedByServer,
        ...(draft?.acceptedAgreementKeys.filter((key) =>
          currentAgreementKeys.has(key),
        ) ?? []),
      ]),
    );
    setInitialized(true);
  }, [initialized, setup.data, userId]);

  useEffect(() => {
    if (!initialized) return;
    saveSlpOnboardingDraft({
      userId,
      profile,
      acceptedAgreementKeys: [...accepted],
    });
  }, [accepted, initialized, profile, userId]);

  const allAgreementsAccepted = useMemo(
    () =>
      Boolean(
        setup.data?.agreements.every((agreement) =>
          accepted.has(`${agreement.type}:${agreement.version}`),
        ),
      ),
    [accepted, setup.data?.agreements],
  );
  const update = (field: keyof SlpOnboardingProfileInput, value: string) =>
    setProfile((current) => ({
      ...current,
      [field]:
        field === "licenseExpirationDate" || field === "ashaCccSlpNumber"
          ? value || null
          : value,
    }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!setup.data || !allAgreementsAccepted) return;
    completion.mutate({
      data: {
        profile,
        agreements: setup.data.agreements.map((agreement) => ({
          type: agreement.type,
          version: agreement.version,
        })),
      },
    });
  };

  if (setup.isLoading || !initialized) {
    return (
      <main className="paper-grain grid min-h-[100dvh] place-items-center bg-background p-4">
        <p className="text-sm font-semibold text-muted-foreground">
          Preparing your SLP account setup...
        </p>
      </main>
    );
  }
  if (setup.isError || !setup.data) {
    return (
      <main className="paper-grain grid min-h-[100dvh] place-items-center bg-background p-4">
        <section className="w-full max-w-md rounded-md border border-border bg-card p-6 text-center soft-shadow">
          <ShieldCheck className="mx-auto text-primary" size={30} />
          <h1 className="serif mt-4 text-2xl font-semibold">
            Account setup unavailable
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            We could not securely load your invited SLP profile. Your account
            has not been activated.
          </p>
          <Button className="mt-5" onClick={() => setup.refetch()}>
            Try again
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="paper-grain min-h-[100dvh] bg-background px-3 py-5 sm:px-6 sm:py-8">
      <form
        onSubmit={submit}
        className="mx-auto w-full max-w-4xl overflow-hidden rounded-md border border-border bg-card soft-shadow"
      >
        <header className="border-b border-border px-4 py-5 sm:px-7 sm:py-6">
          <div className="flex items-center gap-3 text-primary">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary">
              <Leaf size={21} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground">
                Invited SLP account
              </p>
              <h1 className="serif text-3xl font-semibold">Account Setup</h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Complete your professional profile for {setup.data.organizationName}
            . You are signed in as {setup.data.email}.
          </p>
        </header>

        <section className="px-4 py-6 sm:px-7">
          <h2 className="text-lg font-bold text-primary">
            Professional information
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ProfileField
              label="First name"
              required
              value={profile.firstName}
              onChange={(value) => update("firstName", value)}
            />
            <ProfileField
              label="Last name"
              required
              value={profile.lastName}
              onChange={(value) => update("lastName", value)}
            />
            <ProfileField
              label="Professional title"
              required
              value={profile.professionalTitle}
              onChange={(value) => update("professionalTitle", value)}
            />
            <ProfileField
              label="School"
              required
              value={profile.school}
              onChange={(value) => update("school", value)}
            />
            <label className="block text-sm font-semibold text-primary">
              School district <span aria-hidden="true">*</span>
              <select
                className={fieldClass}
                value={profile.districtId || ""}
                required
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    districtId: Number(event.target.value),
                  }))
                }
              >
                <option value="">Select your school district</option>
                {setup.data.districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Districts are managed by ChildLed. Contact support if yours is
                not listed.
              </span>
            </label>
            <ProfileField
              label="State of SLP licensure"
              required
              value={profile.licensureState}
              onChange={(value) => update("licensureState", value)}
            />
            <ProfileField
              label="SLP license number"
              required
              value={profile.licenseNumber}
              onChange={(value) => update("licenseNumber", value)}
            />
            <ProfileField
              label="License expiration date"
              type="date"
              value={profile.licenseExpirationDate ?? ""}
              onChange={(value) => update("licenseExpirationDate", value)}
            />
            <ProfileField
              label="ASHA CCC-SLP number"
              value={profile.ashaCccSlpNumber ?? ""}
              onChange={(value) => update("ashaCccSlpNumber", value)}
            />
          </div>
          <p className="mt-4 rounded-md bg-muted/55 p-3 text-xs leading-5 text-muted-foreground">
            License information is self-reported. Entering it does not mean
            ChildLed has verified the license or credential.
          </p>
        </section>

        <section className="border-t border-border px-4 py-6 sm:px-7">
          <h2 className="text-lg font-bold text-primary">
            Required agreements
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Review and acknowledge each document separately before activating
            your account.
          </p>
          <div className="mt-4 space-y-3">
            {setup.data.agreements.map((agreement) => {
              const key = `${agreement.type}:${agreement.version}`;
              const checked = accepted.has(key);
              return (
                <div
                  key={key}
                  className="flex items-start gap-3 rounded-md border border-border bg-background p-4"
                >
                  <input
                    id={`agreement-${agreement.type}`}
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      setAccepted((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(key);
                        else next.delete(key);
                        return next;
                      });
                    }}
                    className="mt-0.5 size-5 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-primary">
                      <label
                        htmlFor={`agreement-${agreement.type}`}
                        className="cursor-pointer"
                      >
                        {agreement.title}
                      </label>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs underline underline-offset-4"
                        onClick={() =>
                          setActiveDocument({
                            title: agreement.title,
                            documentPath: agreement.documentPath,
                          })
                        }
                      >
                        Read document <BookOpen size={12} />
                      </button>
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      {agreement.statement}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Version {agreement.version}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="sticky bottom-0 border-t border-border bg-card px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-7">
          <p className="text-xs leading-5 text-muted-foreground">
            Your SLP workspace remains restricted until setup is complete.
          </p>
          <Button
            type="submit"
            className="mt-3 w-full sm:mt-0 sm:w-auto"
            disabled={completion.isPending || !allAgreementsAccepted}
          >
            <Check size={16} />
            {completion.isPending ? "Activating account..." : "Complete Setup"}
          </Button>
        </footer>
        {completion.isError ? (
          <p className="border-t border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-7">
            Account setup could not be saved. Your entries are still here; try
            again.
          </p>
        ) : null}
      </form>
      <AgreementDocumentDialog
        document={activeDocument}
        onClose={() => setActiveDocument(null)}
      />
    </main>
  );
}

function AgreementDocumentDialog({
  document,
  onClose,
}: {
  document: { title: string; documentPath: string } | null;
  onClose: () => void;
}) {
  const privacyDocument = document?.documentPath.startsWith("/privacy");
  const sections = privacyDocument ? privacyPolicySections : termsOfUseSections;
  const documentTitle = privacyDocument ? "Privacy Policy" : "Terms of Use";
  const targetSection = document?.documentPath.split("#")[1];
  const targetSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!document || !targetSection) return;
    const frame = window.requestAnimationFrame(() =>
      targetSectionRef.current?.scrollIntoView({ block: "start" }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [document, targetSection]);

  return (
    <Dialog
      open={Boolean(document)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="grid max-h-[calc(100dvh-1rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-h-[85dvh] sm:p-0">
        <DialogHeader className="border-b border-border px-5 py-5 pr-14 sm:px-7 sm:py-6 sm:pr-16">
          <p className="text-xs font-bold uppercase text-muted-foreground">
            {document?.title}
          </p>
          <DialogTitle className="serif text-2xl text-primary sm:text-3xl">
            {documentTitle}
          </DialogTitle>
          <DialogDescription className="sr-only">
            ChildLed onboarding agreement document
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-5 sm:px-7">
          <aside className="rounded-md border border-accent/40 bg-secondary/55 p-4 text-sm leading-6 text-foreground">
            {LEGAL_REVIEW_NOTICE}
          </aside>
          <div className="mt-5 space-y-3">
            {sections.map((section) => (
              <section
                key={section.title}
                ref={
                  targetSection === section.id ? targetSectionRef : undefined
                }
                className={`rounded-md border p-4 sm:p-5 ${
                  targetSection === section.id
                    ? "border-accent bg-accent/10"
                    : "border-border bg-card"
                }`}
              >
                <h3 className="serif text-xl font-semibold text-primary">
                  {section.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {section.body}
                </p>
              </section>
            ))}
          </div>
        </div>
        <div className="border-t border-border bg-card px-4 py-3 sm:px-7">
          <Button type="button" className="w-full sm:w-auto" onClick={onClose}>
            Return to account setup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "text" | "date";
}) {
  return (
    <label className="block text-sm font-semibold text-foreground">
      {label}
      {!required ? (
        <span className="ml-1 font-normal text-muted-foreground">Optional</span>
      ) : null}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      />
    </label>
  );
}
