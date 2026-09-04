export type File = {
  getMetadata: () => Promise<[Record<string, unknown>]>;
  getSignedUrl: (options: unknown) => Promise<[string]>;
  copy: (destination?: unknown, options?: unknown) => Promise<void>;
  delete: (options?: unknown) => Promise<void>;
  download: () => Promise<[Buffer]>;
  save: (data: Buffer, options?: unknown) => Promise<void>;
};

export const storageTestState = {
  saved: [] as Array<{
    bucketName: string;
    objectName: string;
    data: Buffer;
    options: unknown;
  }>,
  signedUrls: [] as Array<{
    bucketName: string;
    objectName: string;
    options: unknown;
  }>,
  clients: [] as Array<unknown>,
  reset() {
    this.saved = [];
    this.signedUrls = [];
    this.clients = [];
  },
};

export class Storage {
  constructor(options?: unknown) {
    storageTestState.clients.push(options);
  }

  bucket(bucketName: string) {
    return {
      file: (objectName: string): File => ({
        getMetadata: async () => [{ contentType: "", size: 0 }],
        getSignedUrl: async (options: unknown) => {
          storageTestState.signedUrls.push({ bucketName, objectName, options });
          return [
            `https://storage.test/${bucketName}/${objectName}?signed=true`,
          ];
        },
        copy: async () => undefined,
        delete: async () => undefined,
        download: async () => [Buffer.alloc(0)],
        save: async (data: Buffer, options?: unknown) => {
          storageTestState.saved.push({
            bucketName,
            objectName,
            data: Buffer.from(data),
            options,
          });
        },
      }),
    };
  }
}
