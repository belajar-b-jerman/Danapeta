import type { PlanningProfile } from "../db/schema";

export type EmergencyFundGuideline = {
  minimumMonths: number;
  idealMonths: number;
  label: string;
};

export function emergencyFundGuideline(profile?: PlanningProfile): EmergencyFundGuideline {
  const isMarried = profile?.maritalStatus === "married";
  const hasChildrenOrDependents = (profile?.dependentsCount ?? 0) > 0;
  if (isMarried && hasChildrenOrDependents) return { minimumMonths: 9, idealMonths: 12, label: "menikah dengan anak/tanggungan" };
  if (isMarried) return { minimumMonths: 6, idealMonths: 9, label: "menikah tanpa anak/tanggungan" };
  return { minimumMonths: 3, idealMonths: 6, label: "lajang/tanpa tanggungan" };
}
