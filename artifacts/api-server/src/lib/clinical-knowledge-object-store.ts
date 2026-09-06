import type { AudioObjectStore } from "./audio-object-store";
import { createAudioObjectStore } from "./audio-object-store-factory";
import {
  RecordingObjectStorage,
  type RecordingObjectStorage as RecordingObjectStorageContract,
} from "./recording-object-storage";
import {
  isManagedObjectStorageDriver,
  runtimeConfig,
  type RuntimeConfig,
} from "./runtime-config";

type AppStorageClient = Pick<
  RecordingObjectStorageContract,
  "write" | "read" | "delete"
>;

const appStorageKey = (key: string) =>
  key.startsWith("/objects/")
    ? key
    : `/objects/childled/clinical-knowledge/${key.replace(/^\/+/, "")}`;

export class AppStorageClinicalKnowledgeObjectStore implements AudioObjectStore {
  constructor(private readonly storage: AppStorageClient) {}

  async put(input: { key?: string; contentType: string; data: Buffer }) {
    const key = appStorageKey(input.key ?? crypto.randomUUID());
    const stored = await this.storage.write(key, input.data, input.contentType);
    return {
      key: stored.objectPath,
      contentType: stored.contentType,
      sizeBytes: stored.sizeBytes,
    };
  }

  async get(key: string) {
    return this.storage.read(appStorageKey(key));
  }

  async delete(key: string) {
    await this.storage.delete(appStorageKey(key));
  }
}

export const createClinicalKnowledgeObjectStore = (
  config: RuntimeConfig = runtimeConfig,
  storage: AppStorageClient = new RecordingObjectStorage(),
): AudioObjectStore =>
  isManagedObjectStorageDriver(config.audioStorage.driver)
    ? new AppStorageClinicalKnowledgeObjectStore(storage)
    : createAudioObjectStore();
