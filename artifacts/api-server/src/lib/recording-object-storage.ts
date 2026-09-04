import { randomUUID } from "node:crypto";
import { Storage, type File } from "@google-cloud/storage";
import { runtimeConfig } from "./runtime-config";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const RECORDING_PREFIX = "echomap/session-recordings";
const OBSERVATION_VIDEO_PREFIX = "echomap/observation-videos";
const FINAL_SEGMENT = "/final/";
const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;

type ObjectLocation = { bucketName: string; objectName: string };

export type RecordingUploadReservation = {
  objectPath: string;
  uploadUrl: string;
};

export type StoredRecordingObject = {
  objectPath: string;
  contentType: string;
  sizeBytes: number;
};

let objectStorageClient: Storage | undefined;

const usingNativeGcs = () => runtimeConfig.audioStorage.driver === "gcs";

const storageClient = () => {
  if (!objectStorageClient) {
    objectStorageClient = usingNativeGcs()
      ? new Storage()
      : new Storage({
          credentials: {
            audience: "replit",
            subject_token_type: "access_token",
            token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
            type: "external_account",
            credential_source: {
              url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
              format: {
                type: "json",
                subject_token_field_name: "access_token",
              },
            },
            universe_domain: "googleapis.com",
          },
          projectId: "",
        });
  }
  return objectStorageClient;
};

const objectPrefix = () =>
  (process.env.GCS_PRIVATE_OBJECT_PREFIX?.trim() || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

const privateObjectDirectory = () => {
  if (usingNativeGcs()) {
    const bucket = process.env.GCS_PRIVATE_BUCKET?.trim();
    if (!bucket)
      throw new Error("GCS_PRIVATE_BUCKET is required for private recordings.");
    const prefix = objectPrefix();
    return prefix ? `/${bucket}/${prefix}` : `/${bucket}`;
  }

  const directory = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!directory)
    throw new Error("PRIVATE_OBJECT_DIR is required for private recordings.");
  return directory.replace(/\/+$/, "");
};

const parseObjectLocation = (value: string): ObjectLocation => {
  const path = value.startsWith("/") ? value : `/${value}`;
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) throw new Error("Private object path is invalid.");
  return { bucketName: parts[0]!, objectName: parts.slice(1).join("/") };
};

const signedUploadUrl = async (
  location: ObjectLocation,
  contentType: string,
) => {
  if (usingNativeGcs()) {
    const [url] = await storageClient()
      .bucket(location.bucketName)
      .file(location.objectName)
      .getSignedUrl({
        action: "write",
        contentType,
        expires: Date.now() + UPLOAD_URL_TTL_MS,
        version: "v4",
      });
    return url;
  }

  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket_name: location.bucketName,
        object_name: location.objectName,
        method: "PUT",
        expires_at: new Date(Date.now() + UPLOAD_URL_TTL_MS).toISOString(),
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok)
    throw new Error(
      `Could not sign the private recording upload (${response.status}).`,
    );
  const body = (await response.json()) as { signed_url?: string };
  if (!body.signed_url)
    throw new Error("The private recording upload URL was unavailable.");
  return body.signed_url;
};

const privateObjectLocation = (objectPath: string) =>
  parseObjectLocation(
    `${privateObjectDirectory()}${objectPath.slice("/objects".length)}`,
  );

export class RecordingObjectStorage {
  async putServerObject(input: {
    objectPath: string;
    contentType: string;
    data: Buffer;
  }) {
    if (!input.objectPath.startsWith("/objects/")) {
      throw new Error("Private server object path is invalid.");
    }
    await this.fileFor(input.objectPath).save(input.data, {
      resumable: false,
      metadata: { contentType: input.contentType },
    });
    return {
      key: input.objectPath,
      contentType: input.contentType,
      sizeBytes: input.data.length,
    };
  }

  async reserveUpload(
    organizationId: number | null,
    contentType = "application/octet-stream",
    audioId = randomUUID(),
  ): Promise<RecordingUploadReservation & { audioId: string }> {
    const objectPath = `/objects/${RECORDING_PREFIX}/staging/${organizationId ?? "development"}/${audioId}`;
    return {
      audioId,
      objectPath,
      uploadUrl: await signedUploadUrl(
        privateObjectLocation(objectPath),
        contentType,
      ),
    };
  }

  async reserveObservationVideoUpload(
    organizationId: number | null,
    childId: number,
    contentType = "application/octet-stream",
    videoId = randomUUID(),
  ): Promise<
    RecordingUploadReservation & { videoId: string; finalObjectPath: string }
  > {
    const objectPath = `/objects/${OBSERVATION_VIDEO_PREFIX}/staging/${organizationId ?? "development"}/${childId}/${videoId}`;
    const finalObjectPath = `/objects/${OBSERVATION_VIDEO_PREFIX}/final/${videoId}`;
    return {
      videoId,
      objectPath,
      finalObjectPath,
      uploadUrl: await signedUploadUrl(
        privateObjectLocation(objectPath),
        contentType,
      ),
    };
  }

  async write(objectPath: string, data: Buffer, contentType: string) {
    await this.fileFor(objectPath).save(data, {
      contentType,
      resumable: false,
      validation: false,
      preconditionOpts: { ifGenerationMatch: 0 },
    });
    return { objectPath, contentType, sizeBytes: data.length };
  }

  /**
   * Copies a browser-writable staging object to a server-controlled final key.
   * The source generation is pinned, so an overwrite after metadata verification
   * causes the copy to fail rather than attaching unverified bytes.
   */
  async finalizeExpectedObject(
    objectPath: string,
    contentType: string,
    sizeBytes: number,
    finalPrefix = RECORDING_PREFIX,
    expectedFinalObjectPath?: string,
  ) {
    if (objectPath.includes(FINAL_SEGMENT)) {
      return (await this.hasExpectedObject(objectPath, contentType, sizeBytes))
        ? objectPath
        : null;
    }

    const source = this.fileFor(objectPath);
    let metadata: {
      contentType?: string;
      size?: string | number;
      generation?: string | number;
    };
    try {
      [metadata] = await source.getMetadata();
    } catch (error: unknown) {
      const code =
        typeof error === "object" && error && "code" in error
          ? Number(error.code)
          : undefined;
      if (code === 404) return null;
      throw error;
    }
    if (
      metadata.contentType !== contentType ||
      Number(metadata.size) !== sizeBytes ||
      !metadata.generation
    )
      return null;

    const finalObjectPath =
      expectedFinalObjectPath ??
      `/objects/${finalPrefix}/final/${randomUUID()}`;
    const finalFile = this.fileFor(finalObjectPath);
    const pinnedSource = this.fileFor(objectPath, String(metadata.generation));
    try {
      await pinnedSource.copy(finalFile, {
        preconditionOpts: { ifGenerationMatch: 0 },
      });
    } catch (error: unknown) {
      const code =
        typeof error === "object" && error && "code" in error
          ? Number(error.code)
          : undefined;
      if (code === 404 || code === 412) return null;
      throw error;
    }

    if (
      !(await this.hasExpectedObject(finalObjectPath, contentType, sizeBytes))
    ) {
      await this.delete(finalObjectPath);
      return null;
    }
    await pinnedSource.delete({ ignoreNotFound: true });
    return finalObjectPath;
  }

  async finalizeObservationVideo(
    objectPath: string,
    contentType: string,
    sizeBytes: number,
    finalObjectPath: string,
  ) {
    return this.finalizeExpectedObject(
      objectPath,
      contentType,
      sizeBytes,
      OBSERVATION_VIDEO_PREFIX,
      finalObjectPath,
    );
  }

  async putFinal(
    data: Buffer,
    contentType: string,
  ): Promise<StoredRecordingObject> {
    const objectPath = `/objects/${RECORDING_PREFIX}/final/${randomUUID()}`;
    const file = this.fileFor(objectPath);
    await file.save(data, {
      resumable: false,
      contentType,
      metadata: { cacheControl: "private, no-store" },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
    return { objectPath, contentType, sizeBytes: data.length };
  }

  async hasExpectedObject(
    objectPath: string,
    contentType: string,
    sizeBytes: number,
  ) {
    try {
      const [metadata] = await this.fileFor(objectPath).getMetadata();
      return (
        metadata.contentType === contentType &&
        Number(metadata.size) === sizeBytes
      );
    } catch (error: unknown) {
      const code =
        typeof error === "object" && error && "code" in error
          ? Number(error.code)
          : undefined;
      if (code === 404) return false;
      throw error;
    }
  }

  async read(objectPath: string) {
    const [data] = await this.fileFor(objectPath).download();
    return Buffer.from(data);
  }

  async stream(objectPath: string) {
    const file = this.fileFor(objectPath);
    const [metadata] = await file.getMetadata();
    return { file, metadata };
  }

  async delete(objectPath: string) {
    await this.fileFor(objectPath).delete({ ignoreNotFound: true });
  }

  private fileFor(objectPath: string, generation?: string): File {
    if (!objectPath.startsWith("/objects/"))
      throw new Error("Private recording object path is invalid.");
    const location = privateObjectLocation(objectPath);
    return storageClient()
      .bucket(location.bucketName)
      .file(location.objectName, generation ? { generation } : undefined);
  }
}
