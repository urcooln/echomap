import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) =>
  createHash("sha256").update(value, "utf8").digest();

export const hasValidDevelopmentAccessKey = (
  configuredKey: string | undefined,
  suppliedKey: unknown,
) => {
  if (!configuredKey || typeof suppliedKey !== "string" || !suppliedKey) {
    return false;
  }
  return timingSafeEqual(digest(configuredKey), digest(suppliedKey));
};
