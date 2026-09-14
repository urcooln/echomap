import { useEffect, useState, type FormEvent } from "react";
import {
  useCompleteCareTeamOnboarding,
  useGetCareTeamOnboarding,
} from "@workspace/api-client-react";
import { Check, GraduationCap, Heart, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const inputClass =
  "mt-2 h-12 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-ring sm:h-11 sm:text-sm";

export function CareTeamOnboardingPage({
  onCompleted,
}: {
  onCompleted: () => void;
}) {
  const setup = useGetCareTeamOnboarding();
  const completion = useCompleteCareTeamOnboarding({
    mutation: { onSuccess: onCompleted },
  });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!setup.data || initialized) return;
    setFirstName(setup.data.firstName);
    setLastName(setup.data.lastName);
    setInitialized(true);
  }, [initialized, setup.data]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    completion.mutate({
      data: { firstName: firstName.trim(), lastName: lastName.trim() },
    });
  };

  if (setup.isLoading || !initialized) {
    return (
      <main className="paper-grain grid min-h-[100dvh] place-items-center bg-background p-4">
        <p className="text-sm font-semibold text-muted-foreground">
          Preparing your account setup...
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
            We could not securely load your invited account. Your student access
            has not changed.
          </p>
          <Button className="mt-5" onClick={() => setup.refetch()}>
            Try again
          </Button>
        </section>
      </main>
    );
  }

  const isParent = setup.data.role === "Parent";
  const RoleIcon = isParent ? Heart : GraduationCap;

  return (
    <main className="paper-grain min-h-[100dvh] bg-background px-3 py-5 sm:px-6 sm:py-8">
      <form
        onSubmit={submit}
        className="mx-auto w-full max-w-2xl overflow-hidden rounded-md border border-border bg-card soft-shadow"
      >
        <header className="border-b border-border px-4 py-5 sm:px-7 sm:py-6">
          <div className="flex items-center gap-3 text-primary">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-secondary">
              <RoleIcon size={22} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground">
                Invited {setup.data.role} account
              </p>
              <h1 className="serif text-3xl font-semibold">Account Setup</h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Add your name so the student’s care team knows who messages and
            updates are from. You are signed in as {setup.data.email}.
          </p>
        </header>

        <section className="px-4 py-6 sm:px-7">
          <h2 className="text-lg font-bold text-primary">Your identity</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-foreground">
              First name
              <input
                autoFocus
                autoComplete="given-name"
                required
                maxLength={120}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className={inputClass}
                data-testid="input-care-team-first-name"
              />
            </label>
            <label className="block text-sm font-semibold text-foreground">
              Last name
              <input
                autoComplete="family-name"
                required
                maxLength={120}
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className={inputClass}
                data-testid="input-care-team-last-name"
              />
            </label>
          </div>
        </section>

        <section className="border-t border-border px-4 py-6 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-primary">
              <Users size={18} />
            </span>
            <div>
              <h2 className="font-bold text-primary">Student access</h2>
              <p className="text-xs text-muted-foreground">
                Assigned by the invitation from {setup.data.organizationName}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {setup.data.students.map((student) => (
              <div
                key={student.id}
                className="rounded-md border border-border bg-secondary/35 px-4 py-3 text-sm font-semibold text-primary"
              >
                {student.name}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Completing setup does not add access to any other students.
          </p>
        </section>

        {completion.isError ? (
          <p className="border-t border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-7">
            Account setup could not be saved. Your entries are still here; try
            again.
          </p>
        ) : null}

        <footer className="border-t border-border bg-card px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-7">
          <p className="text-xs leading-5 text-muted-foreground">
            Your {isParent ? "family" : "teacher"} workspace opens after setup.
          </p>
          <Button
            type="submit"
            className="mt-3 w-full sm:mt-0 sm:w-auto"
            disabled={
              completion.isPending || !firstName.trim() || !lastName.trim()
            }
            data-testid="button-complete-care-team-onboarding"
          >
            <Check size={16} />
            {completion.isPending ? "Saving..." : "Complete Setup"}
          </Button>
        </footer>
      </form>
    </main>
  );
}
