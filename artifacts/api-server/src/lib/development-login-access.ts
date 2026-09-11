import { createHash, timingSafeEqual } from "node:crypto";

const failedAttemptWindowMs = 15 * 60 * 1000;
const maximumFailedAttempts = 10;
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

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

export const developmentLoginRetryAfterSeconds = (
  clientId: string,
  now = Date.now(),
) => {
  const attempt = failedAttempts.get(clientId);
  if (!attempt) return 0;
  if (attempt.resetAt <= now) {
    failedAttempts.delete(clientId);
    return 0;
  }
  return attempt.count >= maximumFailedAttempts
    ? Math.max(1, Math.ceil((attempt.resetAt - now) / 1000))
    : 0;
};

export const recordDevelopmentLoginFailure = (
  clientId: string,
  now = Date.now(),
) => {
  const attempt = failedAttempts.get(clientId);
  if (!attempt || attempt.resetAt <= now) {
    failedAttempts.set(clientId, {
      count: 1,
      resetAt: now + failedAttemptWindowMs,
    });
    return;
  }
  attempt.count += 1;
};

export const clearDevelopmentLoginFailures = (clientId: string) => {
  failedAttempts.delete(clientId);
};
