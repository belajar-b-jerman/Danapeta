import { normalizeTier, type CommercialTier } from "../../lib/commercialTiers";
import { getAppSetting, setAppSetting } from "./settingsRepository";
import { getLicensedTier } from "./licenseRepository";

const tierSettingKey = "commercialTier";

export async function getCommercialTier() {
  return getLicensedTier();
}

/**
 * Kept for internal/dev compatibility. Production access should come from a license.
 */
export async function setCommercialTier(tier: CommercialTier) {
  await setAppSetting(tierSettingKey, tier);
  return tier;
}
