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
  FlaskConical,
  Check,
  Minus,
  Play,
  UserCircle,
  Eye,
  Info
} from 'lucide-react';

export function SuperAdminPreviewBanner({
  viewer,
  onViewerChange,
}: {
  viewer: Viewer;
  onViewerChange: (viewer: Viewer) => void;
}) {
  const queryClient = useQueryClient();
  const setRolePreview = useSetRolePreview();
  const clearRolePreview = useClearRolePreview();

  if (!viewer.isSuperAdmin) {
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
    <div 
      className="bg-primary px-5 py-3 text-primary-foreground flex flex-wrap items-center justify-between gap-4 border-b border-primary-foreground/10 shadow-[0_4px_12px_-4px_hsl(var(--primary)/.5)]"
      data-testid="super-admin-preview-banner"
    >
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-xl bg-primary-foreground/20 text-primary-foreground">
          <FlaskConical size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold" data-testid="banner-role-status">
            {isPreviewing ? `Viewing as ${viewer.role === 'Administrator' ? 'Admin' : viewer.role}` : 'Super Admin Mode'}
          </p>
          <p className="text-xs text-primary-foreground/80">
            {isPreviewing 
              ? 'You are viewing the workspace as a simulated user.' 
              : 'You have full access to all roles and testing tools.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            aria-label="Select role to preview"
            data-testid="select-role-preview"
            value={isPreviewing ? viewer.role : ''}
            onChange={(e) => handleRoleChange(e.target.value)}
            disabled={setRolePreview.isPending}
            className="appearance-none rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 pl-4 pr-10 py-2.5 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary-foreground/20 focus-ring disabled:opacity-50"
          >
            <option value="" disabled className="text-foreground">Select role to preview...</option>
            <option value="SLP" className="text-foreground">SLP</option>
            <option value="Parent" className="text-foreground">Parent</option>
            <option value="Teacher" className="text-foreground">Teacher</option>
            <option value="Administrator" className="text-foreground">Admin</option>
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary-foreground/70">
            <Eye size={16} />
          </div>
        </div>

        {isPreviewing && (
          <button
            onClick={handleClearPreview}
            disabled={clearRolePreview.isPending}
            data-testid="button-clear-role-preview"
            className="inline-flex items-center gap-2 rounded-xl bg-primary-foreground px-4 py-2.5 text-sm font-semibold text-primary transition-all hover:-translate-y-0.5 hover:bg-primary-foreground/90 focus-ring disabled:opacity-50"
          >
            <LogOut size={16} />
            Return to Admin View
          </button>
        )}
      </div>
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
  const canUseTestingCenter = viewer.isSuperAdmin && !viewer.isRolePreview;
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

  if (!viewer.isSuperAdmin) {
    return (
      <section data-testid="status-role-restricted" className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 text-center soft-shadow animate-in fade-in slide-in-from-bottom-4 duration-500">
        <ShieldAlert className="mx-auto text-primary" size={30} />
        <p className="mono mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Restricted Access</p>
        <h1 className="serif mt-2 text-3xl font-semibold">Super Admin Only</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The UX Testing Center is only available to Super Admins for validating role experiences.
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
    <div className="animate-in fade-in duration-500">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Super Admin Tools</p>
          <h1 className="serif text-3xl font-semibold tracking-tight text-foreground md:text-4xl">UX Testing Center</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Validate and experience the portal exactly as different roles see it. Launch simulated previews to ensure caregiver and clinician workflows are safe and coherent.
          </p>
        </div>
      </div>

      <div className="brand-card mb-8 rounded-3xl border border-border bg-card p-6 md:p-8 soft-shadow relative overflow-hidden">
        <div className="absolute -right-20 -top-20 size-64 rounded-full border-[30px] border-primary/5 opacity-50" />
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
            <div key={`${workflow.label}-${workflow.path}`} className="brand-card flex flex-col rounded-3xl border border-border bg-card p-6 soft-shadow transition-all hover:border-primary/20 hover:shadow-md">
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
        <div className="brand-card overflow-x-auto rounded-3xl border border-border bg-card soft-shadow">
          <table className="w-full text-left text-sm whitespace-nowrap">
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
