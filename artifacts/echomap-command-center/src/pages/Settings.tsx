import { useGetViewer, getGetViewerQueryKey } from '@workspace/api-client-react';
import { Shield, User, LogOut } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function Settings() {
  const { data: viewer, isLoading } = useGetViewer({ query: { queryKey: getGetViewerQueryKey() } });
  const queryClient = useQueryClient();

  const handleSignOut = () => {
    queryClient.clear();
    window.location.href = '/';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <p className="cc-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Workspace Configuration</p>
        <h1 className="cc-serif text-4xl font-bold text-primary mt-1">Settings</h1>
      </div>

      <div className="cc-card p-6 md:p-8 rounded-3xl">
        <div className="flex items-center gap-3 mb-6 border-b border-card-border pb-4">
          <User className="text-primary" size={20} />
          <h2 className="cc-serif text-2xl text-primary">Your Profile</h2>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-10 skeleton rounded-lg w-1/2" />
            <div className="h-10 skeleton rounded-lg w-1/3" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="cc-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Display Name</label>
              <p className="text-lg font-medium">{viewer?.name || 'Unknown'}</p>
            </div>
            <div>
              <label className="cc-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Assigned Role</label>
              <p className="text-lg font-medium">{viewer?.actualRole || 'Unknown'}</p>
            </div>
            
            <div className="pt-4">
              <button 
                onClick={handleSignOut}
                data-testid="button-sign-out"
                className="cc-focus inline-flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="cc-card p-6 md:p-8 rounded-3xl">
        <div className="flex items-center gap-3 mb-6 border-b border-card-border pb-4">
          <Shield className="text-accent" size={20} />
          <h2 className="cc-serif text-2xl text-primary">Security & Privacy</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mb-4">
          EchoMap adheres to strict privacy standards. All child data and recordings are encrypted. Access is strictly limited to authorized care team members.
        </p>
        <div className="rounded-xl bg-secondary/50 p-4 border border-card-border">
          <p className="text-xs font-semibold cc-mono uppercase tracking-widest">HIPAA Compliance Status</p>
          <p className="text-sm mt-1 text-primary">Active and compliant in this environment.</p>
        </div>
      </div>
    </div>
  );
}