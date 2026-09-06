import path from "node:path";
import {
  EncryptedLocalAudioObjectStore,
  isLegacyS3StorageDriver,
  S3CompatibleAudioObjectStore,
  type AudioObjectStore,
} from "./audio-object-store";
import { RecordingObjectStorage } from "./recording-object-storage";
import { isManagedObjectStorageDriver, runtimeConfig } from "./runtime-config";
import { S3HttpClient } from "./s3-http-client";

class ManagedObjectAudioObjectStore implements AudioObjectStore {
  private readonly storage = new RecordingObjectStorage();

  async put(input: { key?: string; contentType: string; data: Buffer }) {
    const stored = await this.storage.putFinal(input.data, input.contentType);
    return {
      key: stored.objectPath,
      contentType: stored.contentType,
      sizeBytes: stored.sizeBytes,
    };
  }

  get(key: string) {
    return this.storage.read(key);
  }

  delete(key: string) {
    return this.storage.delete(key);
  }
}

export const createAudioObjectStore = (): AudioObjectStore => {
  return isManagedObjectStorageDriver(runtimeConfig.audioStorage.driver)
    ? new ManagedObjectAudioObjectStore()
    : new EncryptedLocalAudioObjectStore(
        path.resolve(process.cwd(), ".data", "childled-sessions", "audio"),
      );
};

/**
 * New production recordings are written to managed private object storage. This
 * adapter exists solely to read and delete rows created by the prior S3-backed
 * implementation.
 */
export const createLegacyS3AudioObjectStore = (): AudioObjectStore => {
  const bucket = process.env.CHILDLED_S3_BUCKET;
  const region = process.env.CHILDLED_S3_REGION;
  const accessKeyId = process.env.CHILDLED_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CHILDLED_S3_SECRET_ACCESS_KEY;
  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Legacy S3 recordings require CHILDLED_S3_BUCKET, CHILDLED_S3_REGION, CHILDLED_S3_ACCESS_KEY_ID, and CHILDLED_S3_SECRET_ACCESS_KEY.",
    );
  }
  return new S3CompatibleAudioObjectStore(
    new S3HttpClient({
      endpoint: process.env.CHILDLED_S3_ENDPOINT,
      region,
      accessKeyId,
      secretAccessKey,
      sessionToken: process.env.CHILDLED_S3_SESSION_TOKEN,
      forcePathStyle: process.env.CHILDLED_S3_FORCE_PATH_STYLE === "true",
    }),
    bucket,
  );
};

/**
 * Persisted records carry their own driver so storage migrations remain
 * readable and deletable. New writes use the configured default; historical
 * S3 keys must never be sent to the managed object-storage adapter.
 */
export const objectStoreForStorageDriver = (
  storageDriver: string,
): AudioObjectStore =>
  isLegacyS3StorageDriver(storageDriver)
    ? createLegacyS3AudioObjectStore()
    : createAudioObjectStore();
