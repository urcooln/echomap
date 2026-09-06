import * as React from 'react';
import { 
  Mic, 
  Square, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2,
  SkipForward,
  RotateCcw,
  Shield,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type CaptureState = 'idle' | 'recording' | 'loading' | 'captured' | 'error' | 'skipped';

export type CalibrationDiagnostics = {
  recordedDurationMilliseconds?: number;
  serverDurationMilliseconds?: number | null;
  fileSizeBytes?: number;
  contentType?: string;
  sourceContainer?: string | null;
  sourceAudioCodec?: string | null;
  sourceFileExtension?: string;
  storageObjectExtension?: string;
  durationConversion?: 'not_required' | 'webm_to_wav' | 'failed';
  durationParsingError?: string | null;
  uploadStatus: 'not_started' | 'reserved' | 'uploaded' | 'finalized' | 'failed';
  voiceProfileStatus: 'not_started' | 'unavailable' | 'ready' | 'failed';
  verificationStatus: 'not_run' | 'passed' | 'failed';
  stage: 'capture' | 'upload_reservation' | 'private_upload' | 'duration_probe' | 'finalization' | 'database_save';
  errorCode?: string;
  errorMessage?: string;
};

export interface SpeakerCalibrationProps {
  clinicianName: string;
  caregiverName?: string;
  caregiverPresent: boolean;
  
  clinicianPrompt: string;
  caregiverPrompt?: string;
  dateText: string;
  clinicianQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  clinicianDurationMilliseconds?: number;
  clinicianElapsedMilliseconds?: number;
  clinicianDiagnostics: CalibrationDiagnostics;
  caregiverDiagnostics: CalibrationDiagnostics;
  
  clinicianState: CaptureState;
  caregiverState: CaptureState;
  
  clinicianError?: string;
  caregiverError?: string;
  
  onStartClinicianCapture: () => void;
  onStopClinicianCapture: () => void;
  onSkipClinicianCapture: () => void;
  onRetryClinicianVerification?: () => void;
  onResetClinicianCapture: () => void;
  
  onStartCaregiverCapture: () => void;
  onStopCaregiverCapture: () => void;
  onSkipCaregiverCapture: () => void;
  onRetryCaregiverVerification?: () => void;
  onResetCaregiverCapture: () => void;
  onSetCaregiverPresent: (present: boolean) => void;
  
  onStartSession: () => void;
  isStartingSession?: boolean;
}

function CaptureControls({
  state,
  onStart,
  onStop,
  onReset,
  onSkip,
  onRetryVerification,
  skipTestId,
  error,
  elapsedMilliseconds,
}: {
  state: CaptureState;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onSkip?: () => void;
  onRetryVerification?: () => void;
  skipTestId?: string;
  error?: string;
  elapsedMilliseconds?: number;
}) {
  if (state === 'captured') {
    return (
      <div className="flex flex-col items-center space-y-3 animate-in zoom-in-95 duration-300">
        <div className="h-16 w-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center mb-1 shadow-sm">
          <CheckCircle2 size={28} />
        </div>
         <span className="text-sm font-bold text-accent">Voice reference saved</span>
        <button type="button" data-testid="button-retake-calibration"
          onClick={onReset}
          className="focus-ring text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary"
        >
          <RotateCcw size={12} /> Retake
        </button>
      </div>
    );
  }

  if (state === 'skipped') {
    return (
      <div className="flex flex-col items-center space-y-3 animate-in zoom-in-95 duration-300">
        <div className="h-16 w-16 rounded-full bg-secondary border border-border text-muted-foreground flex items-center justify-center mb-1">
          <SkipForward size={24} />
        </div>
        <span className="text-sm font-bold text-muted-foreground">Skipped</span>
        <button type="button" data-testid="button-try-calibration-again"
          onClick={onReset}
          className="focus-ring text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary"
        >
          <RotateCcw size={12} /> Try again
        </button>
      </div>
    );
  }

  if (state === 'recording') {
    return (
      <div className="flex flex-col items-center space-y-4 animate-in zoom-in-95 duration-300">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-destructive/30 animate-ping" style={{ animationDuration: '2s' }}></div>
          <div className="absolute inset-[-10px] rounded-full bg-destructive/10 animate-pulse"></div>
          <button type="button" data-testid="button-stop-speaker-calibration"
            onClick={onStop}
            className="focus-ring relative h-16 w-16 rounded-full bg-destructive text-destructive-foreground shadow-[0_8px_16px_-6px_rgba(220,38,38,0.5)] hover:bg-destructive/90 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            aria-label="Stop recording"
          >
            <Square size={20} fill="currentColor" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-1">
           <span className="text-2xl font-bold tabular-nums text-destructive">
             {Math.floor((elapsedMilliseconds ?? 0) / 1000)}:{String(Math.floor(((elapsedMilliseconds ?? 0) % 1000) / 10)).padStart(2, '0')}
           </span>
           <span className="text-sm font-bold text-destructive animate-pulse">Recording…</span>
           <span className="text-[10px] font-bold uppercase tracking-wider text-destructive/70">Tap to stop · 5–10 sec</span>
        </div>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center space-y-3 animate-in fade-in duration-300">
        <div className="h-16 w-16 rounded-full bg-secondary/50 border border-border flex items-center justify-center mb-1">
          <Loader2 size={24} className="text-primary animate-spin" />
        </div>
        <span className="text-sm font-bold text-muted-foreground">Processing</span>
      </div>
    );
  }

  // idle or error
  return (
    <div className="flex flex-col items-center space-y-3 w-full animate-in zoom-in-95 duration-300">
      <button type="button" data-testid="button-start-speaker-calibration"
        onClick={error && onRetryVerification ? onRetryVerification : onStart}
        className="focus-ring h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-[0_8px_20px_-8px_hsl(var(--primary))] hover:bg-primary/90 hover:shadow-[0_12px_24px_-10px_hsl(var(--primary))] flex items-center justify-center transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
        aria-label={error && onRetryVerification ? "Verify uploaded reference" : "Start recording"}
      >
        <Mic size={24} />
      </button>
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-bold text-foreground">{error && onRetryVerification ? 'Verify uploaded reference' : 'Record voice'}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{error && onRetryVerification ? 'Use the existing private upload' : '5-10 seconds'}</span>
      </div>
      
      {error && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-destructive bg-destructive/10 px-2.5 py-1.5 rounded-lg text-center max-w-[180px] animate-in slide-in-from-top-1">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="leading-tight">{error}</span>
        </div>
      )}
      {error && onRetryVerification && (
        <button type="button" onClick={onStart} className="focus-ring text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
          Record a new reference instead
        </button>
      )}

      {onSkip && (
        <button type="button" data-testid={skipTestId}
          onClick={onSkip}
          className="focus-ring text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mt-1 px-3 py-1.5 rounded-full hover:bg-secondary"
        >
          Skip for now
        </button>
      )}
    </div>
  );
}

function CaptureCard({
  title,
  subtitle,
  promptText,
  dateText,
  state,
  error,
  onStart,
  onStop,
  onReset,
  onSkip,
  onRetryVerification,
  diagnostics,
  quality,
  durationMilliseconds,
  elapsedMilliseconds,
}: {
  title: string;
  subtitle: string;
  promptText: string;
  dateText: string;
  state: CaptureState;
  error?: string;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onSkip?: () => void;
  onRetryVerification?: () => void;
  diagnostics: CalibrationDiagnostics;
  quality?: 'excellent' | 'good' | 'fair' | 'poor';
  durationMilliseconds?: number;
  elapsedMilliseconds?: number;
}) {
  const isCaptured = state === 'captured';
  const isRecording = state === 'recording';
  const isSkipped = state === 'skipped';
  const qualityCopy = quality === 'excellent'
    ? ['Excellent Voice Profile', 'High confidence for speaker identification', 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700']
    : quality === 'good'
      ? ['Good Voice Profile', 'Suitable for speaker identification', 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700']
      : quality === 'fair'
        ? ['Fair Voice Profile', 'Speaker identification may be less accurate', 'bg-amber-500/10 border-amber-500/25 text-amber-700']
        : quality === 'poor'
          ? ['Poor Voice Profile', 'Please re-record in a quieter environment', 'bg-red-500/10 border-red-500/25 text-red-700']
          : undefined;
  
  return (
    <div className={cn(
      "relative overflow-hidden rounded-3xl border transition-all duration-300 soft-shadow bg-card",
      isRecording ? "border-destructive/30 ring-4 ring-destructive/5" : 
      isCaptured ? "border-accent/30 bg-accent/5" :
      isSkipped ? "border-border/50 opacity-80" : "border-primary/10"
    )}>
      {isRecording && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-destructive to-transparent animate-pulse" />
      )}
      
      <div className="p-6 sm:p-8 flex flex-col md:flex-row gap-8 items-center">
        {/* Left Side: Info & Prompt */}
        <div className="flex-1 space-y-5 w-full">
          <div>
            <h3 className="serif font-semibold text-2xl text-foreground flex items-center gap-2">
              {title}
              {isCaptured && <CheckCircle2 size={20} className="text-accent" />}
              {isSkipped && <SkipForward size={18} className="text-muted-foreground" />}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
          
          <div className={cn(
            "rounded-2xl p-5 border transition-colors",
            isRecording ? "bg-destructive/5 border-destructive/20" : 
            isCaptured ? "bg-accent/10 border-accent/20" : "bg-secondary/30 border-primary/10"
          )}>
            <div className="flex items-start gap-4">
              <span className={cn(
                "mt-1 flex-shrink-0 grid h-7 w-7 place-items-center rounded-full",
                isRecording ? "bg-destructive/20 text-destructive" :
                isCaptured ? "bg-accent/20 text-accent" : "bg-primary/10 text-primary"
              )}>
                <Mic size={14} />
              </span>
              <div>
                <p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">
                  Please read aloud
                </p>
                 <p className="serif text-xl leading-relaxed font-medium text-foreground/90">
                   “{promptText}”
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Controls */}
        <div className="w-full md:w-56 shrink-0 flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-border/50 pt-6 md:pt-0 md:pl-6">
          <CaptureControls 
            state={state} 
            onStart={onStart} 
            onStop={onStop} 
            onReset={onReset} 
            onSkip={onSkip} 
            onRetryVerification={onRetryVerification}
            skipTestId={title.startsWith('Clinician') ? 'button-skip-clinician-calibration' : 'button-skip-caregiver-calibration'}
             error={error}
             elapsedMilliseconds={elapsedMilliseconds}
          />
          {isCaptured && qualityCopy && (
            <div className={cn("mt-4 rounded-2xl border px-4 py-3", qualityCopy[2])} data-testid="voice-profile-quality">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-sm font-bold">{qualityCopy[0]}</p><p className="mt-1 text-xs leading-5">{qualityCopy[1]}</p></div>
                {durationMilliseconds ? <span className="shrink-0 text-xs font-bold">{(durationMilliseconds / 1000).toFixed(1)}s</span> : null}
              </div>
            </div>
          )}
          <CalibrationDiagnosticsPanel diagnostics={diagnostics} />
        </div>
      </div>
    </div>
  );
}

function calibrationStatusLabel(value: string) {
  return value.replaceAll('_', ' ');
}

function formatMilliseconds(value?: number | null) {
  return typeof value === 'number' ? `${(value / 1000).toFixed(2)}s` : 'Not available';
}

function CalibrationDiagnosticsPanel({ diagnostics }: { diagnostics: CalibrationDiagnostics }) {
  const hasAttempt = diagnostics.uploadStatus !== 'not_started'
    || diagnostics.recordedDurationMilliseconds !== undefined
    || diagnostics.errorMessage;
  if (!hasAttempt) return null;

  return (
    <div data-testid="calibration-diagnostics" className="mt-5 w-full rounded-2xl border border-border bg-secondary/35 p-4 text-left">
      <p className="mono text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Temporary calibration diagnostics</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs leading-5">
        <div><dt className="text-muted-foreground">Recorded duration</dt><dd className="font-semibold text-foreground">{formatMilliseconds(diagnostics.recordedDurationMilliseconds)}</dd></div>
        <div><dt className="text-muted-foreground">Detected duration</dt><dd className="font-semibold text-foreground">{formatMilliseconds(diagnostics.serverDurationMilliseconds)}</dd></div>
        <div><dt className="text-muted-foreground">File size</dt><dd className="font-semibold text-foreground">{typeof diagnostics.fileSizeBytes === 'number' ? `${Math.max(1, Math.round(diagnostics.fileSizeBytes / 1024))} KB` : 'Not available'}</dd></div>
        <div><dt className="text-muted-foreground">MIME type</dt><dd className="font-semibold text-foreground">{diagnostics.contentType || 'Not available'}</dd></div>
        <div><dt className="text-muted-foreground">Source container</dt><dd className="font-semibold text-foreground">{diagnostics.sourceContainer || 'Not detected'}</dd></div>
        <div><dt className="text-muted-foreground">Audio codec</dt><dd className="font-semibold text-foreground">{diagnostics.sourceAudioCodec || 'Not detected'}</dd></div>
        <div><dt className="text-muted-foreground">Source extension</dt><dd className="font-semibold text-foreground">{diagnostics.sourceFileExtension || 'Not available'}</dd></div>
        <div><dt className="text-muted-foreground">Stored object extension</dt><dd className="font-semibold text-foreground">{diagnostics.storageObjectExtension || 'Not available'}</dd></div>
        <div><dt className="text-muted-foreground">Duration conversion</dt><dd className="font-semibold capitalize text-foreground">{diagnostics.durationConversion ? calibrationStatusLabel(diagnostics.durationConversion) : 'Not run'}</dd></div>
        <div><dt className="text-muted-foreground">Duration parser</dt><dd className="font-semibold text-foreground">{diagnostics.durationParsingError || 'No parsing error'}</dd></div>
        <div><dt className="text-muted-foreground">Upload status</dt><dd className="font-semibold capitalize text-foreground">{calibrationStatusLabel(diagnostics.uploadStatus)}</dd></div>
        <div><dt className="text-muted-foreground">Voice profile status</dt><dd className="font-semibold capitalize text-foreground">{calibrationStatusLabel(diagnostics.voiceProfileStatus)}</dd></div>
        <div><dt className="text-muted-foreground">Verification status</dt><dd className="font-semibold capitalize text-foreground">{calibrationStatusLabel(diagnostics.verificationStatus)}</dd></div>
        <div><dt className="text-muted-foreground">Current stage</dt><dd className="font-semibold capitalize text-foreground">{calibrationStatusLabel(diagnostics.stage)}</dd></div>
      </dl>
      {diagnostics.errorMessage && (
        <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs leading-5 text-destructive">
          <span className="font-bold">Actual safe error: </span>{diagnostics.errorMessage}
          {diagnostics.errorCode ? <span className="mt-1 block font-mono text-[10px]">{diagnostics.errorCode}</span> : null}
        </div>
      )}
    </div>
  );
}

export function SpeakerCalibration({
  clinicianName,
  caregiverName,
  clinicianPrompt,
  caregiverPrompt = "I am the caregiver. The date is",
  dateText,
  clinicianState,
  caregiverState,
  clinicianError,
  caregiverError,
  onStartClinicianCapture,
  onStopClinicianCapture,
  onSkipClinicianCapture,
  onRetryClinicianVerification,
  onResetClinicianCapture,
  onStartCaregiverCapture,
  onStopCaregiverCapture,
  onSkipCaregiverCapture,
  onRetryCaregiverVerification,
  onResetCaregiverCapture,
  caregiverPresent,
  onSetCaregiverPresent,
  onStartSession,
  isStartingSession,
  clinicianQuality,
  clinicianDurationMilliseconds,
  clinicianElapsedMilliseconds,
  clinicianDiagnostics,
  caregiverDiagnostics,
}: SpeakerCalibrationProps) {
  
  const isCaregiverReady = !caregiverPresent || caregiverState === 'captured' || caregiverState === 'skipped';
  
  const canStartSession = isCaregiverReady;

  return (
    <div className="mx-auto max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="text-center space-y-4 mb-10 pt-4">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
          <Shield size={24} />
        </div>
        <h2 className="serif text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
          Voice reference (recommended)
        </h2>
        <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
           Add a short private voice reference to support speaker review when available. You can skip it and record the session without a voice profile; final speaker labels remain under clinician control.
        </p>
      </div>

      <div className="space-y-6">
        <CaptureCard
          title={`Clinician: ${clinicianName}`}
            subtitle="Recommended private voice reference for this session"
          promptText={clinicianPrompt}
          dateText={dateText}
          state={clinicianState}
          error={clinicianError}
          onStart={onStartClinicianCapture}
          onStop={onStopClinicianCapture}
           onSkip={onSkipClinicianCapture}
           onRetryVerification={onRetryClinicianVerification}
          onReset={onResetClinicianCapture}
           diagnostics={clinicianDiagnostics}
           quality={clinicianQuality}
           durationMilliseconds={clinicianDurationMilliseconds}
           elapsedMilliseconds={clinicianElapsedMilliseconds}
        />

        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              checked={caregiverPresent}
              onChange={(event) => onSetCaregiverPresent(event.target.checked)}
              className="mt-1 size-4 accent-primary"
              data-testid="checkbox-caregiver-present"
            />
            <span>
              <span className="block font-semibold text-foreground">A caregiver is present</span>
             <span className="block text-xs text-muted-foreground">Add an optional voice reference for this session, or skip it.</span>
            </span>
          </label>
        </div>

        {caregiverPresent && (
          <CaptureCard
            title={`Caregiver: ${caregiverName || 'Caregiver'}`}
            subtitle="Optional, but highly recommended if present"
            promptText={caregiverPrompt}
            dateText={dateText}
            state={caregiverState}
            error={caregiverError}
            onStart={onStartCaregiverCapture}
            onStop={onStopCaregiverCapture}
            onReset={onResetCaregiverCapture}
            onSkip={onSkipCaregiverCapture}
            onRetryVerification={onRetryCaregiverVerification}
            diagnostics={caregiverDiagnostics}
          />
        )}
      </div>

      <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-6 rounded-3xl border border-primary/20 bg-primary/5 p-6 md:p-8">
        <div className="flex items-center gap-3 text-primary/80">
          <Shield size={24} className="shrink-0" />
          <p className="text-sm font-medium leading-relaxed">
             Your voice reference is private to this session. It helps distinguish clinician speech from possible Child speech, but never assigns a final role by itself.
          </p>
        </div>
        
        <button type="button" data-testid="button-start-session"
          disabled={!canStartSession || isStartingSession}
          onClick={onStartSession}
          className={cn(
            "focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-8 py-4 text-base font-semibold transition-all duration-200 w-full sm:w-auto",
            canStartSession 
              ? "bg-primary text-primary-foreground shadow-[0_10px_20px_-14px_hsl(var(--brand-forest-950)/.9)] hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md" 
              : "cursor-not-allowed bg-secondary/80 text-muted-foreground opacity-60 shadow-none"
          )}
        >
          {isStartingSession ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Starting Session...
            </>
          ) : (
            <>
              Start Session
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
