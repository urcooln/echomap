import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAacProfileQueryKey,
  useGetAacProfile,
  useUpdateAacProfile,
  useRemoveAacProfile,
  type AacCommunicationModality,
  type AacProfile,
  type AacUserStatus,
  type AacCatalogOption,
} from '@workspace/api-client-react';
import { Accessibility, Check, Clock3, History, Pencil, Shield, Trash2, AlertCircle } from 'lucide-react';

const modalityOptions: Array<{ value: AacCommunicationModality; label: string }> = [
  { value: 'aac', label: 'AAC' },
  { value: 'spoken_language', label: 'Spoken Language' },
  { value: 'sign_language', label: 'Sign Language' },
  { value: 'gestures', label: 'Gestures' },
  { value: 'written_language', label: 'Written Language' },
  { value: 'other', label: 'Other' },
];

const modalityLabel = (value: AacCommunicationModality, otherLabel?: string | null) =>
  value === 'other' && otherLabel?.trim()
    ? otherLabel.trim()
    : modalityOptions.find((option) => option.value === value)?.label ?? value;

const modalityList = (
  modalities: AacCommunicationModality[] | null | undefined,
  otherLabel?: string | null,
) => modalities?.length
  ? modalities.map((value) => modalityLabel(value, otherLabel)).join(', ')
  : 'None documented';

const withOther = (options: AacCatalogOption[]) => {
  if (options.some((o) => o.id === 'other')) return options;
  return [...options, { id: 'other', label: 'Other/Custom' }];
};

const getLabel = (id: string | null | undefined, customLabel: string | null | undefined, options: { id: string; label: string }[]) => {
  if (!id) return 'Not specified';
  if (id === 'other' || id === 'custom') return customLabel?.trim() ? customLabel.trim() : options.find((o) => o.id === id)?.label || 'Custom';
  return options.find((o) => o.id === id)?.label || id;
};

const getHistoryLabel = (field: string, id: string | null | undefined, customLabel: string | null | undefined, catalog: AacProfile['catalog']) => {
  if (!id) return 'Not specified';
  if (id === 'other' || id === 'custom') return customLabel?.trim() ? customLabel.trim() : id === 'other' ? 'Other' : 'Custom';
  switch (field) {
    case 'deviceVendorId': return catalog.vendors.find((v) => v.id === id)?.label || id;
    case 'deviceModelId': return catalog.deviceModels.find((m) => m.id === id)?.label || id;
    case 'vocabularySystemId': return catalog.vocabularySystems.find((v) => v.id === id)?.label || id;
    case 'accessMethodId': return catalog.accessMethods.find((v) => v.id === id)?.label || id;
    case 'ownershipId': return catalog.ownershipOptions.find((v) => v.id === id)?.label || id;
    default: return id;
  }
};

const statusLabel = (status: AacUserStatus | null | undefined) => {
  if (status === 'yes') return 'AAC User';
  if (status === 'no') return 'Not an AAC User';
  return 'Unconfirmed';
};

const formatFieldLabel = (field: string) => {
  const map: Record<string, string> = {
    communicationModalities: 'Communication Modalities',
    otherModalityLabel: 'Other Modality Label',
    aacUserStatus: 'AAC User Status',
    deviceVendorId: 'Device Vendor',
    deviceVendorCustomLabel: 'Device Vendor Custom Label',
    deviceModelId: 'Device Model',
    deviceModelCustomLabel: 'Device Model Custom Label',
    vocabularySystemId: 'Vocabulary System',
    vocabularySystemCustomLabel: 'Vocabulary Custom Label',
    accessMethodId: 'Access Method',
    accessMethodCustomLabel: 'Access Method Custom Label',
    ownershipId: 'Ownership',
    ownershipCustomLabel: 'Ownership Custom Label',
    notes: 'Notes',
  };
  return map[field] || field;
};

export function AacInformationCard({ childId }: { childId: number }) {
  const queryClient = useQueryClient();
  const queryKey = getGetAacProfileQueryKey({ childId });
  const query = useGetAacProfile(
    { childId },
    { query: { queryKey, enabled: Boolean(childId), staleTime: 15_000 } },
  );

  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [message, setMessage] = useState('');

  const [selectedModalities, setSelectedModalities] = useState<AacCommunicationModality[]>([]);
  const [otherModalityLabel, setOtherModalityLabel] = useState('');
  const [aacUserStatus, setAacUserStatus] = useState<AacUserStatus>('unknown');

  const [deviceVendorId, setDeviceVendorId] = useState<string | null>(null);
  const [deviceVendorCustomLabel, setDeviceVendorCustomLabel] = useState('');
  const [deviceModelId, setDeviceModelId] = useState<string | null>(null);
  const [deviceModelCustomLabel, setDeviceModelCustomLabel] = useState('');
  const [vocabularySystemId, setVocabularySystemId] = useState<string | null>(null);
  const [vocabularySystemCustomLabel, setVocabularySystemCustomLabel] = useState('');
  const [accessMethodId, setAccessMethodId] = useState<string | null>(null);
  const [accessMethodCustomLabel, setAccessMethodCustomLabel] = useState('');
  const [ownershipId, setOwnershipId] = useState<string | null>(null);
  const [ownershipCustomLabel, setOwnershipCustomLabel] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!query.data || editing) return;
    const p = query.data;
    setSelectedModalities(p.communicationModalities);
    setOtherModalityLabel(p.otherModalityLabel ?? '');
    setAacUserStatus(p.aacUserStatus);
    setDeviceVendorId(p.deviceVendorId);
    setDeviceVendorCustomLabel(p.deviceVendorCustomLabel ?? '');
    setDeviceModelId(p.deviceModelId);
    setDeviceModelCustomLabel(p.deviceModelCustomLabel ?? '');
    setVocabularySystemId(p.vocabularySystemId);
    setVocabularySystemCustomLabel(p.vocabularySystemCustomLabel ?? '');
    setAccessMethodId(p.accessMethodId);
    setAccessMethodCustomLabel(p.accessMethodCustomLabel ?? '');
    setOwnershipId(p.ownershipId);
    setOwnershipCustomLabel(p.ownershipCustomLabel ?? '');
    setNotes(p.notes ?? '');
  }, [editing, query.data]);

  const update = useUpdateAacProfile({
    mutation: {
      onSuccess: (profile) => {
        queryClient.setQueryData<AacProfile>(queryKey, profile);
        setEditing(false);
        setMessage('AAC profile saved.');
      },
      onError: (error) => {
        setMessage(error instanceof Error ? error.message : 'The AAC profile may have changed. Refresh and try again.');
      },
    },
  });

  const removeProfile = useRemoveAacProfile({
    mutation: {
      onSuccess: (profile) => {
        queryClient.setQueryData<AacProfile>(queryKey, profile);
        setEditing(false);
        setMessage('AAC profile removed.');
      },
      onError: (error) => {
        setMessage(error instanceof Error ? error.message : 'Could not remove AAC profile.');
      },
    },
  });

  const toggleModality = (value: AacCommunicationModality) => {
    setMessage('');
    setSelectedModalities((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  };

  const handleSave = () => {
    if (!query.data) return;
    update.mutate({
      params: { childId },
      data: {
        communicationModalities: selectedModalities,
        otherModalityLabel: selectedModalities.includes('other') ? otherModalityLabel.trim() || null : null,
        aacUserStatus,
        deviceVendorId: aacUserStatus === 'yes' ? deviceVendorId : null,
        deviceVendorCustomLabel: aacUserStatus === 'yes' && (deviceVendorId === 'other' || deviceVendorId === 'custom') ? deviceVendorCustomLabel.trim() || null : null,
        deviceModelId: aacUserStatus === 'yes' ? deviceModelId : null,
        deviceModelCustomLabel: aacUserStatus === 'yes' && (deviceModelId === 'other' || deviceModelId === 'custom') ? deviceModelCustomLabel.trim() || null : null,
        vocabularySystemId: aacUserStatus === 'yes' ? vocabularySystemId : null,
        vocabularySystemCustomLabel: aacUserStatus === 'yes' && (vocabularySystemId === 'other' || vocabularySystemId === 'custom') ? vocabularySystemCustomLabel.trim() || null : null,
        accessMethodId: aacUserStatus === 'yes' ? accessMethodId : null,
        accessMethodCustomLabel: aacUserStatus === 'yes' && (accessMethodId === 'other' || accessMethodId === 'custom') ? accessMethodCustomLabel.trim() || null : null,
        ownershipId: aacUserStatus === 'yes' ? ownershipId : null,
        ownershipCustomLabel: aacUserStatus === 'yes' && (ownershipId === 'other' || ownershipId === 'custom') ? ownershipCustomLabel.trim() || null : null,
        notes: aacUserStatus === 'yes' ? notes.trim() || null : null,
        version: query.data.version,
      },
    });
  };

  const handleRemove = () => {
    if (window.confirm('Are you sure you want to remove the AAC profile details? This will clear all fields and log a removal event.')) {
      if (!query.data) return;
      removeProfile.mutate({ params: { childId, version: query.data.version } });
    }
  };

  if (query.isLoading) {
    return <div className="skeleton h-52 rounded-3xl" data-testid="aac-information-loading" />;
  }
  if (query.isError || !query.data) {
    return (
      <section className="rounded-3xl border border-destructive/20 bg-destructive/5 p-6" data-testid="aac-information-error">
        <p className="font-semibold text-destructive">AAC information could not be loaded.</p>
        <button type="button" onClick={() => query.refetch()} className="focus-ring mt-3 text-sm font-semibold text-primary underline underline-offset-4">Try again</button>
      </section>
    );
  }

  const profile = query.data;

  const availableVendors = withOther(profile.catalog.vendors);
  const availableModels = withOther(
    deviceVendorId && deviceVendorId !== 'other'
      ? profile.catalog.deviceModels.filter((m) => !m.vendorId || m.vendorId === deviceVendorId)
      : profile.catalog.deviceModels
  );
  const availableVocabularies = withOther(
    deviceVendorId && deviceVendorId !== 'other'
      ? profile.catalog.vocabularySystems.filter((v) => !v.vendorIds.length || v.vendorIds.includes(deviceVendorId))
      : profile.catalog.vocabularySystems
  );
  const availableAccessMethods = withOther(profile.catalog.accessMethods);
  const availableOwnership = withOther(profile.catalog.ownershipOptions);

  return (
    <section id="child-aac-information" className="scroll-mt-40 rounded-3xl border border-primary/15 bg-card p-6 soft-shadow md:p-8" data-testid="aac-information">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-primary">
            <span className="grid size-8 place-items-center rounded-xl bg-secondary"><Accessibility size={17} /></span>
            <p className="mono text-[10px] font-bold uppercase tracking-[.18em]">AAC Information</p>
          </div>
          <h2 className="serif mt-3 text-2xl font-semibold">Communication Profile</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Descriptive profile context across settings—not proficiency ratings or clinical conclusions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen((open) => !open)}
            className="focus-ring inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-primary hover:bg-secondary/50"
            data-testid="button-aac-profile-history"
          >
            <History size={14} /> {historyOpen ? 'Hide history' : 'Profile history'}
          </button>
          {profile.canEdit && !editing && (
            <button
              type="button"
              onClick={() => { setEditing(true); setMessage(''); }}
              className="gold-action focus-ring inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-primary"
              data-testid="button-edit-aac-modalities"
            >
              <Pencil size={14} /> Edit profile
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-6 space-y-6 rounded-2xl border border-primary/20 bg-secondary/25 p-4 md:p-5" data-testid="form-aac-profile">
          <fieldset>
            <legend className="text-sm font-semibold">Communication Modalities</legend>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Select every currently documented method.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {modalityOptions.map((option) => (
                <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-semibold transition-colors ${selectedModalities.includes(option.value) ? 'border-primary/35 bg-primary/5 text-primary' : 'border-border bg-card text-foreground hover:border-primary/20'}`}>
                  <input
                    type="checkbox"
                    checked={selectedModalities.includes(option.value)}
                    onChange={() => toggleModality(option.value)}
                    className="size-4 accent-primary"
                    data-testid={`checkbox-aac-modality-${option.value.replaceAll('_', '-')}`}
                  />
                  {selectedModalities.includes(option.value) && <Check size={14} className="text-primary" />}
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            {selectedModalities.includes('other') && (
              <label className="mt-4 block space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Other modality label</span>
                <input
                  value={otherModalityLabel}
                  onChange={(event) => setOtherModalityLabel(event.target.value)}
                  maxLength={120}
                  placeholder="Describe the communication method"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-ring"
                  data-testid="input-aac-other-modality"
                />
              </label>
            )}
          </fieldset>

          <fieldset className="border-t border-border pt-6">
            <legend className="text-sm font-semibold">AAC User Status</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { value: 'yes', label: 'Yes, uses AAC' },
                { value: 'no', label: 'No, does not use AAC' },
                { value: 'unknown', label: 'Unconfirmed' },
              ].map((opt) => (
                <label key={opt.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-semibold transition-colors ${aacUserStatus === opt.value ? 'border-primary/35 bg-primary/5 text-primary' : 'border-border bg-card text-foreground hover:border-primary/20'}`}>
                  <input
                    type="radio"
                    name="aacUserStatus"
                    value={opt.value}
                    checked={aacUserStatus === opt.value}
                    onChange={() => setAacUserStatus(opt.value as AacUserStatus)}
                    className="size-4 accent-primary"
                    data-testid={`radio-aac-status-${opt.value}`}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {aacUserStatus === 'yes' && (
            <div className="space-y-5 border-t border-border pt-6">
              <h3 className="text-sm font-semibold">Device & Vocabulary Details</h3>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Device Vendor</span>
                  <select
                    value={deviceVendorId || ''}
                    onChange={(e) => {
                      setDeviceVendorId(e.target.value || null);
                      setDeviceModelId(null);
                      setVocabularySystemId(null);
                    }}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-ring"
                    data-testid="select-device-vendor"
                  >
                    <option value="">Not specified</option>
                    {availableVendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </label>
                {(deviceVendorId === 'other' || deviceVendorId === 'custom') && (
                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Custom Vendor Name</span>
                    <input
                      value={deviceVendorCustomLabel}
                      onChange={(e) => setDeviceVendorCustomLabel(e.target.value)}
                      maxLength={120}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-ring"
                      data-testid="input-device-vendor-custom"
                    />
                  </label>
                )}

                <label className="block space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Device Model</span>
                  <select
                    value={deviceModelId || ''}
                    onChange={(e) => setDeviceModelId(e.target.value || null)}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-ring"
                    data-testid="select-device-model"
                  >
                    <option value="">Not specified</option>
                    {availableModels.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </label>
                {(deviceModelId === 'other' || deviceModelId === 'custom') && (
                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Custom Model Name</span>
                    <input
                      value={deviceModelCustomLabel}
                      onChange={(e) => setDeviceModelCustomLabel(e.target.value)}
                      maxLength={120}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-ring"
                      data-testid="input-device-model-custom"
                    />
                  </label>
                )}

                <label className="block space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vocabulary System</span>
                  <select
                    value={vocabularySystemId || ''}
                    onChange={(e) => setVocabularySystemId(e.target.value || null)}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-ring"
                    data-testid="select-vocabulary-system"
                  >
                    <option value="">Not specified</option>
                    {availableVocabularies.map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </label>
                {(vocabularySystemId === 'other' || vocabularySystemId === 'custom') && (
                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Custom Vocabulary Name</span>
                    <input
                      value={vocabularySystemCustomLabel}
                      onChange={(e) => setVocabularySystemCustomLabel(e.target.value)}
                      maxLength={120}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-ring"
                      data-testid="input-vocabulary-custom"
                    />
                  </label>
                )}

                <label className="block space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Access Method</span>
                  <select
                    value={accessMethodId || ''}
                    onChange={(e) => setAccessMethodId(e.target.value || null)}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-ring"
                    data-testid="select-access-method"
                  >
                    <option value="">Not specified</option>
                    {availableAccessMethods.map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </label>
                {(accessMethodId === 'other' || accessMethodId === 'custom') && (
                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Custom Access Method</span>
                    <input
                      value={accessMethodCustomLabel}
                      onChange={(e) => setAccessMethodCustomLabel(e.target.value)}
                      maxLength={120}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-ring"
                      data-testid="input-access-method-custom"
                    />
                  </label>
                )}

                <label className="block space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ownership</span>
                  <select
                    value={ownershipId || ''}
                    onChange={(e) => setOwnershipId(e.target.value || null)}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-ring"
                    data-testid="select-ownership"
                  >
                    <option value="">Not specified</option>
                    {availableOwnership.map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </label>
                {(ownershipId === 'other' || ownershipId === 'custom') && (
                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Custom Ownership</span>
                    <input
                      value={ownershipCustomLabel}
                      onChange={(e) => setOwnershipCustomLabel(e.target.value)}
                      maxLength={120}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-ring"
                      data-testid="input-ownership-custom"
                    />
                  </label>
                )}
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="Additional context about the device, accessories, or usage..."
                  className="w-full resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none focus-ring"
                  data-testid="textarea-aac-notes"
                />
              </label>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
            {profile.exists ? (
              <button
                type="button"
                onClick={handleRemove}
                disabled={removeProfile.isPending || update.isPending}
                className="focus-ring inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                data-testid="button-remove-aac-profile"
              >
                <Trash2 size={16} /> {removeProfile.isPending ? 'Removing…' : 'Remove profile'}
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setMessage('');
                }}
                className="focus-ring rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={update.isPending || removeProfile.isPending}
                className="gold-action focus-ring rounded-xl px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
                data-testid="button-save-aac-profile"
              >
                {update.isPending ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {profile.communicationModalities.length ? (
            <div data-testid="aac-modality-list">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Documented Modalities</h3>
              <div className="flex flex-wrap gap-2">
                {profile.communicationModalities.map((modality) => (
                  <span key={modality} className="rounded-full border border-primary/15 bg-secondary/60 px-3 py-1.5 text-sm font-semibold text-primary">
                    {modalityLabel(modality, profile.otherModalityLabel)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-5">
              <p className="text-sm font-semibold">No communication modalities documented yet.</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{profile.canEdit ? 'Use Edit profile to record current descriptive profile context.' : 'A clinician can add this information to the AAC profile.'}</p>
            </div>
          )}

          {profile.exists ? (
            <div className="rounded-2xl border border-primary/10 bg-card p-5 soft-shadow">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
                <h3 className="text-sm font-semibold">AAC System Details</h3>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${profile.aacUserStatus === 'yes' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {statusLabel(profile.aacUserStatus)}
                </span>
              </div>

              {profile.aacUserStatus === 'yes' ? (
                <div className="mt-4 grid gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Device Vendor</p>
                    <p className="mt-1 text-sm font-medium">{getLabel(profile.deviceVendorId, profile.deviceVendorCustomLabel, availableVendors)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Device Model</p>
                    <p className="mt-1 text-sm font-medium">{getLabel(profile.deviceModelId, profile.deviceModelCustomLabel, availableModels)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vocabulary System</p>
                    <p className="mt-1 text-sm font-medium">{getLabel(profile.vocabularySystemId, profile.vocabularySystemCustomLabel, availableVocabularies)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Access Method</p>
                    <p className="mt-1 text-sm font-medium">{getLabel(profile.accessMethodId, profile.accessMethodCustomLabel, availableAccessMethods)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ownership</p>
                    <p className="mt-1 text-sm font-medium">{getLabel(profile.ownershipId, profile.ownershipCustomLabel, availableOwnership)}</p>
                  </div>
                  {profile.notes && (
                    <div className="sm:col-span-2 lg:col-span-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{profile.notes}</p>
                    </div>
                  )}
                </div>
              ) : profile.aacUserStatus === 'no' ? (
                <p className="mt-4 text-sm text-muted-foreground">Documented as not currently using a dedicated AAC system.</p>
              ) : (
                <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><AlertCircle size={16} /> AAC user status is unconfirmed.</p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {!profile.canEdit && (
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-secondary/35 p-3 text-xs leading-5 text-muted-foreground" data-testid="aac-information-read-only">
          <Shield size={14} className="mt-0.5 shrink-0 text-primary" />
          This AAC profile is read-only in your role. You can view documented modalities for this child, but only an authorized clinician can change them.
        </p>
      )}
      {message && <p role="status" className={`mt-4 rounded-xl p-3 text-sm ${update.isError || removeProfile.isError ? 'bg-destructive/10 text-destructive' : 'bg-primary/5 text-primary'}`}>{message}</p>}

      {profile.lastConfirmedAt && (
        <p className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-[11px] text-muted-foreground">
          <Clock3 size={13} /> Last confirmed {new Date(profile.lastConfirmedAt).toLocaleString()} by {profile.lastConfirmedBy ?? 'an authorized clinician'}{profile.lastConfirmedRole ? ` · ${profile.lastConfirmedRole}` : ''}
        </p>
      )}

      {historyOpen && (
        <div className="mt-6 border-t border-border pt-5" data-testid="aac-profile-history">
          <h3 className="serif text-lg font-semibold">Profile History</h3>
          {profile.history.length ? (
            <div className="mt-4 space-y-4">
              {profile.history.map((event) => (
                <article key={event.id} className="rounded-xl border border-border bg-secondary/25 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <p className="font-semibold">{event.actorName} <span className="font-normal text-muted-foreground">· {event.actorRole}</span></p>
                    <time className="text-[11px] text-muted-foreground">{new Date(event.occurredAt).toLocaleString()}</time>
                  </div>
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {event.action === 'created' ? 'Profile created' : event.action === 'removed' ? 'Profile removed' : 'Profile updated'}
                    </p>
                    {event.changedFields.length > 0 ? (
                      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                        {event.changedFields.map((field) => {
                          const prev = event.previousValue?.[field as keyof typeof event.previousValue];
                          const next = event.nextValue?.[field as keyof typeof event.nextValue];

                          let prevStr = String(prev ?? 'None');
                          let nextStr = String(next ?? 'None');

                          if (field === 'communicationModalities') {
                            prevStr = modalityList(prev as AacCommunicationModality[], event.previousValue?.otherModalityLabel);
                            nextStr = modalityList(next as AacCommunicationModality[], event.nextValue?.otherModalityLabel);
                          } else if (field === 'aacUserStatus') {
                            prevStr = statusLabel(prev as AacUserStatus);
                            nextStr = statusLabel(next as AacUserStatus);
                          } else if (field.endsWith('Id')) {
                            const customField = field.replace('Id', 'CustomLabel');
                            const prevCustom = event.previousValue?.[customField as keyof typeof event.previousValue] as string | null;
                            const nextCustom = event.nextValue?.[customField as keyof typeof event.nextValue] as string | null;
                            prevStr = getHistoryLabel(field, prev as string | null, prevCustom, profile.catalog);
                            nextStr = getHistoryLabel(field, next as string | null, nextCustom, profile.catalog);
                          } else if (field.endsWith('CustomLabel') || field === 'otherModalityLabel') {
                            return null;
                          }

                          return (
                            <div key={field} className="rounded-lg bg-background p-3 text-xs border border-border">
                              <p className="font-semibold text-foreground mb-1.5">{formatFieldLabel(field)}</p>
                              <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-1">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground">Before</span>
                                <span className="text-muted-foreground line-clamp-2">{prevStr}</span>
                                <span className="text-[10px] font-bold uppercase text-muted-foreground">After</span>
                                <span className="font-medium text-foreground line-clamp-2">{nextStr}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No specific fields modified.</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No changes have been recorded yet.</p>
          )}
        </div>
      )}
    </section>
  );
}
