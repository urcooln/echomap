import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  EncryptedLocalAudioObjectStore,
  isLegacyS3StorageDriver,
  persistedAudioObjectMetadata,
  S3CompatibleAudioObjectStore,
  type S3CompatibleClient,
} from "../src/lib/audio-object-store";

process.env.SESSION_SECRET = "audio-object-store-test-secret";

test("encrypted local audio storage never writes the original recording bytes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "childled-audio-"));
  try {
    const store = new EncryptedLocalAudioObjectStore(directory);
    const recording = Buffer.from("private clinical recording bytes");
    const stored = await store.put({
      key: "recording.webm",
      contentType: "audio/webm",
      data: recording,
    });

    assert.equal(stored.key, "recording.webm");
    assert.deepEqual(await store.get("recording.webm"), recording);
    assert.notDeepEqual(
      await readFile(path.join(directory, "recording.webm")),
      recording,
    );

    await store.delete("recording.webm");
    await assert.rejects(() => store.get("recording.webm"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the S3-compatible adapter only relies on standard object commands", async () => {
  const objects = new Map<string, Buffer>();
  const calls: string[] = [];
  const client: S3CompatibleClient = {
    async putObject(input) {
      calls.push(`put:${input.Bucket}:${input.Key}:${input.ContentType}`);
      objects.set(input.Key, input.Body);
    },
    async getObject(input) {
      calls.push(`get:${input.Bucket}:${input.Key}`);
      const data = objects.get(input.Key);
      return {
        Body: data
          ? (async function* () {
              yield data;
            })()
          : undefined,
      };
    },
    async deleteObject(input) {
      calls.push(`delete:${input.Bucket}:${input.Key}`);
      objects.delete(input.Key);
    },
  };
  const store = new S3CompatibleAudioObjectStore(
    client,
    "private-audio",
    "org-4/audio",
  );

  await store.put({
    key: "org-4/audio/recording.wav",
    contentType: "audio/wav",
    data: Buffer.from("audio"),
  });
  assert.deepEqual(
    await store.get("org-4/audio/recording.wav"),
    Buffer.from("audio"),
  );
  await store.delete("org-4/audio/recording.wav");

  assert.deepEqual(calls, [
    "put:private-audio:org-4/audio/recording.wav:audio/wav",
    "get:private-audio:org-4/audio/recording.wav",
    "delete:private-audio:org-4/audio/recording.wav",
  ]);
});

test("historical S3 rows keep using the legacy object-store driver", () => {
  assert.equal(isLegacyS3StorageDriver("s3"), true);
  assert.equal(isLegacyS3StorageDriver("app-storage"), false);
  assert.equal(isLegacyS3StorageDriver("gcs"), false);
  assert.equal(isLegacyS3StorageDriver("local-encrypted"), false);
});

test("managed object storage uploads persist the final returned object path", () => {
  assert.deepEqual(
    persistedAudioObjectMetadata("app-storage", {
      key: "/objects/recordings/final.webm",
    }),
    {
      storageDriver: "app-storage",
      objectKey: "/objects/recordings/final.webm",
    },
  );
  assert.deepEqual(
    persistedAudioObjectMetadata("gcs", {
      key: "/objects/recordings/final.webm",
    }),
    { storageDriver: "gcs", objectKey: "/objects/recordings/final.webm" },
  );
});
