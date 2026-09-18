import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Building2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createSchoolDistrict,
  assignSlpDistrict,
  getSchoolDistrict,
  listSchoolDistricts,
  listUnassignedSlpDistricts,
  updateSchoolDistrict,
} from "@workspace/api-client-react";

const districtListKey = ["admin", "school-districts"] as const;

export function SchoolDistrictSummary() {
  const { data, isLoading, isError } = useQuery({
    queryKey: districtListKey,
    queryFn: listSchoolDistricts,
  });
  return (
    <section className="rounded-md border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Building2 className="text-primary" size={22} />
          <h2 className="serif mt-3 text-xl font-semibold">School Districts</h2>
        </div>
        <Link
          href="/school-districts"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          Manage <ArrowRight size={16} />
        </Link>
      </div>
      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Loading districts...
        </p>
      ) : null}
      {isError ? (
        <p className="mt-3 text-sm text-destructive">
          Districts are unavailable right now.
        </p>
      ) : null}
      {data?.map((district) => (
        <Link
          key={district.id}
          href={`/school-districts/${district.id}`}
          className="mt-4 block border-t border-border pt-3 hover:underline"
        >
          <span className="font-semibold">{district.name}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {district.slpCount} SLPs · {district.teacherCount} teachers ·{" "}
            {district.studentCount} students ·{" "}
            {district.active ? "Active" : "Inactive"}
          </span>
        </Link>
      ))}
    </section>
  );
}

export function SchoolDistrictsPage({ districtId }: { districtId?: number }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [legacyAssignments, setLegacyAssignments] = useState<
    Record<number, number>
  >({});
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: districtListKey,
    queryFn: listSchoolDistricts,
  });
  const unassigned = useQuery({
    queryKey: ["admin", "unassigned-slp-districts"],
    queryFn: listUnassignedSlpDistricts,
    enabled: !districtId,
  });
  const detail = useQuery({
    queryKey: [...districtListKey, districtId],
    queryFn: () => getSchoolDistrict(districtId!),
    enabled: Boolean(districtId),
  });
  const save = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id?: number;
      body: { name?: string; active?: boolean };
    }) =>
      id
        ? updateSchoolDistrict(id, body)
        : createSchoolDistrict({ name: body.name ?? "" }),
    onSuccess: async () => {
      setError(null);
      setName("");
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: districtListKey });
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const assign = useMutation({
    mutationFn: ({
      profileId,
      districtId,
    }: {
      profileId: number;
      districtId: number;
    }) => assignSlpDistrict(profileId, { districtId }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const selected = districtId ? detail.data : undefined;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ id: districtId, body: { name: name.trim() } });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-rise">
      <div>
        <Link
          href={districtId ? "/school-districts" : "/admin-overview"}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft size={16} />{" "}
          {districtId ? "All districts" : "Admin overview"}
        </Link>
        <h1 className="serif mt-3 text-3xl font-semibold text-primary">
          {districtId
            ? (selected?.name ?? "School district")
            : "School Districts"}
        </h1>
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      {districtId ? (
        detail.isLoading ? (
          <p>Loading district...</p>
        ) : detail.isError || !selected ? (
          <p role="alert" className="text-destructive">
            This district could not be loaded.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-border pb-5">
              <span className="text-sm font-semibold">
                {selected.active ? "Active" : "Inactive"}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setName(selected.name);
                  setEditing((value) => !value);
                }}
              >
                <Pencil size={15} /> Rename
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={save.isPending}
                onClick={() =>
                  save.mutate({
                    id: selected.id,
                    body: { active: !selected.active },
                  })
                }
              >
                {selected.active ? "Deactivate" : "Activate"}
              </Button>
            </div>
            {editing ? (
              <form onSubmit={submit} className="flex flex-wrap gap-2">
                <label className="min-w-0 flex-1 text-sm font-semibold">
                  District name
                  <input
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={160}
                  />
                </label>
                <Button type="submit" disabled={save.isPending}>
                  Save name
                </Button>
              </form>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["SLPs", selected.slps.length],
                ["Teachers", selected.teachers.length],
                ["Students", selected.students.length],
              ].map(([label, count]) => (
                <div
                  key={label}
                  className="rounded-md border border-border bg-card p-4"
                >
                  <div className="text-2xl font-semibold text-primary">
                    {count}
                  </div>
                  <div className="text-sm text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
            <DistrictPeople
              title="SLPs"
              district={selected.name}
              people={selected.slps}
            />
            <DistrictPeople
              title="Teachers"
              district={selected.name}
              people={selected.teachers}
            />
            <DistrictPeople
              title="Students"
              district={selected.name}
              people={selected.students}
            />
          </>
        )
      ) : (
        <>
          <form
            onSubmit={submit}
            className="flex flex-wrap items-end gap-3 border-b border-border pb-6"
          >
            <label className="min-w-0 flex-1 text-sm font-semibold">
              Add a district
              <input
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="District name"
                required
                maxLength={160}
              />
            </label>
            <Button type="submit" disabled={save.isPending}>
              <Plus size={16} /> Add district
            </Button>
          </form>
          {list.isLoading ? <p>Loading districts...</p> : null}
          {list.isError ? (
            <p role="alert" className="text-destructive">
              School districts could not be loaded.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {list.data?.map((district) => (
              <Link
                key={district.id}
                href={`/school-districts/${district.id}`}
                className="rounded-md border border-border bg-card p-5 hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 break-words font-semibold text-primary">
                    {district.name}
                  </h2>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {district.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {district.slpCount} SLPs · {district.teacherCount} teachers ·{" "}
                  {district.studentCount} students
                </p>
              </Link>
            ))}
          </div>
          {unassigned.data?.length ? (
            <section className="border-t border-border pt-6">
              <h2 className="serif text-xl font-semibold text-primary">
                SLPs awaiting district assignment
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review the original district entry before assigning an approved
                district. Existing text is preserved.
              </p>
              <div className="mt-4 divide-y divide-border rounded-md border border-border bg-card">
                {unassigned.data.map((profile) => (
                  <div
                    key={profile.profileId}
                    className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                  >
                    <div className="min-w-0 text-sm">
                      <strong className="block break-words text-primary">
                        {profile.name}
                      </strong>
                      <span className="block break-words text-muted-foreground">
                        {profile.organization}
                      </span>
                      <span className="block break-words text-muted-foreground">
                        Previous entry:{" "}
                        {profile.schoolDistrict || "Not provided"}
                      </span>
                    </div>
                    <label className="text-sm font-semibold">
                      Approved district
                      <select
                        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2"
                        value={legacyAssignments[profile.profileId] ?? ""}
                        onChange={(event) =>
                          setLegacyAssignments((current) => ({
                            ...current,
                            [profile.profileId]: Number(event.target.value),
                          }))
                        }
                      >
                        <option value="">Select district</option>
                        {list.data
                          ?.filter((district) => district.active)
                          .map((district) => (
                            <option key={district.id} value={district.id}>
                              {district.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        !legacyAssignments[profile.profileId] ||
                        assign.isPending
                      }
                      onClick={() =>
                        assign.mutate({
                          profileId: profile.profileId,
                          districtId: legacyAssignments[profile.profileId]!,
                        })
                      }
                    >
                      Assign
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {unassigned.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Unassigned SLPs could not be loaded.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function DistrictPeople({
  title,
  district,
  people,
}: {
  title: string;
  district: string;
  people: { id: string | number; name: string; childLedId?: string }[];
}) {
  return (
    <section className="border-t border-border pt-5">
      <h2 className="serif text-xl font-semibold text-primary">{title}</h2>
      {people.length ? (
        <div className="mt-3 divide-y divide-border rounded-md border border-border bg-card">
          {people.map((person) => (
            <div
              key={person.id}
              className="grid min-w-0 gap-1 p-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-3 sm:px-4"
            >
              <span className="min-w-0 break-words font-semibold">
                {person.name}
                {person.childLedId ? (
                  <small className="block font-normal text-muted-foreground">
                    {person.childLedId}
                  </small>
                ) : null}
              </span>
              <span className="min-w-0 break-words text-muted-foreground">
                <span className="sm:hidden">District: </span>
                {district}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No {title.toLowerCase()} assigned.
        </p>
      )}
    </section>
  );
}
