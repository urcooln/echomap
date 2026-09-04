export type CalibrationDiagnosticStage =
  | "capture"
  | "upload_reservation"
  | "private_upload"
  | "duration_probe"
  | "finalization"
  | "database_save";

export type CalibrationFailureCode =
  | "CALIBRATION_OBJECT_UNAVAILABLE"
  | "CALIBRATION_DURATION_PROBE_TIMEOUT"
  | "CALIBRATION_MEDIA_UNREADABLE"
  | "CALIBRATION_DURATION_UNVERIFIED"
  | "CALIBRATION_FINALIZATION_FAILED"
  | "CALIBRATION_DATABASE_SAVE_FAILED";

export type CalibrationFailureDetail = {
  stage: CalibrationDiagnosticStage;
  code: CalibrationFailureCode;
  message: string;
  failureKind: "timeout" | "object_unavailable" | "media_unreadable" | "verification_failed" | "finalization_failed" | "database_save_failed";
};

export const needsWebmDurationConversion = (
  contentType: string,
  sourceContainer: string | null,
  durationSeconds: number | null,
) => (
  contentType === "audio/webm"
  && Boolean(sourceContainer?.split(",").includes("webm"))
  && durationSeconds === null
);

type ErrorLike = {
  name?: unknown;
  code?: unknown;
  signal?: unknown;
  killed?: unknown;
  stderr?: unknown;
  message?: unknown;
};

const errorLike = (error: unknown): ErrorLike =>
  error && typeof error === "object" ? error as ErrorLike : {};

const errorText = (error: unknown) => {
  const details = errorLike(error);
  const values = [details.message, details.stderr]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return values;
};

export const classifyCalibrationProbeFailure = (error: unknown): CalibrationFailureDetail => {
  const details = errorLike(error);
  const text = errorText(error);
  const code = typeof details.code === "number" ? details.code : undefined;
  const timedOut = details.killed === true
    || details.signal === "SIGTERM"
    || /timed? ?out|timeout|abort/.test(text);

  if (timedOut) {
    return {
      stage: "duration_probe",
      code: "CALIBRATION_DURATION_PROBE_TIMEOUT",
      message: "The server took too long to inspect the uploaded audio duration.",
      failureKind: "timeout",
    };
  }

  if (code === 404 || /not found|no such object|does not exist/.test(text)) {
    return {
      stage: "duration_probe",
      code: "CALIBRATION_OBJECT_UNAVAILABLE",
      message: "The uploaded calibration object was not available for server-side inspection.",
      failureKind: "object_unavailable",
    };
  }

  if (
    /ffprobe|invalid data|invalid.*media|moov atom|ebml|matroska|webm|could not find|unable to detect/.test(text)
  ) {
    return {
      stage: "duration_probe",
      code: "CALIBRATION_MEDIA_UNREADABLE",
      message: "The uploaded audio format could not be read for duration verification.",
      failureKind: "media_unreadable",
    };
  }

  return {
    stage: "duration_probe",
    code: "CALIBRATION_DURATION_UNVERIFIED",
    message: "The server could not verify the uploaded audio duration.",
    failureKind: "verification_failed",
  };
};

export const calibrationFinalizationFailure = (error: unknown): CalibrationFailureDetail => ({
  stage: "finalization",
  code: "CALIBRATION_FINALIZATION_FAILED",
  message: "The verified calibration could not be finalized in private storage.",
  failureKind: "finalization_failed",
});

export const calibrationDatabaseSaveFailure = (error: unknown): CalibrationFailureDetail => ({
  stage: "database_save",
  code: "CALIBRATION_DATABASE_SAVE_FAILED",
  message: "The verified calibration could not be saved to the session record.",
  failureKind: "database_save_failed",
});