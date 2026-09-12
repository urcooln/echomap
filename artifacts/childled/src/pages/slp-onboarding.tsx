import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  useCompleteSlpOnboarding,
  useGetSlpOnboarding,
  type SlpOnboardingProfileInput,
} from "@workspace/api-client-react";
import { Check, ExternalLink, Leaf, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const emptyProfile: SlpOnboardingProfileInput = {
  firstName: "",
  lastName: "",
  professionalTitle: "Speech-Language Pathologist",
  school: "",
  schoolDistrict: "",
  licensureState: "",
  licenseNumber: "",
  licenseExpirationDate: null,
  ashaCccSlpNumber: null,
};

const fieldClass =
  "mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-ring sm:h-10 sm:text-sm";

export function SlpOnboardingPage({
  onCompleted,
}: {
  onCompleted: () => void;
}) {
  const setup = useGetSlpOnboarding();
  const completion = useCompleteSlpOnboarding({
    mutation: { onSuccess: onCompleted },
  });
  const [profile, setProfile] =
    useState<SlpOnboardingProfileInput>(emptyProfile);
  const [accepted, setAccepted] = useState<Set<string>>(() => new Set());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!setup.data || initialized) return;
    setProfile({
      firstName: setup.data.profile.firstName,
      lastName: setup.data.profile.lastName,
      professionalTitle: setup.data.profile.professionalTitle,
      school: setup.data.profile.school,
      schoolDistrict: setup.data.profile.schoolDistrict,
      licensureState: setup.data.profile.licensureState,
      licenseNumber: setup.data.profile.licenseNumber,
      licenseExpirationDate: setup.data.profile.licenseExpirationDate,
      ashaCccSlpNumber: setup.data.profile.ashaCccSlpNumber,
    });
    setAccepted(
      new Set(
        setup.data.agreements
          .filter((agreement) => agreement.accepted)
          .map((agreement) => `${agreement.type}:${agreement.version}`),
      ),
    );
    setInitialized(true);
  }, [initialized, setup.data]);

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
            <ProfileField
              label="School district"
              required
              value={profile.schoolDistrict}
              onChange={(value) => update("schoolDistrict", value)}
            />
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
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-4"
                >
                  <input
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
                      {agreement.title}
                      <a
                        href={agreement.documentPath}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs underline underline-offset-4"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Read document <ExternalLink size={12} />
                      </a>
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      {agreement.statement}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Version {agreement.version}
                    </span>
                  </span>
                </label>
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
    </main>
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
