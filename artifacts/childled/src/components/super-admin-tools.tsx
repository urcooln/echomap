import { useMemo } from 'react';
import { useLocation, Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { roleOverviewPath } from '@/lib/role-routing';
import {
  useGetAdminUxTesting,
  useSetRolePreview,
  useClearRolePreview,
  getGetAdminUxTestingQueryKey,
} from '@workspace/api-client-react';
import type { Viewer, RolePreviewInputRole } from '@workspace/api-client-react';
import {
  ShieldAlert,
  LogOut,
  Check,
  Minus,
  Play,
  UserCircle,
  Eye,
  Info
} from 'lucide-react';

export function SuperAdminRoleSwitcher({
  viewer,
  onViewerChange,
}: {
  viewer: Viewer;
  onViewerChange: (viewer: Viewer) => void;
}) {
  const queryClient = useQueryClient();
  const setRolePreview = useSetRolePreview();
  const clearRolePreview = useClearRolePreview();

  if (!viewer.isSuperAdmin || !viewer.isDevelopmentDemo) {
    return null;
  }

  const isPreviewing = viewer.isRolePreview;

  const handleRoleChange = (role: string) => {
    if (!role) return;
    setRolePreview.mutate(
      { data: { role: role as RolePreviewInputRole } },
      {
        onSuccess: (newViewer) => {
          queryClient.clear();
          onViewerChange(newViewer);
        },
      }
    );
  };

  const handleClearPreview = () => {
    clearRolePreview.mutate(undefined, {
      onSuccess: (newViewer) => {
        queryClient.clear();
        onViewerChange(newViewer);
      },
    });
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5" data-testid="super-admin-role-switcher">
      <div className="relative min-w-0">
        <Eye size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <select
          aria-label="Select development persona"
          title={`Viewing as ${viewer.name} - ${viewer.role}`}
          data-testid="select-role-preview"
          value={isPreviewing ? viewer.role : ''}
          onChange={(event) => handleRoleChange(event.target.value)}
          disabled={setRolePreview.isPending}
          className="h-11 w-[11.75rem] appearance-none rounded-md border border-input bg-card pl-8 pr-2 text-xs font-semibold text-foreground outline-none focus-ring disabled:opacity-50 sm:h-9 sm:w-[14rem]"
        >
          <option value="" disabled>Choose persona</option>
          <option value="SLP">Dr. Lena Ortiz - SLP</option>
          <option value="Teacher">Jordan Blake - Teacher</option>
          <option value="Parent">Maya Chen - Parent</option>
          <option value="Administrator">Demo Administrator - Admin</option>
        </select>
      </div>
      {isPreviewing && (
        <button
          onClick={handleClearPreview}
          disabled={clearRolePreview.isPending}
          data-testid="button-clear-role-preview"
          aria-label="Return to super admin view"
          title="Return to super admin view"
          className="grid size-11 shrink-0 place-items-center rounded-md border border-input bg-card text-primary hover:bg-muted focus-ring disabled:opacity-50 sm:size-9"
        >
          <LogOut size={15} />
        </button>
      )}
    </div>
  );
}
export function UxTestingCenter({
  viewer,
  onViewerChange,
}: {
  viewer: Viewer;
  onViewerChange: (viewer: Viewer) => void;
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const canUseTestingCenter =
    viewer.isSuperAdmin && viewer.isDevelopmentDemo && !viewer.isRolePreview;
  const { data: uxTesting, isLoading, isError } = useGetAdminUxTesting({
    query: {
      queryKey: getGetAdminUxTestingQueryKey(),
      enabled: canUseTestingCenter,
    }
  });
  
  const setRolePreview = useSetRolePreview();

  const handleLaunchPreview = (role: string, path?: string) => {
    setRolePreview.mutate(
      { data: { role: role as RolePreviewInputRole } },
      {
        onSuccess: (newViewer) => {
          queryClient.clear();
          onViewerChange(newViewer);
          setLocation(path || roleOverviewPath(newViewer.role) || '/');
        },
      }
    );
  };

  const allCapabilities = useMemo(() => {
    if (!uxTesting?.permissions) return [];
    return Array.from(new Set(uxTesting.permissions.flatMap(p => p.capabilities))).sort();
  }, [uxTesting]);

  if (viewer.isRolePreview) {
    return (
      <section data-testid="status-owner-tools-preview-restricted" className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 text-center soft-shadow animate-in fade-in slide-in-from-bottom-4 duration-500">
        <ShieldAlert className="mx-auto text-primary" size={30} />
        <p className="mono mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Preview mode</p>
        <h1 className="serif mt-2 text-3xl font-semibold">Testing Center paused</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Return to Super Admin view before using owner testing tools. This keeps the selected role preview free of owner-only controls.
        </p>
        <Link href="/" data-testid="link-return-to-preview-portal" className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_20px_-14px_hsl(var(--brand-forest-950)/.9)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md focus-ring">
          Return to preview portal
        </Link>
      </section>
    );
  }

  if (!viewer.isSuperAdmin || !viewer.isDevelopmentDemo) {
    return (
      <section data-testid="status-role-restricted" className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 text-center soft-shadow animate-in fade-in slide-in-from-bottom-4 duration-500">
        <ShieldAlert className="mx-auto text-primary" size={30} />
        <p className="mono mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Restricted Access</p>
        <h1 className="serif mt-2 text-3xl font-semibold">Development demo only</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Persona testing is available only through the authenticated development demo session.
        </p>
        <Link href="/" data-testid="link-return-to-portal" className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_20px_-14px_hsl(var(--brand-forest-950)/.9)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md focus-ring">
          Return to Dashboard
        </Link>
      </section>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-label="Loading content" data-testid="status-loading">
        <div className="skeleton h-32 rounded-3xl" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="skeleton h-32 rounded-2xl" />
          <div className="skeleton h-32 rounded-2xl" />
          <div className="skeleton h-32 rounded-2xl" />
          <div className="skeleton h-32 rounded-2xl" />
        </div>
        <div className="skeleton h-96 rounded-3xl" />
      </div>
    );
  }

  if (isError || !uxTesting) {
    return (
      <section className="brand-card mx-auto max-w-2xl rounded-3xl border border-dashed border-border bg-card/75 p-8 text-center">
        <Info className="mx-auto text-muted-foreground" size={24} />
        <p className="mt-4 text-sm text-muted-foreground">Unable to load UX testing catalog. Please try again later.</p>
      </section>
    );
  }

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden animate-in fade-in duration-500">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Super Admin Tools</p>
          <h1 className="serif text-3xl font-semibold tracking-tight text-foreground md:text-4xl">UX Testing Center</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Validate and experience the portal exactly as different roles see it. Launch simulated previews to ensure caregiver and clinician workflows are safe and coherent.
          </p>
        </div>
      </div>

      <div className="brand-card relative mb-8 overflow-hidden rounded-3xl border border-border bg-card p-4 soft-shadow sm:p-6 md:p-8">
        <div className="relative">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
              <UserCircle size={20} />
            </div>
            <div>
              <h2 className="serif text-xl font-semibold text-foreground">Fictional Sample Context</h2>
              <p className="text-xs text-muted-foreground">
                The identity is fictional. Role previews use only your already-authorized child context and the selected role's server-side redactions.
              </p>
            </div>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border/50 bg-background/50 p-4">
              <p className="mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Simulated User</p>
              <p className="mt-1 font-medium">{uxTesting.sampleUser.displayName}</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/50 p-4">
              <p className="mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Account Email</p>
              <p className="mt-1 font-medium">{uxTesting.sampleUser.email}</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/50 p-4">
              <p className="mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Simulated Child</p>
              <p className="mt-1 font-medium">{uxTesting.sampleUser.childName}</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/50 p-4">
              <p className="mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Scenario</p>
              <p className="mt-1 text-sm">{uxTesting.sampleUser.description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="serif mb-5 text-2xl font-semibold">Representative Workflows</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {uxTesting.workflows.map((workflow) => (
            <div key={`${workflow.label}-${workflow.path}`} className="brand-card flex flex-col rounded-3xl border border-border bg-card p-4 soft-shadow transition-all hover:border-primary/20 hover:shadow-md sm:p-6">
              <h3 className="font-semibold text-foreground">{workflow.label}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{workflow.description}</p>
              <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-border/50">
                {workflow.roles.map((role) => (
                  <button
                    key={role}
                    onClick={() => handleLaunchPreview(role, workflow.path)}
                    disabled={setRolePreview.isPending}
                    data-testid={`button-test-workflow-${role.toLowerCase()}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50 focus-ring"
                  >
                    <Play size={12} />
                    Test as {role}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="serif mb-5 text-2xl font-semibold">Access Matrix</h2>
        <div className="brand-card w-full max-w-full overflow-x-auto overscroll-x-contain rounded-3xl border border-border bg-card soft-shadow">
          <div className="divide-y divide-border sm:hidden">
            {uxTesting.permissions.map((permission) => (
              <section key={permission.role} className="p-4">
                <h3 className="font-semibold text-foreground">
                  {permission.label}
                </h3>
                <ul className="mt-3 space-y-2">
                  {permission.capabilities.map((capability) => (
                    <li
                      key={capability}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Check
                        className="mt-0.5 shrink-0 text-primary"
                        size={15}
                        strokeWidth={3}
                      />
                      <span>{capability}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <table className="hidden w-full min-w-[32rem] whitespace-nowrap text-left text-sm sm:table">
            <thead className="bg-secondary/30 text-muted-foreground">
              <tr>
                <th className="p-5 font-semibold w-1/3">Capability</th>
                {uxTesting.permissions.map((p) => (
                  <th key={p.role} className="p-5 font-semibold">{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allCapabilities.map((cap) => (
                <tr key={cap} className="transition-colors hover:bg-muted/30">
                  <td className="p-5 font-medium text-foreground">{cap}</td>
                  {uxTesting.permissions.map((p) => {
                    const hasCap = p.capabilities.includes(cap);
                    return (
                      <td key={p.role} className="p-5">
                        {hasCap ? (
                          <div className="flex items-center gap-2 text-primary">
                            <Check size={16} strokeWidth={3} />
                            <span className="sr-only">Allowed</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-muted-foreground/30">
                            <Minus size={16} strokeWidth={3} />
                            <span className="sr-only">Denied</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
