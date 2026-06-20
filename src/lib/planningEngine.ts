import type { Goal, PlanningProfile } from "../db/schema";

export type ProjectionStatus = "on_track" | "watch" | "behind" | "unfunded" | "complete";

export type GoalProjection = {
  remaining: number;
  progressPercent: number;
  monthsLeft?: number;
  annualReturn: number;
  requiredMonthlyContribution?: number;
  fundingGap: number;
  estimatedFutureValue: number;
  projectedCompletionDate?: string;
  projectedCompletionLabel: string;
  feasibilityStatus: ProjectionStatus;
  feasibilityLabel: string;
  logic: string;
};

export function projectGoal(goal: Goal, profile?: PlanningProfile, referenceDate = new Date()): GoalProjection {
  const targetAmount = Math.max(goal.targetAmount, 0);
  const currentAmount = Math.max(goal.currentAmount, 0);
  const monthlyContribution = Math.max(goal.monthlyContribution ?? 0, 0);
  const annualReturn = annualReturnForGoal(goal, profile);
  const monthsLeft = goal.targetDate ? getMonthsLeft(goal.targetDate, referenceDate) : undefined;
  const remaining = Math.max(targetAmount - currentAmount, 0);
  const progressPercent = targetAmount > 0 ? Math.min(Math.round((currentAmount / targetAmount) * 100), 100) : 0;
  const estimatedFutureValue = monthsLeft === undefined ? estimateFutureValue(currentAmount, monthlyContribution, 120, annualReturn) : estimateFutureValue(currentAmount, monthlyContribution, monthsLeft, annualReturn);
  const requiredMonthlyContribution =
    monthsLeft !== undefined && monthsLeft > 0 ? Math.ceil(requiredMonthlyPayment(currentAmount, targetAmount, monthsLeft, annualReturn)) : undefined;
  const projectedCompletion = estimateCompletion(currentAmount, targetAmount, monthlyContribution, annualReturn, referenceDate);
  const fundingGap = Math.max(targetAmount - estimatedFutureValue, 0);
  const feasibilityStatus = getFeasibilityStatus({
    remaining,
    monthlyContribution,
    requiredMonthlyContribution,
    monthsLeft,
    fundingGap
  });

  return {
    remaining,
    progressPercent,
    monthsLeft,
    annualReturn,
    requiredMonthlyContribution,
    fundingGap,
    estimatedFutureValue: Math.round(estimatedFutureValue),
    projectedCompletionDate: projectedCompletion.date,
    projectedCompletionLabel: projectedCompletion.label,
    feasibilityStatus,
    feasibilityLabel: feasibilityLabel(feasibilityStatus),
    logic: "FV = current x (1+r)^n + contribution x (((1+r)^n - 1) / r); required monthly solves the same formula against target amount."
  };
}

export function recommendedReturnForRisk(riskProfile: PlanningProfile["riskProfile"]) {
  if (riskProfile === "conservative") return 3;
  if (riskProfile === "aggressive") return 8;
  return 5;
}

export function defaultReturnForGoal(goalType: Goal["type"], profile?: PlanningProfile) {
  if (goalType === "retirement" || goalType === "investment") return recommendedReturnForRisk(profile?.riskProfile ?? "moderate");
  if (goalType === "education") return 4;
  if (goalType === "house_purchase" || goalType === "vehicle") return 2;
  if (goalType === "emergency_fund") return 2;
  if (goalType === "savings" || goalType === "custom" || goalType === "custom_future") return 3;
  return 0;
}

export function isFuturePlanningGoal(goal: Goal) {
  return ["house_purchase", "retirement", "education", "vehicle", "custom_future", "investment", "custom"].includes(goal.type);
}

export function formatRemainingTime(monthsLeft: number | undefined) {
  if (monthsLeft === undefined) return "Tanpa tenggat";
  if (monthsLeft <= 0) return "Tenggat hari ini atau sudah lewat";
  if (monthsLeft < 1) return `${Math.ceil(monthsLeft * averageDaysPerMonth)} hari lagi`;
  return `${monthsLeft.toLocaleString("id-ID", { maximumFractionDigits: 1 })} bulan lagi`;
}

function annualReturnForGoal(goal: Goal, profile?: PlanningProfile) {
  if (Number.isFinite(goal.expectedAnnualReturn) && (goal.expectedAnnualReturn ?? 0) > 0) {
    return Math.max(goal.expectedAnnualReturn ?? 0, 0);
  }
  return defaultReturnForGoal(goal.type, profile);
}

function getFeasibilityStatus(input: {
  remaining: number;
  monthlyContribution: number;
  requiredMonthlyContribution?: number;
  monthsLeft?: number;
  fundingGap: number;
}): ProjectionStatus {
  if (input.remaining <= 0) return "complete";
  if (!input.monthlyContribution) return "unfunded";
  if (!input.monthsLeft || !input.requiredMonthlyContribution) return input.monthlyContribution > 0 ? "watch" : "unfunded";
  if (input.monthlyContribution >= input.requiredMonthlyContribution) return "on_track";
  if (input.monthlyContribution >= input.requiredMonthlyContribution * 0.75 || input.fundingGap <= input.requiredMonthlyContribution * 2) return "watch";
  return "behind";
}

function feasibilityLabel(status: ProjectionStatus) {
  const labels: Record<ProjectionStatus, string> = {
    complete: "Sudah tercapai",
    on_track: "Layak sesuai rencana",
    watch: "Masih perlu dipantau",
    behind: "Butuh penyesuaian",
    unfunded: "Belum terdanai"
  };
  return labels[status];
}

function requiredMonthlyPayment(currentAmount: number, targetAmount: number, months: number, annualReturn: number) {
  const monthlyRate = annualReturnToMonthlyRate(annualReturn);
  const currentAtTarget = currentAmount * Math.pow(1 + monthlyRate, months);
  const remainingAtTarget = Math.max(targetAmount - currentAtTarget, 0);
  if (remainingAtTarget <= 0) return 0;
  if (monthlyRate <= 0) return remainingAtTarget / months;
  const growthFactor = (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
  return remainingAtTarget / growthFactor;
}

function estimateFutureValue(currentAmount: number, monthlyContribution: number, months: number, annualReturn: number) {
  const monthlyRate = annualReturnToMonthlyRate(annualReturn);
  if (monthlyRate <= 0) return currentAmount + monthlyContribution * months;
  return currentAmount * Math.pow(1 + monthlyRate, months) + monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

function estimateCompletion(currentAmount: number, targetAmount: number, monthlyContribution: number, annualReturn: number, referenceDate: Date) {
  if (targetAmount <= 0 || currentAmount >= targetAmount) {
    return { date: toDateInputValue(referenceDate), label: "Sudah tercapai" };
  }

  const monthlyRate = annualReturnToMonthlyRate(annualReturn);
  if (monthlyContribution <= 0 && monthlyRate <= 0) return { label: "Belum bisa diproyeksikan" };

  let previousAmount = currentAmount;
  let amount = currentAmount;
  for (let month = 1; month <= 600; month += 1) {
    amount = amount * (1 + monthlyRate) + monthlyContribution;
    if (amount >= targetAmount) {
      const monthProgress = amount === previousAmount ? 1 : (targetAmount - previousAmount) / (amount - previousAmount);
      const monthsNeeded = month - 1 + Math.max(0, Math.min(monthProgress, 1));
      const completionDate = addFractionalMonths(referenceDate, monthsNeeded);
      return {
        date: toDateInputValue(completionDate),
        label: completionDate.toLocaleDateString("id-ID", { month: "short", year: "numeric" })
      };
    }
    previousAmount = amount;
  }

  return { label: "Lebih dari 50 tahun" };
}

function annualReturnToMonthlyRate(annualReturn: number) {
  return Math.pow(1 + Math.max(annualReturn, 0) / 100, 1 / 12) - 1;
}

function getMonthsLeft(targetDate: string, referenceDate: Date) {
  const target = parseLocalDate(targetDate);
  if (Number.isNaN(target.getTime())) return undefined;
  const today = startOfLocalDay(referenceDate);
  const daysLeft = (target.getTime() - today.getTime()) / millisecondsPerDay;
  return Math.max(Number((daysLeft / averageDaysPerMonth).toFixed(1)), 0);
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addFractionalMonths(date: Date, months: number) {
  const wholeMonths = Math.floor(months);
  const fractionalDays = Math.round((months - wholeMonths) * averageDaysPerMonth);
  const next = new Date(date.getFullYear(), date.getMonth() + wholeMonths, date.getDate());
  next.setDate(next.getDate() + fractionalDays);
  return next;
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const averageDaysPerMonth = 365.2425 / 12;
