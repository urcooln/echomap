export const COMMUNICATION_FUNCTION_OPTIONS = [
  "Connection",
  "Request",
  "Requesting",
  "Help",
  "Protest",
  "Comment",
  "Commenting",
  "Social Interaction",
  "Self-regulation",
  "Self-Regulation",
  "Regulation",
  "Transition",
  "Surprises",
  "Shared Joy",
  "Joint Action Routines",
  "Sensory-Motor Experiences",
  "New Situations",
  "Self-Advocacy",
  "Unknown",
  "Other",
] as const;

export type CommunicationFunctionOption =
  (typeof COMMUNICATION_FUNCTION_OPTIONS)[number];

const otherCommunicationFunctionPattern = /^Other(?:\s*:\s*(.+))?$/i;

export const communicationFunctionSelection = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  return otherCommunicationFunctionPattern.test(trimmed) ? "Other" : trimmed;
};

export const communicationFunctionOtherDescription = (value?: string | null) =>
  value?.trim().match(otherCommunicationFunctionPattern)?.[1]?.trim() ?? "";

export const formatCommunicationFunction = (
  selection: string,
  otherDescription?: string,
) => {
  const trimmedSelection = selection.trim();
  if (trimmedSelection !== "Other") return trimmedSelection;
  const description = otherDescription?.trim();
  return description ? `Other: ${description}` : "Other";
};

export const isSupportedCommunicationFunction = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 && trimmed.length <= 160;
};

export const communicationFunctionMatches = (
  storedValue: string,
  selectedFilter: string,
) =>
  selectedFilter === "Other"
    ? communicationFunctionSelection(storedValue) === "Other"
    : storedValue === selectedFilter;

export const communicationFunctionOptionsWithStoredValues = (
  storedValues: Iterable<string | null | undefined>,
) => {
  const options = [...COMMUNICATION_FUNCTION_OPTIONS] as string[];
  const known = new Set(options);
  for (const storedValue of storedValues) {
    const selection = communicationFunctionSelection(storedValue);
    if (selection && !known.has(selection)) {
      known.add(selection);
      options.push(selection);
    }
  }
  return options;
};
