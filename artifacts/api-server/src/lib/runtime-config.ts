export type AudioStorageDriver = "local-encrypted" | "app-storage" | "gcs";
export type AuthMode = "clerk";
import { loadRecordingLimits, type RecordingLimits } from "./recording-limits";

type Environment = Record<string, string | undefined>;

export type RuntimeConfig = {
  isProduction: boolean;
  publicAppOrigin?: string;
  allowedOrigins: string[];
  auth: {
    mode: AuthMode;
    issuerUrl?: string;
    audience?: string;
  };
  audioStorage: {
    driver: AudioStorageDriver;
  };
  demoLogin: {
    enabled: boolean;
  };
  recording: RecordingLimits;
};

const readOptional = (env: Environment, key: string) => {
  const value = env[key]?.trim();
  return value || undefined;
};

const readList = (env: Environment, key: string) =>
  (readOptional(env, key) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const fail = (message: string): never => {
  throw new Error(`ChildLed runtime configuration error: ${message}`);
};

export const isManagedObjectStorageDriver = (
  storageDriver: string | undefined,
): storageDriver is Extract<AudioStorageDriver, "app-storage" | "gcs"> =>
  storageDriver === "app-storage" || storageDriver === "gcs";

export const loadRuntimeConfig = (
  env: Environment = process.env,
): RuntimeConfig => {
  const isProduction = env.NODE_ENV === "production";
  const publicAppOrigin = readOptional(env, "PUBLIC_APP_ORIGIN");
  const allowedOrigins = readList(env, "ALLOWED_APP_ORIGINS");
  const authMode = (readOptional(env, "CHILDLED_AUTH_MODE") ??
    "clerk") as AuthMode;
  const demoLoginEnabled =
    !isProduction || readOptional(env, "CHILDLED_ENABLE_DEMO_LOGIN") === "true";
  const storageDriver = (readOptional(env, "CHILDLED_AUDIO_STORAGE_DRIVER") ??
    (isProduction ? "app-storage" : "local-encrypted")) as AudioStorageDriver;

  if (authMode !== "clerk") {
    fail("CHILDLED_AUTH_MODE must be clerk.");
  }
  if (
    storageDriver !== "local-encrypted" &&
    !isManagedObjectStorageDriver(storageDriver)
  ) {
    fail(
      "CHILDLED_AUDIO_STORAGE_DRIVER must be local-encrypted, app-storage, or gcs.",
    );
  }
  if (isProduction && !publicAppOrigin) {
    fail("PUBLIC_APP_ORIGIN is required in production.");
  }
  if (isProduction && !readOptional(env, "DATABASE_URL")) {
    fail("DATABASE_URL is required in production.");
  }
  if (isProduction && !readOptional(env, "CHILDLED_DATA_ENCRYPTION_KEY")) {
    fail("CHILDLED_DATA_ENCRYPTION_KEY is required in production.");
  }
  if (isProduction && storageDriver === "local-encrypted") {
    fail(
      "production requires CHILDLED_AUDIO_STORAGE_DRIVER=app-storage or gcs.",
    );
  }
  if (
    storageDriver === "app-storage" &&
    !readOptional(env, "PRIVATE_OBJECT_DIR")
  ) {
    fail("app-storage requires PRIVATE_OBJECT_DIR.");
  }
  if (storageDriver === "gcs" && !readOptional(env, "GCS_PRIVATE_BUCKET")) {
    fail("gcs requires GCS_PRIVATE_BUCKET.");
  }
  if (
    isProduction &&
    readOptional(env, "CHILDLED_LEGACY_S3_MIGRATION_COMPLETE") !== "true" &&
    (!readOptional(env, "CHILDLED_S3_BUCKET") ||
      !readOptional(env, "CHILDLED_S3_REGION") ||
      !readOptional(env, "CHILDLED_S3_ACCESS_KEY_ID") ||
      !readOptional(env, "CHILDLED_S3_SECRET_ACCESS_KEY"))
  ) {
    fail(
      "Legacy S3 recording access requires CHILDLED_S3_BUCKET, CHILDLED_S3_REGION, CHILDLED_S3_ACCESS_KEY_ID, and CHILDLED_S3_SECRET_ACCESS_KEY until CHILDLED_LEGACY_S3_MIGRATION_COMPLETE=true is set.",
    );
  }

  return {
    isProduction,
    publicAppOrigin,
    allowedOrigins: [
      ...new Set(
        [publicAppOrigin, ...allowedOrigins].filter(Boolean) as string[],
      ),
    ],
    auth: {
      mode: authMode,
    },
    audioStorage: {
      driver: storageDriver,
    },
    demoLogin: {
      enabled: demoLoginEnabled,
    },
    recording: loadRecordingLimits(env),
  };
};

export const runtimeConfig = loadRuntimeConfig();
