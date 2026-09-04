import { useEffect, useState } from 'react';
import { useGetTeamInbox, useListCareTeamInvitations, useListChildren, getGetTeamInboxQueryKey, getListCareTeamInvitationsQueryKey, getListChildrenQueryKey } from '@workspace/api-client-react';
import { Activity, Mail, UserPlus, Clock } from 'lucide-react';

export default function Team() {
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const { data: childrenData } = useListChildren({ query: { queryKey: getListChildrenQueryKey() } });
  const children = childrenData ?? [];

  useEffect(() => {
    if (!selectedChildId && children[0]) setSelectedChildId(children[0].id);
  }, [children, selectedChildId]);

  const { data: inbox, isLoading: isInboxLoading } = useGetTeamInbox(
    { childId: selectedChildId ?? 0 },
    { query: { enabled: Boolean(selectedChildId), queryKey: getGetTeamInboxQueryKey({ childId: selectedChildId ?? 0 }) } }
  );

  const { data: invitesData, isLoading: isInvitesLoading } = useListCareTeamInvitations({
    query: { queryKey: getListCareTeamInvitationsQueryKey() }
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <p className="cc-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Team Collaboration</p>
        <h1 className="cc-serif text-4xl font-bold text-primary mt-1">Care Team Activity</h1>
      </div>
      <label className="block max-w-xs">
        <span className="cc-mono mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Child team</span>
        <select data-testid="select-team-child" value={selectedChildId ?? ''} onChange={(event) => setSelectedChildId(Number(event.target.value))} className="cc-focus w-full rounded-xl border border-card-border bg-card px-3 py-2 text-sm font-semibold">
          {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
          {!children.length && <option value="" disabled>No accessible child teams</option>}
        </select>
      </label>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        <section className="cc-card p-6 md:p-8 rounded-3xl">
          <div className="flex items-center gap-3 mb-6 border-b border-card-border pb-4">
            <Activity className="text-accent" size={20} />
            <h2 className="cc-serif text-2xl text-primary">Recent Shared Moments</h2>
          </div>
          
          {isInboxLoading ? (
            <div className="space-y-4">
              <div className="h-24 skeleton rounded-xl" />
              <div className="h-24 skeleton rounded-xl" />
            </div>
          ) : !inbox?.messages?.length ? (
            <div className="rounded-xl border border-dashed border-card-border p-8 text-center bg-background/50">
              <p className="font-semibold text-sm">No recent activity.</p>
              <p className="text-xs text-muted-foreground mt-1">Messages and updates from families and teachers appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {inbox.messages.map(msg => (
                <article key={msg.id} data-testid={`card-message-${msg.id}`} className="rounded-xl border border-card-border bg-background p-4 shadow-sm">
                  <p className="text-sm font-medium leading-relaxed mb-3">"{msg.body}"</p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground uppercase cc-mono font-bold tracking-widest">
                    <span className="flex items-center gap-2">
                      <span className="grid size-5 place-items-center rounded-full bg-secondary text-primary">{msg.senderName.charAt(0)}</span>
                      {msg.senderName} · {msg.senderRole}
                    </span>
                    <span>{new Date(msg.createdAt).toLocaleDateString()}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="cc-card p-6 md:p-8 rounded-3xl h-fit">
          <div className="flex items-center gap-3 mb-6 border-b border-card-border pb-4">
            <UserPlus className="text-muted-foreground" size={20} />
            <h2 className="cc-serif text-xl text-primary">Pending Invitations</h2>
          </div>

          {isInvitesLoading ? (
            <div className="space-y-3">
              <div className="h-16 skeleton rounded-xl" />
            </div>
          ) : !invitesData?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">No pending invitations.</p>
          ) : (
            <div className="space-y-3">
              {invitesData.filter((invite) => invite.status === 'pending').map((inv) => (
                <div key={inv.id} data-testid={`card-invite-${inv.id}`} className="rounded-xl border border-card-border bg-background p-3 text-sm flex items-center justify-between">
                  <div className="truncate pr-4">
                    <p className="font-semibold truncate">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">{inv.role}</p>
                  </div>
                  <Clock size={14} className="text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          )}

          <button data-testid="button-invite" className="mt-6 w-full cc-focus inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-bold text-foreground shadow-sm hover:bg-card-border transition-colors">
            <Mail size={16} /> Send Invitation
          </button>
        </section>
      </div>
    </div>
  );
}