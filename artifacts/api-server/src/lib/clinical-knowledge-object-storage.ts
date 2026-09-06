import { randomUUID } from "node:crypto";
import { createAudioObjectStore } from "./audio-object-store-factory";
import { RecordingObjectStorage } from "./recording-object-storage";
import { isManagedObjectStorageDriver, runtimeConfig } from "./runtime-config";

type ClinicalKnowledgeObjectInput = {
  organizationId: number;
  key?: string;
  contentType: string;
  data: Buffer;
};

const appStorage = new RecordingObjectStorage();

/**
 * Clinical knowledge documents share the deployment-safe private object store
 * used for recordings. The legacy local store remains available only for
 * explicitly configured local development.
 */
export const storeClinicalKnowledgeObject = async (
  input: ClinicalKnowledgeObjectInput,
) => {
  const key = input.key ?? randomUUID();
  const relativeKey = `knowledge/${input.organizationId}/${key}`;

  if (isManagedObjectStorageDriver(runtimeConfig.audioStorage.driver)) {
    return appStorage.putServerObject({
      objectPath: `/objects/childled/${relativeKey}`,
      contentType: input.contentType,
      data: input.data,
    });
  }

  return createAudioObjectStore().put({
    key: relativeKey,
    contentType: input.contentType,
    data: input.data,
  });
};
