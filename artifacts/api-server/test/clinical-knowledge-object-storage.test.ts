import assert from "node:assert/strict";
import test from "node:test";
import { storageTestState } from "./google-cloud-storage.stub";

process.env.ECHOMAP_AUDIO_STORAGE_DRIVER = "app-storage";
process.env.PRIVATE_OBJECT_DIR = "/knowledge-test-bucket/private";

const { storeClinicalKnowledgeObject } = await import("../src/lib/clinical-knowledge-object-storage");

test("stores clinical knowledge uploads in organization-scoped private App Storage", async () => {
  storageTestState.reset();
  const data = Buffer.from("Private clinical reference");

  const stored = await storeClinicalKnowledgeObject({
    organizationId: 42,
    key: "upload-1",
    contentType: "application/pdf",
    data,
  });

  assert.deepEqual(stored, {
    key: "/objects/echomap/knowledge/42/upload-1",
    contentType: "application/pdf",
    sizeBytes: data.length,
  });
  assert.equal(storageTestState.saved.length, 1);
  assert.deepEqual(storageTestState.saved[0], {
    bucketName: "knowledge-test-bucket",
    objectName: "private/echomap/knowledge/42/upload-1",
    data,
    options: {
      resumable: false,
      metadata: { contentType: "application/pdf" },
    },
  });
});