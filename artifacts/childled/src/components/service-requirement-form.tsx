import { type FormEvent, useState } from "react";
import {
  useUpsertIepServiceRequirement,
  type CaseloadServiceDeliveryType,
  type IepServiceRequirement,
  type ServiceFrequencyPeriod,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const serviceTypeOptions: Array<{
  value: CaseloadServiceDeliveryType;
  label: string;
}> = [
  { value: "individual", label: "Individual" },
  { value: "group", label: "Group" },
  { value: "co_treat_ot", label: "Co-Treat OT" },
  { value: "co_treat_pt", label: "Co-Treat PT" },
  { value: "integrated_group", label: "Integrated Group" },
  { value: "consult", label: "Consult" },
  {
    value: "assistive_technology",
    label: "Assistive Technology Services",
  },
];

export const serviceTypeLabel = (value: CaseloadServiceDeliveryType) =>
  serviceTypeOptions.find((option) => option.value === value)?.label ?? value;

const frequencyOptions: Array<{
  value: ServiceFrequencyPeriod;
  label: string;
}> = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

const localDate = (date = new Date()) => {
  const value = new Date(date);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 10);
};

const oneYearFromToday = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return localDate(date);
};

export function ServiceRequirementForm({
  childId,
  requirement,
  onSaved,
  onCancel,
}: {
  childId: number;
  requirement?: IepServiceRequirement;
  onSaved: (service: IepServiceRequirement) => void;
  onCancel?: () => void;
}) {
  const saveService = useUpsertIepServiceRequirement();
  const [serviceType, setServiceType] = useState<CaseloadServiceDeliveryType>(
    requirement?.serviceType ?? "individual",
  );
  const [period, setPeriod] = useState<ServiceFrequencyPeriod>(
    requirement?.period ?? "weekly",
  );
  const [requiredSessions, setRequiredSessions] = useState(
    String(requirement?.requiredSessions ?? 2),
  );
  const [minutesPerSession, setMinutesPerSession] = useState(
    String(requirement?.sessionDurationMinutes ?? 30),
  );
  const [effectiveFrom, setEffectiveFrom] = useState(
    requirement?.effectiveFrom ?? localDate(),
  );
  const [effectiveTo, setEffectiveTo] = useState(
    requirement?.effectiveTo ?? oneYearFromToday(),
  );
  const [customFrequencyDescription, setCustomFrequencyDescription] = useState(
    requirement?.customFrequencyDescription ?? "",
  );
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const sessions = Number(requiredSessions);
    const minutes = Number(minutesPerSession);
    if (
      !Number.isInteger(sessions) ||
      sessions < 1 ||
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      !effectiveFrom ||
      !effectiveTo ||
      effectiveTo < effectiveFrom ||
      (period === "custom" && !customFrequencyDescription.trim())
    ) {
      setError(
        "Enter whole-number session requirements, valid service dates, and custom scheduling details when needed.",
      );
      return;
    }

    try {
      const saved = await saveService.mutateAsync({
        params: { childId },
        data: {
          requirementId: requirement?.id ?? null,
          serviceType,
          period,
          requiredSessions: sessions,
          sessionDurationMinutes: minutes,
          requiredMinutes: sessions * minutes,
          customFrequencyDescription:
            period === "custom" ? customFrequencyDescription.trim() : null,
          effectiveFrom,
          effectiveTo,
        },
      });
      onSaved(saved);
    } catch (requestError: any) {
      setError(
        requestError?.data?.error ??
          requestError?.message ??
          "The service could not be saved. Your entries are still here.",
      );
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold">
            Service type
          </span>
          <select
            data-autofocus
            value={serviceType}
            onChange={(event) =>
              setServiceType(event.target.value as CaseloadServiceDeliveryType)
            }
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {serviceTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-semibold">
            Frequency period
          </span>
          <select
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value as ServiceFrequencyPeriod)
            }
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {frequencyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted-foreground">
            Defines the compliance tracking period.
          </span>
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-semibold">
            Sessions required
          </span>
          <Input
            type="number"
            min="1"
            max="100"
            inputMode="numeric"
            value={requiredSessions}
            onChange={(event) => setRequiredSessions(event.target.value)}
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Required during each selected frequency period.
          </span>
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-semibold">
            Minutes per session
          </span>
          <Input
            type="number"
            min="1"
            max="480"
            inputMode="numeric"
            value={minutesPerSession}
            onChange={(event) => setMinutesPerSession(event.target.value)}
          />
        </label>

        <div className="rounded-md bg-muted/45 p-3">
          <p className="text-xs text-muted-foreground">
            Planned minutes per period
          </p>
          <p className="mt-1 font-semibold">
            {(Number(requiredSessions) || 0) * (Number(minutesPerSession) || 0)}{" "}
            minutes
          </p>
        </div>

        <label>
          <span className="mb-1.5 block text-sm font-semibold">
            Service start date
          </span>
          <Input
            type="date"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-semibold">
            Service end date
          </span>
          <Input
            type="date"
            value={effectiveTo}
            onChange={(event) => setEffectiveTo(event.target.value)}
          />
        </label>
      </div>

      {period === "custom" ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">
            Custom frequency details
          </span>
          <Input
            value={customFrequencyDescription}
            onChange={(event) =>
              setCustomFrequencyDescription(event.target.value)
            }
            placeholder="For example: every other week"
          />
        </label>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={saveService.isPending}>
          {saveService.isPending
            ? "Saving..."
            : requirement
              ? "Save changes"
              : "Add service"}
        </Button>
      </div>
    </form>
  );
}
