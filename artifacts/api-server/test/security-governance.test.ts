import assert from "node:assert/strict";
import test from "node:test";
import { decryptAtRest, encryptAtRest } from "../src/lib/encryption";
import { safeAuditMetadata } from "../src/lib/audit-sanitization";

test("encrypts sensitive data with authenticated encryption at rest", () => {
  const original = Buffer.from("private session note");
  const encrypted = encryptAtRest(original);

  assert.notDeepEqual(encrypted, original);
  assert.deepEqual(decryptAtRest(encrypted), original);
});

test("rejects tampered encrypted data", () => {
  const encrypted = encryptAtRest(Buffer.from("private audio bytes"));
  encrypted[encrypted.length - 1] = encrypted[encrypted.length - 1]! ^ 0xff;

  assert.throws(() => decryptAtRest(encrypted));
});

test("audit metadata never retains private communication content", () => {
  const metadata = safeAuditMetadata({
    contentType: "audio/webm",
    sizeBytes: 1234,
    transcript: "private words",
    note: "private clinical note",
    password: "never record this",
    token: "never record this",
    childId: 7,
  });

  assert.deepEqual(metadata, {
    contentType: "audio/webm",
    sizeBytes: 1234,
    childId: 7,
  });
});