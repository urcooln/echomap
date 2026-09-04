import assert from "node:assert/strict";
import test from "node:test";
import {
  aacProfileCatalog,
  aacProfileCatalogError,
  customLabelFor,
} from "../src/lib/aac-profile-catalog";

const selection = {
  deviceVendorId: "tobii_dynavox",
  deviceModelId: "td_i_110",
  vocabularySystemId: "td_snap_motor_plan_60",
  accessMethodId: "direct_touch",
  ownershipId: "family_owned",
};

test("accepts a compatible vendor, model, and vocabulary selection", () => {
  assert.equal(aacProfileCatalogError(selection), null);
});

test("rejects a model owned by a different vendor", () => {
  assert.match(
    aacProfileCatalogError({ ...selection, deviceModelId: "ipad" }) ?? "",
    /matches the selected vendor/,
  );
});

test("rejects a vocabulary system unavailable for the selected vendor", () => {
  assert.match(
    aacProfileCatalogError({ ...selection, vocabularySystemId: "lamp_words_for_life" }) ?? "",
    /available for the selected vendor/,
  );
});

test("keeps special choices available without inventing catalog relationships", () => {
  assert.equal(aacProfileCatalogError({
    ...selection,
    deviceVendorId: "custom",
    deviceModelId: "other",
    vocabularySystemId: "unknown",
  }), null);
  assert.ok(aacProfileCatalog.deviceModels.some((item) => item.id === "unknown"));
});

test("preserves custom labels only for custom and other selections", () => {
  assert.equal(customLabelFor("custom", "  School loaner  "), "School loaner");
  assert.equal(customLabelFor("other", "  Partner board  "), "Partner board");
  assert.equal(customLabelFor("unknown", "Not sure"), null);
  assert.equal(customLabelFor("td_i_110", "Incorrect override"), null);
});