import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  getGetClinicianOverviewQueryKey,
  getGetManualSessionSetupQueryKey,
  getListIepServiceRequirementsQueryKey,
  useListIepServiceRequirements,
  type Child,
  type IepServiceRequirement,
} from "@workspace/api-client-react";
import { ArrowLeft, Check, Plus, Settings2, Trash2 } from "lucide-react";
import {
  ArchiveServiceDialog,
  ServiceRequirementForm,
  serviceTypeLabel,
} from "@/components/service-requirement-form";
import { Button } from "@/components/ui/button";

export function ServiceSetupPage({
  child,
  onFinish,
}: {
  child: Child;
  onFinish: () => void;
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<IepServiceRequirement>();
  const [deleting, setDeleting] = useState<IepServiceRequirement>();
  const [formKey, setFormKey] = useState(0);
  const [savedService, setSavedService] = useState<IepServiceRequirement>();
  const serviceParams = { childId: child.id, includeInactive: true };
  const servicesQuery = useListIepServiceRequirements(serviceParams, {
    query: {
      queryKey: getListIepServiceRequirementsQueryKey(serviceParams),
      retry: false,
    },
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getListIepServiceRequirementsQueryKey(serviceParams),
      }),
      queryClient.invalidateQueries({
        queryKey: getGetManualSessionSetupQueryKey({ childId: child.id }),
      }),
      queryClient.invalidateQueries({
        queryKey: getGetClinicianOverviewQueryKey(),
      }),
    ]);
  };

  if (savedService && !editing) {
    return (
      <main className="mx-auto max-w-2xl py-6 animate-rise">
        <section className="border-y border-primary/20 bg-card px-5 py-10 text-center sm:rounded-lg sm:border sm:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-800">
            <Check size={28} />
          </span>
          <h1 className="serif mt-5 text-3xl font-semibold">
            Service added successfully
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {serviceTypeLabel(savedService.serviceType)} is now tracked
            independently for {child.name}.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              className="min-h-12"
              onClick={() => {
                setSavedService(undefined);
                setFormKey((value) => value + 1);
              }}
            >
              <Plus size={17} /> Add Another Service
            </Button>
            <Button className="min-h-12" onClick={onFinish}>
              Finish
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 py-4 animate-rise">
      <header className="px-1">
        <Button
          variant="ghost"
          className="mb-2 px-0"
          onClick={() => setLocation("/overview")}
        >
          <ArrowLeft size={16} /> SLP Overview
        </Button>
        <p className="text-xs font-semibold text-primary">Service setup</p>
        <h1 className="serif mt-1 text-3xl font-semibold md:text-4xl">
          Add Service for {child.name}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Each service has its own frequency, dates, session history, and
          compliance progress.
        </p>
      </header>

      {(servicesQuery.data?.length ?? 0) > 0 ? (
        <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <h2 className="font-semibold">Current services</h2>
          <div className="mt-3 divide-y divide-border">
            {servicesQuery.data?.map((service) => (
              <div
                key={service.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">
                    {serviceTypeLabel(service.serviceType)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {service.requiredSessions} {service.period} sessions at{" "}
                    {service.sessionDurationMinutes} minutes ·{" "}
                    {service.periodLabel}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button variant="outline" onClick={() => setEditing(service)}>
                    <Settings2 size={15} /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive"
                    onClick={() => setDeleting(service)}
                  >
                    <Trash2 size={15} /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-4 soft-shadow sm:p-6">
        <h2 className="serif text-2xl font-semibold">
          {editing ? "Edit service" : "Service details"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sessions will count only toward the service selected when they are
          logged.
        </p>
        <div className="mt-5">
          <ServiceRequirementForm
            key={`${editing?.id ?? "new"}-${formKey}`}
            childId={child.id}
            requirement={editing}
            onCancel={editing ? () => setEditing(undefined) : undefined}
            onSaved={async (service) => {
              await refresh();
              setEditing(undefined);
              setSavedService(service);
            }}
          />
        </div>
      </section>
      {deleting ? (
        <ArchiveServiceDialog
          childId={child.id}
          childName={child.name}
          service={deleting}
          open
          onOpenChange={(open) => {
            if (!open) setDeleting(undefined);
          }}
          onArchived={async () => {
            if (editing?.id === deleting.id) setEditing(undefined);
            setDeleting(undefined);
            await refresh();
          }}
        />
      ) : null}
    </main>
  );
}
