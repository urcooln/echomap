import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const VERSION = Buffer.from("EMAP1");
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const encryptionKey = () => {
  const configured = process.env.CHILDLED_DATA_ENCRYPTION_KEY;
  if (configured) {
    const key = /^[0-9a-f]{64}$/i.test(configured)
      ? Buffer.from(configured, "hex")
      : Buffer.from(configured, "base64");
    if (key.length !== 32) {
      throw new Error("CHILDLED_DATA_ENCRYPTION_KEY must encode exactly 32 bytes.");
    }
    return key;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("CHILDLED_DATA_ENCRYPTION_KEY is required in production to store sensitive data.");
  }
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) throw new Error("SESSION_SECRET is required to derive the development encryption key.");
  return createHash("sha256").update(`childled-development-data-key:${sessionSecret}`).digest();
};

export const encryptAtRest = (plaintext: Buffer) => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([VERSION, iv, cipher.getAuthTag(), encrypted]);
};

export const decryptAtRest = (ciphertext: Buffer) => {
  if (!ciphertext.subarray(0, VERSION.length).equals(VERSION)) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Unencrypted sensitive data cannot be served in production.");
    }
    return ciphertext;
  }
  const ivStart = VERSION.length;
  const tagStart = ivStart + IV_LENGTH;
  const bodyStart = tagStart + TAG_LENGTH;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    ciphertext.subarray(ivStart, tagStart),
  );
  decipher.setAuthTag(ciphertext.subarray(tagStart, bodyStart));
  return Buffer.concat([decipher.update(ciphertext.subarray(bodyStart)), decipher.final()]);
};

export const encryptionBoundary = {
  algorithm: "AES-256-GCM",
  keySource: process.env.CHILDLED_DATA_ENCRYPTION_KEY
    ? "CHILDLED_DATA_ENCRYPTION_KEY"
    : "development key derived from SESSION_SECRET",
  productionReady: Boolean(process.env.CHILDLED_DATA_ENCRYPTION_KEY),
};