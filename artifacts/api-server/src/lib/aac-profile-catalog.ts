export const aacSpecialOptionIds = ["other", "custom", "unknown"] as const;

export const aacProfileCatalog = {
  vendors: [
    { id: "tobii_dynavox", label: "Tobii Dynavox" },
    { id: "prc_saltillo", label: "PRC-Saltillo" },
    { id: "apple", label: "Apple" },
    { id: "smartbox", label: "Smartbox" },
    { id: "other", label: "Other" },
    { id: "custom", label: "Custom" },
    { id: "unknown", label: "Unknown" },
  ],
  deviceModels: [
    { id: "td_i_110", vendorId: "tobii_dynavox", label: "TD I-110" },
    { id: "td_pilot", vendorId: "tobii_dynavox", label: "TD Pilot" },
    { id: "accent_800", vendorId: "prc_saltillo", label: "Accent 800" },
    { id: "accent_1000", vendorId: "prc_saltillo", label: "Accent 1000" },
    { id: "via_pro", vendorId: "prc_saltillo", label: "Via Pro" },
    { id: "ipad", vendorId: "apple", label: "iPad" },
    { id: "grid_pad_13", vendorId: "smartbox", label: "Grid Pad 13" },
    { id: "other", vendorId: null, label: "Other" },
    { id: "custom", vendorId: null, label: "Custom" },
    { id: "unknown", vendorId: null, label: "Unknown" },
  ],
  vocabularySystems: [
    { id: "td_snap_core_first", label: "TD Snap Core First", vendorIds: ["tobii_dynavox"] },
    { id: "td_snap_motor_plan_60", label: "TD Snap Motor Plan 60", vendorIds: ["tobii_dynavox"] },
    { id: "lamp_words_for_life", label: "LAMP Words for Life", vendorIds: ["prc_saltillo", "apple"] },
    { id: "unity", label: "Unity", vendorIds: ["prc_saltillo"] },
    { id: "touchchat_wordpower", label: "TouchChat with WordPower", vendorIds: ["apple"] },
    { id: "proloquo2go", label: "Proloquo2Go", vendorIds: ["apple"] },
    { id: "grid_3", label: "Grid 3", vendorIds: ["smartbox"] },
    { id: "other", label: "Other", vendorIds: [] },
    { id: "custom", label: "Custom", vendorIds: [] },
    { id: "unknown", label: "Unknown", vendorIds: [] },
  ],
  accessMethods: [
    { id: "direct_touch", label: "Direct Touch" },
    { id: "eye_gaze", label: "Eye Gaze" },
    { id: "switch_scanning", label: "Switch Scanning" },
    { id: "head_tracking", label: "Head Tracking" },
    { id: "partner_assisted", label: "Partner-Assisted Scanning" },
    { id: "other", label: "Other" },
    { id: "custom", label: "Custom" },
    { id: "unknown", label: "Unknown" },
  ],
  ownershipOptions: [
    { id: "family_owned", label: "Family owned" },
    { id: "school_owned", label: "School owned" },
    { id: "clinic_owned", label: "Clinic owned" },
    { id: "loaned", label: "Loaned" },
    { id: "shared", label: "Shared across settings" },
    { id: "other", label: "Other" },
    { id: "custom", label: "Custom" },
    { id: "unknown", label: "Unknown" },
  ],
} as const;

const isSpecial = (id: string | null) =>
  Boolean(id && (aacSpecialOptionIds as readonly string[]).includes(id));

export const aacProfileCatalogError = ({
  deviceVendorId,
  deviceModelId,
  vocabularySystemId,
  accessMethodId,
  ownershipId,
}: {
  deviceVendorId: string | null;
  deviceModelId: string | null;
  vocabularySystemId: string | null;
  accessMethodId: string | null;
  ownershipId: string | null;
}) => {
  const vendor = aacProfileCatalog.vendors.find((item) => item.id === deviceVendorId);
  if (deviceVendorId && !vendor) return "Choose a valid device vendor.";
  const model = aacProfileCatalog.deviceModels.find((item) => item.id === deviceModelId);
  if (deviceModelId && !model) return "Choose a valid device model.";
  if (model && !isSpecial(model.id) && model.vendorId !== deviceVendorId) {
    return "Choose a device model that matches the selected vendor.";
  }
  const vocabulary = aacProfileCatalog.vocabularySystems.find((item) => item.id === vocabularySystemId);
  if (vocabularySystemId && !vocabulary) return "Choose a valid vocabulary system.";
  if (vocabulary && !isSpecial(vocabulary.id) && (
    !deviceVendorId || !(vocabulary.vendorIds as readonly string[]).includes(deviceVendorId)
  )) {
    return "Choose a vocabulary system available for the selected vendor.";
  }
  if (accessMethodId && !aacProfileCatalog.accessMethods.some((item) => item.id === accessMethodId)) {
    return "Choose a valid access method.";
  }
  if (ownershipId && !aacProfileCatalog.ownershipOptions.some((item) => item.id === ownershipId)) {
    return "Choose a valid ownership option.";
  }
  return null;
};

export const customLabelFor = (id: string | null, value: string | null | undefined) =>
  id === "other" || id === "custom" ? value?.trim() || null : null;