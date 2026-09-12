import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { AlertCircle, Leaf, Shield, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import type { Viewer } from '@workspace/api-client-react';

export function RequestBetaAccessPage() {
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [formData, setFormData] = useState({ fullName: '', email: '', role: 'Clinician', organization: '', message: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('submitting');
    try {
      const res = await fetch('/api/beta-access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      });
      if (res.ok) {
        setState('success');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  };

  if (state === 'success') {
    return (
      <main className="paper-grain grid min-h-[100dvh] place-items-center bg-background px-3 py-5 sm:px-5 sm:py-8">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-center soft-shadow sm:rounded-[2rem] sm:p-8">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <CheckCircle size={24} />
          </div>
          <h1 className="serif mt-4 text-3xl font-semibold text-foreground">Request Received</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Thank you for your interest in ChildLed. Your request has been securely recorded.
            Because this is a private care-team environment, we review requests carefully and 
            will reach out if we can accommodate your team.
          </p>
          <div className="mt-8">
            <Link href="/" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-ring sm:w-auto">
              Return to home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="paper-grain grid min-h-[100dvh] place-items-center bg-background px-3 py-5 sm:px-5 sm:py-8">
      <section className="w-full max-w-xl rounded-2xl border border-border bg-card p-5 soft-shadow sm:rounded-[2rem] sm:p-10">
        <div className="text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-accent text-primary">
            <Leaf size={24} />
          </div>
          <h1 className="serif mt-4 text-3xl font-semibold">Request SLP Pilot Access</h1>
          <p className="mt-2 text-sm text-muted-foreground">ChildLed is invite-only. Approved SLPs can invite teachers and parents for assigned students.</p>
        </div>
        
        <form onSubmit={submit} className="mt-8 space-y-4">
          {state === 'error' && (
            <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
              <AlertCircle size={16} />
              <span>We couldn't submit your request. Please try again.</span>
            </div>
          )}
          
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-foreground">
              Full name
              <input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="mt-1 block w-full rounded-xl border border-input bg-background p-2.5 text-sm outline-none transition focus-ring" />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Email address
              <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="mt-1 block w-full rounded-xl border border-input bg-background p-2.5 text-sm outline-none transition focus-ring" />
            </label>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-foreground">
              Account type
              <input readOnly value="Speech-language pathologist (SLP)" className="mt-1 block w-full rounded-xl border border-input bg-secondary/40 p-2.5 text-sm text-muted-foreground outline-none" />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Organization / School
              <input required type="text" value={formData.organization} onChange={e => setFormData({...formData, organization: e.target.value})} className="mt-1 block w-full rounded-xl border border-input bg-background p-2.5 text-sm outline-none transition focus-ring" />
            </label>
          </div>
          
          <label className="block text-sm font-medium text-foreground">
            Message (optional)
            <textarea value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} className="mt-1 block min-h-[100px] w-full rounded-xl border border-input bg-background p-2.5 text-sm outline-none transition focus-ring"></textarea>
          </label>
          
          <div className="mt-6 flex flex-col items-stretch gap-4 pt-2 sm:flex-row sm:items-center">
            <Button type="submit" disabled={state === 'submitting'} className="w-full sm:w-auto">
              {state === 'submitting' ? 'Submitting...' : 'Request Access'}
            </Button>
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}

export function BetaNoticeScreen({ notice, onAcknowledge }: { notice: { text: string; version: string }; onAcknowledge: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const handleAcknowledge = async () => {
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch('/api/beta-notice/acknowledge', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        onAcknowledge();
      } else {
        setError(true);
        setSubmitting(false);
      }
    } catch {
      setError(true);
      setSubmitting(false);
    }
  };

  return (
    <main className="paper-grain grid min-h-[100dvh] place-items-center bg-background px-3 py-5 sm:px-5 sm:py-8">
      <section className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 soft-shadow sm:rounded-[2rem] sm:p-8">
        <div className="flex items-center gap-3 border-b border-border pb-5">
          <Shield className="text-primary" size={24} />
          <h1 className="serif text-2xl font-semibold">Beta Participation Notice</h1>
        </div>
        
        <div className="prose prose-sm mt-6 max-h-[50vh] max-w-none overflow-y-auto rounded-xl bg-secondary/30 p-5 text-muted-foreground">
          {notice.text.split('\n').map((paragraph, i) => (
            <p key={i} className="mb-4 last:mb-0">{paragraph}</p>
          ))}
        </div>
        
        {error && (
          <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            We couldn't record your acknowledgment. Please try again or contact support.
          </p>
        )}
        
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Review our <Link href="/privacy" className="text-primary underline">Privacy Policy</Link> and <Link href="/terms" className="text-primary underline">Terms of Use</Link>.
          </p>
          <Button className="w-full sm:w-auto" onClick={handleAcknowledge} disabled={submitting}>
            {submitting ? 'Acknowledging...' : 'Acknowledge and Continue'}
          </Button>
        </div>
      </section>
    </main>
  );
}

export function SuperAdminBetaControls() {
  const [requests, setRequests] = useState<any[]>([]);
  const [controls, setControls] = useState<{ enabled: boolean; invitationLimitPerDay: number; currentNoticeVersion: string } | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [targetId, setTargetId] = useState('');
  const [targetType, setTargetType] = useState<'users' | 'organizations'>('users');
  const [actionType, setActionType] = useState<'disable' | 'enable'>('disable');
  const [actionMessage, setActionMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqsRes, ctrlRes] = await Promise.all([
        fetch('/api/admin/beta-access-requests', { credentials: 'include' }),
        fetch('/api/admin/beta-controls', { credentials: 'include' })
      ]);
      if (reqsRes.ok) setRequests(await reqsRes.json());
      if (ctrlRes.ok) setControls(await ctrlRes.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRequestAction = async (id: number, action: 'approve' | 'reject' | 'archive') => {
    try {
      const response = await fetch(`/api/admin/beta-access-requests/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setActionMessage(result?.error || `Failed to ${action} request.`);
        return;
      }
      if (result?.invitationPath) {
        await navigator.clipboard.writeText(result.invitationPath);
        setActionMessage('Invitation created and copied. Share it through your approved secure channel.');
      }
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateControls = async (updates: any) => {
    try {
      const res = await fetch('/api/admin/beta-controls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        credentials: 'include'
      });
      if (res.ok) setControls(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleRevokeInvitations = async () => {
    if (!window.confirm("Revoke all unaccepted invitations? This cannot be undone.")) return;
    try {
      const res = await fetch('/api/admin/access-controls/revoke-invitations', { method: 'POST', credentials: 'include' });
      if (res.ok) setActionMessage("All unaccepted invitations revoked successfully.");
      else setActionMessage("Failed to revoke invitations.");
    } catch (e) {
      setActionMessage("Network error revoking invitations.");
    }
    setTimeout(() => setActionMessage(''), 4000);
  };

  const handleTargetAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) return;
    try {
      const res = await fetch(`/api/admin/access-controls/${targetType}/${targetId}/${actionType}`, { method: 'POST', credentials: 'include' });
      if (res.ok) setActionMessage(`Successfully ${actionType}d ${targetType.slice(0, -1)} ${targetId}.`);
      else setActionMessage(`Failed to ${actionType} ${targetType.slice(0, -1)} ${targetId}.`);
    } catch (e) {
      setActionMessage(`Network error during action.`);
    }
    setTimeout(() => setActionMessage(''), 4000);
  };

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground animate-pulse sm:p-8">Loading Super Admin Controls...</div>;
  }

  return (
    <section className="mt-8 rounded-2xl border border-destructive/20 bg-card p-4 soft-shadow sm:mt-12 sm:rounded-[2rem] sm:p-8">
      <div className="flex items-center gap-3 border-b border-border pb-5">
        <Shield className="text-destructive" size={24} />
        <h2 className="serif text-2xl font-semibold text-foreground">Super Admin: Beta Controls</h2>
      </div>

      <div className="mt-8 space-y-8">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Beta Requests Queue</h3>
          <div className="mt-4 space-y-3">
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground bg-secondary/30 p-4 rounded-xl border border-border">No pending requests.</p>
            ) : (
              requests.map(req => (
                <div key={req.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{req.fullName} <span className="text-muted-foreground font-normal">({req.email})</span></p>
                    <p className="text-xs text-muted-foreground mt-1">{req.role} at {req.organization || 'No organization'}</p>
                    {req.message && <p className="text-xs text-muted-foreground mt-2 italic">"{req.message}"</p>}
                  </div>
                  <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:items-center">
                    <Button size="sm" onClick={() => handleRequestAction(req.id, 'approve')}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => handleRequestAction(req.id, 'reject')}>Reject</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleRequestAction(req.id, 'archive')}>Archive</Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-secondary/20 p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Global Controls</h3>
            <div className="mt-4 space-y-4">
              <label className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  checked={controls?.enabled || false} 
                  onChange={e => handleUpdateControls({ enabled: e.target.checked })} 
                />
                <span className="text-sm">Private beta access enabled</span>
              </label>
              <div>
                <Button variant="outline" className="w-full" onClick={handleRevokeInvitations}>
                  Revoke All Pending Invitations
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/20 p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Emergency Access Override</h3>
            <form onSubmit={handleTargetAction} className="mt-4 space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <select value={targetType} onChange={e => setTargetType(e.target.value as any)} className="min-h-11 w-full rounded-lg border border-input bg-background p-2 text-sm outline-none">
                  <option value="users">User ID</option>
                  <option value="organizations">Org ID</option>
                </select>
                <input required type="text" placeholder="ID" value={targetId} onChange={e => setTargetId(e.target.value)} className="min-h-11 w-full rounded-lg border border-input bg-background p-2 text-sm outline-none sm:col-span-2" />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <select value={actionType} onChange={e => setActionType(e.target.value as any)} className="min-h-11 w-full rounded-lg border border-input bg-background p-2 text-sm outline-none">
                  <option value="disable">Disable</option>
                  <option value="enable">Enable</option>
                </select>
                <Button type="submit" variant={actionType === 'disable' ? 'outline' : 'default'} className="w-full sm:col-span-2">Execute</Button>
              </div>
            </form>
          </div>
        </div>
        
        {actionMessage && (
          <p className="rounded-xl bg-accent p-3 text-center text-sm font-semibold text-accent-foreground">
            {actionMessage}
          </p>
        )}
      </div>
    </section>
  );
}
