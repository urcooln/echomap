import assert from "node:assert/strict";
import test from "node:test";
import { storageTestState } from "./google-cloud-storage.stub";

process.env.NODE_ENV = "production";
process.env.DATABASE_URL = "postgres://example";
process.env.PUBLIC_APP_ORIGIN = "https://staging.example.test";
process.env.ECHOMAP_DATA_ENCRYPTION_KEY = "a".repeat(44);
process.env.ECHOMAP_AUDIO_STORAGE_DRIVER = "gcs";
process.env.GCS_PRIVATE_BUCKET = "echomap-staging-private";
process.env.GCS_PRIVATE_OBJECT_PREFIX = "staging";
process.env.ECHOMAP_LEGACY_S3_MIGRATION_COMPLETE = "true";

const { RecordingObjectStorage } =
  await import("../src/lib/recording-object-storage");

test("GCS upload reservations use native signed URLs and the configured private bucket", async () => {
  storageTestState.reset();
  const storage = new RecordingObjectStorage();

  const reservation = await storage.reserveUpload(
    7,
    "audio/webm",
    "recording-1",
  );

  assert.deepEqual(reservation, {
    audioId: "recording-1",
    objectPath: "/objects/echomap/session-recordings/staging/7/recording-1",
    uploadUrl:
      "https://storage.test/echomap-staging-private/staging/echomap/session-recordings/staging/7/recording-1?signed=true",
  });
  assert.equal(storageTestState.clients.length, 1);
  assert.equal(storageTestState.clients[0], undefined);
  assert.deepEqual(storageTestState.signedUrls, [
    {
      bucketName: "echomap-staging-private",
      objectName: "staging/echomap/session-recordings/staging/7/recording-1",
      options: {
        action: "write",
        contentType: "audio/webm",
        expires: storageTestState.signedUrls[0]!.options.expires,
        version: "v4",
      },
    },
  ]);
  assert.equal(
    typeof (storageTestState.signedUrls[0]!.options as { expires: unknown })
      .expires,
    "number",
  );
});
