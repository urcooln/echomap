export const TRANSCRIPTION_PROVIDER = "Replit OpenAI integration";
export const TRANSCRIPTION_MODEL = "whisper-1";

export type RecordingPipelineErrorCode =
  | "EMPTY_RECORDING"
  | "INVALID_RECORDING_DATA"
  | "RECORDING_TOO_LARGE"
  | "RECORDING_UPLOAD_INCOMPLETE"
  | "AUDIO_FORMAT_UNREADABLE"
  | "AUDIO_PREPARATION_FAILED"
  | "TRANSCRIPTION_PROVIDER_LIMIT"
  | "TRANSCRIPTION_NOT_CONFIGURED"
  | "TRANSCRIPTION_PROVIDER_FAILED";

export class RecordingPipelineError extends Error {
  constructor(
    public readonly code: RecordingPipelineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RecordingPipelineError";
  }
}

const supportedRecordingContentTypes = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/mpeg",
  "audio/wav",
  "audio/x-m4a",
]);

const supportedVideoContentTypes = new Set([
  "video/webm",
  "video/mp4",
  "video/quicktime",
]);

export const normalizeRecordingContentType = (contentType: string) => {
  const baseContentType = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (baseContentType === "video/webm") return "audio/webm";
  return supportedRecordingContentTypes.has(baseContentType)
    ? baseContentType
    : null;
};

export const normalizeRecordingUploadContentType = (contentType: string) => {
  const baseContentType = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  return supportedRecordingContentTypes.has(baseContentType) || supportedVideoContentTypes.has(baseContentType)
    ? baseContentType
    : null;
};

export const decodeUploadedRecording = (
  encodedRecording: string,
  expectedContentType?: string,
) => {
  const dataUrl = encodedRecording.match(/^data:([^,]+);base64,([\s\S]*)$/i);
  if (
    dataUrl &&
    expectedContentType &&
    dataUrl[1]?.toLowerCase().split(";")[0] !== expectedContentType.toLowerCase()
  ) {
    throw new RecordingPipelineError(
      "INVALID_RECORDING_DATA",
      "The recording format does not match the uploaded audio. Please record again or choose a different audio file.",
    );
  }
  const normalized = (dataUrl?.[2] ?? encodedRecording).replace(/\s/g, "");
  if (!normalized) {
    throw new RecordingPipelineError(
      "EMPTY_RECORDING",
      "The recording did not contain any audio data. Check the microphone and record again.",
    );
  }

  if (
    !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) ||
    normalized.length % 4 !== 0
  ) {
    throw new RecordingPipelineError(
      "INVALID_RECORDING_DATA",
      "The recording data could not be read. Please record again or choose a different audio file.",
    );
  }

  const recording = Buffer.from(normalized, "base64");
  if (!recording.length) {
    throw new RecordingPipelineError(
      "EMPTY_RECORDING",
      "The recording did not contain any audio data. Check the microphone and record again.",
    );
  }
  return recording;
};

export const safeTranscriptionFailure = (error: unknown) => {
  if (error instanceof RecordingPipelineError) {
    return { code: error.code, message: error.message };
  }

  const message = error instanceof Error ? error.message : "";
  if (
    /AI_INTEGRATIONS_OPENAI_(BASE_URL|API_KEY).*must be set/i.test(message) ||
    /OpenAI AI integration/i.test(message)
  ) {
    return {
      code: "TRANSCRIPTION_NOT_CONFIGURED" as const,
      message:
        "The transcription service is not configured. Ask an administrator to configure the OpenAI integration before trying again.",
    };
  }
  if (/spawn\s+ffmpeg\s+ENOENT|ffmpeg.*not found/i.test(message)) {
    return {
      code: "AUDIO_PREPARATION_FAILED" as const,
      message:
        "Recording processing is temporarily unavailable. Your recording is still available—please retry shortly or ask an administrator to check the audio service.",
    };
  }
  if (
    /ffmpeg|format|wav|audio samples|converted recording/i.test(message)
  ) {
    return {
      code: "AUDIO_FORMAT_UNREADABLE" as const,
      message:
        "This audio file could not be prepared for transcription. Try recording again or choose a WAV, MP3, M4A, WebM, or OGG file.",
    };
  }
  return {
    code: "TRANSCRIPTION_PROVIDER_FAILED" as const,
    message:
      "The transcription service could not complete this recording. Your recording is still available—please retry or continue with manual review.",
  };
};

export const successfulEmptyTranscript = (status: string, rawTranscript: string) =>
  status === "complete" && rawTranscript.trim().length === 0;
