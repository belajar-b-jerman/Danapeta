import { getAppSetting, setAppSetting } from "./settingsRepository";
import type { PlanningProfile } from "../schema";

const planningProfileKey = "planningProfile";

export const defaultPlanningProfile: PlanningProfile = {
  currentAge: 30,
  maritalStatus: "single",
  dependentsCount: 0,
  retirementTargetAge: 60,
  riskProfile: "moderate"
};

export async function getPlanningProfile() {
  const stored = await getAppSetting<Partial<PlanningProfile>>(planningProfileKey);
  return normalizePlanningProfile(stored);
}

export async function savePlanningProfile(input: Partial<PlanningProfile>) {
  const profile = normalizePlanningProfile(input);
  await setAppSetting(planningProfileKey, profile);
  return profile;
}

function normalizePlanningProfile(input?: Partial<PlanningProfile>): PlanningProfile {
  const merged = { ...defaultPlanningProfile, ...input };
  return {
    currentAge: clampInteger(merged.currentAge, 0, 100, defaultPlanningProfile.currentAge),
    maritalStatus: merged.maritalStatus ?? defaultPlanningProfile.maritalStatus,
    dependentsCount: clampInteger(merged.dependentsCount, 0, 12, defaultPlanningProfile.dependentsCount),
    retirementTargetAge: clampInteger(merged.retirementTargetAge, 40, 85, defaultPlanningProfile.retirementTargetAge),
    riskProfile: merged.riskProfile ?? defaultPlanningProfile.riskProfile
  };
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value ?? fallback)));
}
