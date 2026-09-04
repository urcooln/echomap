import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { decryptAtRest, encryptAtRest } from "./encryption";

export type StoredAudioObject = {
  key: string;
  contentType: string;
  sizeBytes: number;
};

export type AudioObjectStore = {
  put(input: { key?: string; contentType: string; data: Buffer }): Promise<StoredAudioObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
};

export const isLegacyS3StorageDriver = (storageDriver: string) => storageDriver === "s3";

export const persistedAudioObjectMetadata = (
  storageDriver: string,
  storedObject: Pick<StoredAudioObject, "key">,
) => ({
  storageDriver,
  objectKey: storedObject.key,
});

export class EncryptedLocalAudioObjectStore implements AudioObjectStore {
  constructor(private readonly directory: string) {}

  async put(input: { key?: string; contentType: string; data: Buffer }): Promise<StoredAudioObject> {
    const key = input.key ?? randomUUID();
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, encryptAtRest(input.data));
    return { key, contentType: input.contentType, sizeBytes: input.data.length };
  }

  async get(key: string) {
    return decryptAtRest(await readFile(this.resolve(key)));
  }

  async delete(key: string) {
    await unlink(this.resolve(key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  private resolve(key: string) {
    const target = path.resolve(this.directory, key);
    if (!target.startsWith(`${this.directory}${path.sep}`)) {
      throw new Error("Audio storage key is outside the configured private directory.");
    }
    return target;
  }
}

export type S3CompatibleClient = {
  putObject(input: { Bucket: string; Key: string; Body: Buffer; ContentType: string }): Promise<unknown>;
  getObject(input: { Bucket: string; Key: string }): Promise<{ Body?: AsyncIterable<Uint8Array> }>;
  deleteObject(input: { Bucket: string; Key: string }): Promise<unknown>;
};

/**
 * This intentionally depends on the small S3 command surface rather than a
 * cloud SDK. Production composition can pass AWS SDK, MinIO, R2, or another
 * S3-compatible client without changing clinical routes.
 */
export class S3CompatibleAudioObjectStore implements AudioObjectStore {
  constructor(
    private readonly client: S3CompatibleClient,
    private readonly bucket: string,
    private readonly keyPrefix = "echomap/audio",
  ) {}

  async put(input: { key?: string; contentType: string; data: Buffer }): Promise<StoredAudioObject> {
    const key = input.key ?? `${this.keyPrefix}/${randomUUID()}`;
    await this.client.putObject({
      Bucket: this.bucket,
      Key: key,
      Body: input.data,
      ContentType: input.contentType,
    });
    return { key, contentType: input.contentType, sizeBytes: input.data.length };
  }

  async get(key: string) {
    const response = await this.client.getObject({ Bucket: this.bucket, Key: key });
    if (!response.Body) throw new Error("Audio object body was unavailable.");
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async delete(key: string) {
    await this.client.deleteObject({ Bucket: this.bucket, Key: key });
  }
}