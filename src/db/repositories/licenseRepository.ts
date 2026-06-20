import { normalizeTier, type CommercialTier } from "../../lib/commercialTiers";
import { randomUuid } from "../../lib/ids";
import { validateLicenseKey, type LicenseStatus } from "../../lib/license";
import { getAppSetting, setAppSetting } from "./settingsRepository";

const licenseSettingKey = "commercialLicense";
const deviceSettingKey = "deviceIdentity";

type DeviceIdentity = {
  id: string;
  label: string;
  createdAt: string;
};

export async function getLicenseStatus() {
  const license = await getAppSetting<LicenseStatus>(licenseSettingKey);
  if (!license || license.status !== "active") return undefined;
  return {
    ...license,
    tier: normalizeTier(license.tier)
  };
}

export async function getLicensedTier(): Promise<CommercialTier> {
  const license = await getLicenseStatus();
  return license?.tier ?? "inactive";
}

export async function activateLicense(rawKey: string) {
  const device = await getOrCreateDeviceIdentity();
  const license = validateLicenseKey(rawKey, { id: device.id, label: device.label });
  if (!license) throw new Error("Kode lisensi tidak valid. Periksa kembali kode aktivasi DANAPETA.");
  await setAppSetting(licenseSettingKey, license);
  return license;
}

export async function clearLicense() {
  await setAppSetting(licenseSettingKey, undefined);
}

export async function getOrCreateDeviceIdentity() {
  const existing = await getAppSetting<DeviceIdentity>(deviceSettingKey);
  if (existing?.id && existing.label) return existing;

  const createdAt = new Date().toISOString();
  const device: DeviceIdentity = {
    id: randomUuid(),
    label: buildDeviceLabel(),
    createdAt
  };
  await setAppSetting(deviceSettingKey, device);
  return device;
}

function buildDeviceLabel() {
  const platform = navigator.platform || "Perangkat";
  return `${platform} - ${new Date().toLocaleDateString("id-ID")}`;
}
