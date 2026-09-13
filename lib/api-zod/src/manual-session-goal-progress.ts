export type ManualSessionGoalProgressField =
  "accuracyPercent" | "successfulAttempts" | "totalAttempts" | "progressNote";

type NumericInput = number | string | null | undefined;

export type ManualSessionGoalProgressValues = {
  accuracyPercent?: NumericInput;
  successfulAttempts?: NumericInput;
  totalAttempts?: NumericInput;
  promptingLevel?: string | null;
  progressNote?: string | null;
};

export type ManualSessionGoalProgressValidation = {
  valid: boolean;
  usesAttempts: boolean;
  errors: Partial<Record<ManualSessionGoalProgressField, string>>;
  values: {
    accuracyPercent: number | null;
    successfulAttempts: number | null;
    totalAttempts: number | null;
  };
};

const isBlank = (value: NumericInput) =>
  value == null || (typeof value === "string" && !value.trim());

const numericValue = (value: NumericInput) => {
  if (isBlank(value)) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const attemptAccuracyPercent = (
  successfulAttempts: number,
  totalAttempts: number,
) =>
  totalAttempts > 0
    ? Math.round((successfulAttempts / totalAttempts) * 100)
    : null;

export function validateManualSessionGoalProgress(
  input: ManualSessionGoalProgressValues,
): ManualSessionGoalProgressValidation {
  const errors: ManualSessionGoalProgressValidation["errors"] = {};
  const usesAttempts =
    !isBlank(input.successfulAttempts) || !isBlank(input.totalAttempts);
  let accuracyPercent = numericValue(input.accuracyPercent);
  const successfulAttempts = numericValue(input.successfulAttempts);
  const totalAttempts = numericValue(input.totalAttempts);

  if (usesAttempts) {
    if (isBlank(input.successfulAttempts)) {
      errors.successfulAttempts = "Enter the number of successful attempts.";
    } else if (
      successfulAttempts == null ||
      !Number.isFinite(successfulAttempts)
    ) {
      errors.successfulAttempts = "Successful attempts must be a number.";
    } else if (!Number.isInteger(successfulAttempts)) {
      errors.successfulAttempts = "Successful attempts must be a whole number.";
    } else if (successfulAttempts < 0) {
      errors.successfulAttempts = "Successful attempts cannot be negative.";
    }

    if (isBlank(input.totalAttempts)) {
      errors.totalAttempts = "Enter the total number of opportunities.";
    } else if (totalAttempts == null || !Number.isFinite(totalAttempts)) {
      errors.totalAttempts = "Total opportunities must be a number.";
    } else if (!Number.isInteger(totalAttempts)) {
      errors.totalAttempts = "Total opportunities must be a whole number.";
    } else if (totalAttempts < 0) {
      errors.totalAttempts = "Total opportunities cannot be negative.";
    } else if (totalAttempts === 0) {
      errors.totalAttempts =
        "Total opportunities must be greater than zero when tracking attempts.";
    }

    if (
      !errors.successfulAttempts &&
      !errors.totalAttempts &&
      successfulAttempts != null &&
      totalAttempts != null &&
      successfulAttempts > totalAttempts
    ) {
      errors.successfulAttempts =
        "Successful attempts cannot be greater than total opportunities.";
    }

    accuracyPercent =
      Object.keys(errors).length === 0 &&
      successfulAttempts != null &&
      totalAttempts != null
        ? attemptAccuracyPercent(successfulAttempts, totalAttempts)
        : null;
  } else if (!isBlank(input.accuracyPercent)) {
    if (accuracyPercent == null || !Number.isFinite(accuracyPercent)) {
      errors.accuracyPercent = "Accuracy must be a number.";
    } else if (!Number.isInteger(accuracyPercent)) {
      errors.accuracyPercent = "Accuracy must be a whole percentage.";
    } else if (accuracyPercent < 0 || accuracyPercent > 100) {
      errors.accuracyPercent = "Accuracy must be between 0 and 100 percent.";
    }
  }

  const hasProgressData =
    accuracyPercent != null ||
    usesAttempts ||
    Boolean(input.promptingLevel) ||
    Boolean(input.progressNote?.trim());
  if (!hasProgressData) {
    errors.progressNote =
      "Add at least one progress measure: accuracy, attempt data, prompting/support, or a progress note.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    usesAttempts,
    errors,
    values: {
      accuracyPercent:
        accuracyPercent != null && Number.isFinite(accuracyPercent)
          ? accuracyPercent
          : null,
      successfulAttempts:
        successfulAttempts != null && Number.isFinite(successfulAttempts)
          ? successfulAttempts
          : null,
      totalAttempts:
        totalAttempts != null && Number.isFinite(totalAttempts)
          ? totalAttempts
          : null,
    },
  };
}
