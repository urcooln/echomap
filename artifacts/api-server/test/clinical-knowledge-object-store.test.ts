import assert from "node:assert/strict";
import test from "node:test";
import {
  createClinicalKnowledgeObjectStore,
  type AppStorageClinicalKnowledgeObjectStore,
} from "../src/lib/clinical-knowledge-object-store";
import type { RuntimeConfig } from "../src/lib/runtime-config";

const appStorageConfig: RuntimeConfig = {
  isProduction: true,
  allowedOrigins: [],
  auth: { mode: "clerk" },
  audioStorage: { driver: "app-storage" },
  demoLogin: { enabled: false },
};
const gcsStorageConfig: RuntimeConfig = {
  ...appStorageConfig,
  audioStorage: { driver: "gcs" },
};

test("clinical knowledge uses private App Storage when app-storage is configured", async () => {
  await assertPrivateObjectStore(appStorageConfig);
});

test("clinical knowledge uses private object storage when gcs is configured", async () => {
  await assertPrivateObjectStore(gcsStorageConfig);
});

async function assertPrivateObjectStore(config: RuntimeConfig) {
  const objects = new Map<string, Buffer>();
  const writes: Array<{ key: string; contentType: string }> = [];
  const store = createClinicalKnowledgeObjectStore(config, {
    async write(key, data, contentType) {
      writes.push({ key, contentType });
      objects.set(key, data);
      return { objectPath: key, contentType, sizeBytes: data.length };
    },
    async read(key) {
      const data = objects.get(key);
      if (!data) throw new Error("Object not found.");
      return data;
    },
    async delete(key) {
      objects.delete(key);
    },
  }) as AppStorageClinicalKnowledgeObjectStore;

  const source = Buffer.from("private clinical knowledge source");
  const stored = await store.put({
    key: "organization-7/source.pdf",
    contentType: "application/pdf",
    data: source,
  });

  assert.equal(
    stored.key,
    "/objects/childled/clinical-knowledge/organization-7/source.pdf",
  );
  assert.equal(stored.contentType, "application/pdf");
  assert.equal(stored.sizeBytes, source.length);
  assert.deepEqual(writes, [
    {
      key: "/objects/childled/clinical-knowledge/organization-7/source.pdf",
      contentType: "application/pdf",
    },
  ]);
  assert.deepEqual(await store.get(stored.key), source);

  await store.delete(stored.key);
  await assert.rejects(() => store.get(stored.key), /Object not found/);
}
