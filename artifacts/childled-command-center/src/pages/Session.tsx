import { useEffect, useState } from 'react';
import { useListChildren, getListChildrenQueryKey } from '@workspace/api-client-react';
import { Mic2, Play, AlertCircle, Settings } from 'lucide-react';

export default function Session() {
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  
  const { data: childrenData, isLoading } = useListChildren({ query: { queryKey: getListChildrenQueryKey() } });
  const children = childrenData ?? [];
  
  useEffect(() => {
    if (!selectedChildId && children[0]) setSelectedChildId(children[0].id);
  }, [children, selectedChildId]);

  const selectedChild = children.find(c => c.id === selectedChildId);

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500 pb-10">
      <div className="text-center mt-10">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-lg shadow-accent/20 mb-6">
          <Mic2 size={32} />
        </div>
        <h1 className="cc-serif text-4xl font-bold text-primary">Start an Observation</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Capture audio for automated transcription and gestalt identification.
        </p>
      </div>

      <div className="cc-card p-6 md:p-8 rounded-3xl shadow-xl mt-10">
        <div className="space-y-6">
          <div>
            <label className="cc-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              Select Child Profile
            </label>
            {isLoading ? (
              <div className="h-12 skeleton rounded-xl w-full" />
            ) : (
              <select 
                data-testid="select-session-child"
                value={selectedChildId || ''} 
                onChange={(e) => setSelectedChildId(Number(e.target.value))}
                className="cc-focus block w-full rounded-xl border border-card-border bg-background px-4 py-3 text-sm font-semibold shadow-sm text-foreground"
              >
                {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                {children.length === 0 && <option value="" disabled>No children found</option>}
              </select>
            )}
          </div>

          <div className="rounded-2xl bg-secondary/50 p-5 border border-card-border">
            <h3 className="font-semibold flex items-center gap-2 mb-2 text-sm">
              <Settings size={16} className="text-muted-foreground" />
              Recording Settings
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Transcripts will be saved to {selectedChild?.name || 'the selected child'}'s secure profile. You can review and edit before anything is added to the dictionary.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="consent" defaultChecked className="rounded border-card-border cc-focus size-4" />
                <label htmlFor="consent" className="text-xs font-medium cursor-pointer">Guardian consent verified</label>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-card-border flex justify-center">
          <button 
            data-testid="button-start-recording"
            disabled={!selectedChildId}
            className="cc-focus group relative inline-flex items-center justify-center gap-3 rounded-full bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            <span className="absolute inset-0 rounded-full bg-accent opacity-0 group-hover:opacity-10 transition-opacity" />
            <Play size={20} fill="currentColor" />
            Start Session Recording
          </button>
        </div>
      </div>
      
      <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4 text-sm">
        <AlertCircle size={16} className="text-accent shrink-0 mt-0.5" />
        <p className="text-muted-foreground leading-relaxed">
          Ensure you are in a quiet environment. This prototype only captures a sample. Actual recording features require secure storage permissions not active in the preview.
        </p>
      </div>
    </div>
  );
}