import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Opaque invitation secret helpers. Callers persist only the returned digest. */
export const createInvitationToken = () => randomBytes(32).toString("base64url");
export const hashInvitationToken = (token: string) =>
  createHash("sha256").update(token, "utf8").digest("hex");

export const invitationTokenMatchesHash = (token: string, digest: string) => {
  const calculated = Buffer.from(hashInvitationToken(token), "hex");
  const expected = Buffer.from(digest, "hex");
  return calculated.length === expected.length && timingSafeEqual(calculated, expected);
};