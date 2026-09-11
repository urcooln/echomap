import assert from "node:assert/strict";
import test from "node:test";
import { loadRuntimeConfig } from "../src/lib/runtime-config";

test("uses safe development defaults without production providers", () => {
  const config = loadRuntimeConfig({ NODE_ENV: "development" });
  assert.equal(config.auth.mode, "clerk");
  assert.equal(config.audioStorage.driver, "local-encrypted");
  assert.equal(config.demoLogin.enabled, false);
  assert.equal(config.clerkInvitations.enabled, false);
});

test("development login requires an explicit owner access key", () => {
  assert.throws(
    () =>
      loadRuntimeConfig({
        NODE_ENV: "development",
        CHILDLED_ENABLE_DEMO_LOGIN: "true",
      }),
    /CHILDLED_DEMO_ACCESS_KEY is required/,
  );

  const config = loadRuntimeConfig({
    NODE_ENV: "development",
    CHILDLED_ENABLE_DEMO_LOGIN: "true",
    CHILDLED_DEMO_ACCESS_KEY: "owner-only-secret",
  });
  assert.equal(config.demoLogin.enabled, true);
  assert.equal(config.demoLogin.accessKey, "owner-only-secret");
});

test("development can opt into private App Storage", () => {
  const config = loadRuntimeConfig({
    NODE_ENV: "development",
    CHILDLED_AUDIO_STORAGE_DRIVER: "app-storage",
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
    CHILDLED_DATA_ENCRYPTION_KEY: "a".repeat(44),
    CHILDLED_AUTH_MODE: "clerk",
    CHILDLED_AUDIO_STORAGE_DRIVER: "app-storage",
    PRIVATE_OBJECT_DIR: "/private-bucket/objects",
    CHILDLED_S3_BUCKET: "legacy-recordings",
    CHILDLED_S3_REGION: "us-east-1",
    CHILDLED_S3_ACCESS_KEY_ID: "legacy-access-key",
    CHILDLED_S3_SECRET_ACCESS_KEY: "legacy-secret",
    CLERK_SECRET_KEY: "sk_test_example",
    CLERK_PUBLISHABLE_KEY: "pk_test_example",
  });

  assert.equal(config.auth.mode, "clerk");
  assert.equal(config.audioStorage.driver, "app-storage");
  assert.equal(config.demoLogin.enabled, false);
  assert.equal(config.clerkInvitations.enabled, true);
  assert.deepEqual(config.allowedOrigins, ["https://app.example.test"]);
});

test("production accepts native Google Cloud Storage for Cloud Run", () => {
  const config = loadRuntimeConfig({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://example",
    PUBLIC_APP_ORIGIN: "https://staging.example.test",
    CHILDLED_DATA_ENCRYPTION_KEY: "a".repeat(44),
    CHILDLED_AUTH_MODE: "clerk",
    CHILDLED_AUDIO_STORAGE_DRIVER: "gcs",
    GCS_PRIVATE_BUCKET: "childled-staging-private",
    CHILDLED_ENABLE_DEMO_LOGIN: "false",
    CHILDLED_LEGACY_S3_MIGRATION_COMPLETE: "true",
    CLERK_SECRET_KEY: "sk_test_example",
    CLERK_PUBLISHABLE_KEY: "pk_test_example",
  });

  assert.equal(config.audioStorage.driver, "gcs");
  assert.equal(config.demoLogin.enabled, false);
  assert.deepEqual(config.allowedOrigins, ["https://staging.example.test"]);
});

test("production can retire legacy S3 credentials only after an explicit migration-complete flag", () => {
  const config = loadRuntimeConfig({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://example",
    PUBLIC_APP_ORIGIN: "https://app.example.test",
    CHILDLED_DATA_ENCRYPTION_KEY: "a".repeat(44),
    CHILDLED_AUTH_MODE: "clerk",
    CHILDLED_AUDIO_STORAGE_DRIVER: "app-storage",
    PRIVATE_OBJECT_DIR: "/private-bucket/objects",
    CHILDLED_LEGACY_S3_MIGRATION_COMPLETE: "true",
    CLERK_SECRET_KEY: "sk_test_example",
    CLERK_PUBLISHABLE_KEY: "pk_test_example",
  });

  assert.equal(config.audioStorage.driver, "app-storage");
});

test("production refuses the development login bypass", () => {
  assert.throws(
    () =>
      loadRuntimeConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://example",
        PUBLIC_APP_ORIGIN: "https://app.example.test",
        CHILDLED_DATA_ENCRYPTION_KEY: "a".repeat(44),
        CHILDLED_AUDIO_STORAGE_DRIVER: "gcs",
        GCS_PRIVATE_BUCKET: "childled-private",
        CHILDLED_LEGACY_S3_MIGRATION_COMPLETE: "true",
        CHILDLED_ENABLE_DEMO_LOGIN: "true",
        CLERK_SECRET_KEY: "sk_test_example",
        CLERK_PUBLISHABLE_KEY: "pk_test_example",
      }),
    /cannot be enabled in production/,
  );
});

test("explicit staging deployment accepts a strong development access key", () => {
  const config = loadRuntimeConfig({
    NODE_ENV: "production",
    CHILDLED_DEPLOYMENT_ENVIRONMENT: "staging",
    DATABASE_URL: "postgres://example",
    PUBLIC_APP_ORIGIN: "https://staging.example.test",
    CHILDLED_DATA_ENCRYPTION_KEY: "a".repeat(44),
    CHILDLED_AUDIO_STORAGE_DRIVER: "gcs",
    GCS_PRIVATE_BUCKET: "childled-staging-private",
    CHILDLED_LEGACY_S3_MIGRATION_COMPLETE: "true",
    CHILDLED_ENABLE_DEMO_LOGIN: "true",
    CHILDLED_DEMO_ACCESS_KEY: "s".repeat(48),
    CLERK_SECRET_KEY: "sk_test_example",
    CLERK_PUBLISHABLE_KEY: "pk_test_example",
  });

  assert.equal(config.demoLogin.enabled, true);
  assert.equal(config.demoLogin.accessKey, "s".repeat(48));
});

test("staging development login refuses a short access key", () => {
  assert.throws(
    () =>
      loadRuntimeConfig({
        NODE_ENV: "production",
        CHILDLED_DEPLOYMENT_ENVIRONMENT: "staging",
        DATABASE_URL: "postgres://example",
        PUBLIC_APP_ORIGIN: "https://staging.example.test",
        CHILDLED_DATA_ENCRYPTION_KEY: "a".repeat(44),
        CHILDLED_AUDIO_STORAGE_DRIVER: "gcs",
        GCS_PRIVATE_BUCKET: "childled-staging-private",
        CHILDLED_LEGACY_S3_MIGRATION_COMPLETE: "true",
        CHILDLED_ENABLE_DEMO_LOGIN: "true",
        CHILDLED_DEMO_ACCESS_KEY: "too-short",
        CLERK_SECRET_KEY: "sk_test_example",
        CLERK_PUBLISHABLE_KEY: "pk_test_example",
      }),
    /at least 32 characters/,
  );
});
