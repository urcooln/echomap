import assert from "node:assert/strict";
import test from "node:test";
import { loadRuntimeConfig } from "../src/lib/runtime-config";

test("uses safe development defaults without production providers", () => {
  const config = loadRuntimeConfig({ NODE_ENV: "development" });
  assert.equal(config.auth.mode, "clerk");
  assert.equal(config.audioStorage.driver, "local-encrypted");
  assert.equal(config.demoLogin.enabled, true);
});

test("development can opt into private App Storage", () => {
  const config = loadRuntimeConfig({
    NODE_ENV: "development",
    ECHOMAP_AUDIO_STORAGE_DRIVER: "app-storage",
    PRIVATE_OBJECT_DIR: "/private-bucket/objects",
  });
  assert.equal(config.audioStorage.driver, "app-storage");
});

test("production refuses missing deployment-critical configuration", () => {
  assert.throws(
    () => loadRuntimeConfig({ NODE_ENV: "production" }),
    /PUBLIC_APP_ORIGIN is required/,
  );
});

test("production accepts Clerk and private App Storage configuration", () => {
  const config = loadRuntimeConfig({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://example",
    PUBLIC_APP_ORIGIN: "https://app.example.test",
    ECHOMAP_DATA_ENCRYPTION_KEY: "a".repeat(44),
    ECHOMAP_AUTH_MODE: "clerk",
    ECHOMAP_AUDIO_STORAGE_DRIVER: "app-storage",
    PRIVATE_OBJECT_DIR: "/private-bucket/objects",
    ECHOMAP_S3_BUCKET: "legacy-recordings",
    ECHOMAP_S3_REGION: "us-east-1",
    ECHOMAP_S3_ACCESS_KEY_ID: "legacy-access-key",
    ECHOMAP_S3_SECRET_ACCESS_KEY: "legacy-secret",
  });

  assert.equal(config.auth.mode, "clerk");
  assert.equal(config.audioStorage.driver, "app-storage");
  assert.equal(config.demoLogin.enabled, false);
  assert.deepEqual(config.allowedOrigins, ["https://app.example.test"]);
});

test("production accepts native Google Cloud Storage for Cloud Run", () => {
  const config = loadRuntimeConfig({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://example",
    PUBLIC_APP_ORIGIN: "https://staging.example.test",
    ECHOMAP_DATA_ENCRYPTION_KEY: "a".repeat(44),
    ECHOMAP_AUTH_MODE: "clerk",
    ECHOMAP_AUDIO_STORAGE_DRIVER: "gcs",
    GCS_PRIVATE_BUCKET: "echomap-staging-private",
    ECHOMAP_ENABLE_DEMO_LOGIN: "true",
    ECHOMAP_LEGACY_S3_MIGRATION_COMPLETE: "true",
  });

  assert.equal(config.audioStorage.driver, "gcs");
  assert.equal(config.demoLogin.enabled, true);
  assert.deepEqual(config.allowedOrigins, ["https://staging.example.test"]);
});

test("production can retire legacy S3 credentials only after an explicit migration-complete flag", () => {
  const config = loadRuntimeConfig({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://example",
    PUBLIC_APP_ORIGIN: "https://app.example.test",
    ECHOMAP_DATA_ENCRYPTION_KEY: "a".repeat(44),
    ECHOMAP_AUTH_MODE: "clerk",
    ECHOMAP_AUDIO_STORAGE_DRIVER: "app-storage",
    PRIVATE_OBJECT_DIR: "/private-bucket/objects",
    ECHOMAP_LEGACY_S3_MIGRATION_COMPLETE: "true",
  });

  assert.equal(config.audioStorage.driver, "app-storage");
});
