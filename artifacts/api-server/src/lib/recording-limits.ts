export type RecordingLimits = {
  maxAudioUploadBytes: number;
  maxVideoUploadBytes: number;
  maxProviderBytes: number;
};

const DEFAULT_AUDIO_UPLOAD_BYTES = 100 * 1024 * 1024;
const DEFAULT_VIDEO_UPLOAD_BYTES = 500 * 1024 * 1024;
const DEFAULT_PROVIDER_BYTES = 25 * 1024 * 1024;

const readBytes = (
  env: Record<string, string | undefined>,
  key: string,
  fallback: number,
) => {
  const value = env[key]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`ChildLed runtime configuration error: ${key} must be a positive byte count.`);
  }
  return parsed;
};

export const loadRecordingLimits = (
  env: Record<string, string | undefined> = process.env,
): RecordingLimits => ({
  maxAudioUploadBytes: readBytes(env, "CHILDLED_MAX_AUDIO_UPLOAD_BYTES", DEFAULT_AUDIO_UPLOAD_BYTES),
  maxVideoUploadBytes: readBytes(env, "CHILDLED_MAX_VIDEO_UPLOAD_BYTES", DEFAULT_VIDEO_UPLOAD_BYTES),
  maxProviderBytes: readBytes(env, "CHILDLED_TRANSCRIPTION_PROVIDER_MAX_BYTES", DEFAULT_PROVIDER_BYTES),
});

export const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    const megabytes = bytes / (1024 * 1024);
    return `${Number(megabytes.toFixed(megabytes >= 10 ? 0 : 1))} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};
