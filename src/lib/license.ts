import type { CommercialTier } from "./commercialTiers";

export type LicenseStatus = {
  tier: CommercialTier;
  status: "active";
  activatedAt: string;
  licenseKeyPreview: string;
  deviceId: string;
  deviceLabel: string;
  deviceLimit: number;
};

const licensePatterns: Array<{ tier: CommercialTier; pattern: RegExp }> = [
  { tier: "elite", pattern: /^DANAPETA-ELITE(?:-[A-Z0-9]{4,}){0,3}$/ },
  { tier: "pro", pattern: /^DANAPETA-PRO(?:-[A-Z0-9]{4,}){0,3}$/ },
  { tier: "basic", pattern: /^DANAPETA-BASIC(?:-[A-Z0-9]{4,}){0,3}$/ }
];

export function validateLicenseKey(rawKey: string, device: { id: string; label: string }): LicenseStatus | undefined {
  const normalized = normalizeLicenseKey(rawKey);
  const match = licensePatterns.find((item) => item.pattern.test(normalized));
  if (!match) return undefined;

  return {
    tier: match.tier,
    status: "active",
    activatedAt: new Date().toISOString(),
    licenseKeyPreview: previewLicenseKey(normalized),
    deviceId: device.id,
    deviceLabel: device.label,
    deviceLimit: 1
  };
}

export function normalizeLicenseKey(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-").replace(/-+/g, "-");
}

function previewLicenseKey(value: string) {
  if (value.length <= 12) return value;
  return `${value.slice(0, 12)}...${value.slice(-4)}`;
}
