import { createId } from "../../lib/ids";
import { getAccountType } from "../../lib/accounts";
import { formatRemainingTime, projectGoal } from "../../lib/planningEngine";
import { getOrCreateCategory, getOrCreateSubcategory } from "./categoryRepository";
import { getPlanningProfile } from "./planningProfileRepository";
import { createTransaction } from "./transactionRepository";
import { db } from "../client";
import type { Goal } from "../schema";

export type GoalSummary = Goal & {
  percent: number;
  remaining: number;
  monthsLeft?: number;
  remainingTimeLabel: string;
  requiredMonthlyContribution?: number;
  fundingGap: number;
  estimatedFutureValue: number;
  assumedAnnualReturn: number;
  projectedCompletionDate?: string;
  projectedCompletionLabel: string;
  deadlineStatus: "on_track" | "watch" | "behind" | "open";
  feasibilityStatus: "on_track" | "watch" | "behind" | "unfunded" | "complete";
  feasibilityLabel: string;
  projectionLogic: string;
};

type CreateGoalInput = Omit<Goal, "id" | "createdAt" | "updatedAt" | "syncStatus" | "version" | "status">;
type UpdateGoalInput = Partial<Omit<Goal, "id" | "createdAt" | "syncStatus" | "version">>;
export type GoalContributionMode = "real_transaction" | "manual_progress";

export async function listGoals() {
  const goals = await db.goals.toArray();
  return goals.filter((goal) => !goal.deletedAt && goal.status !== "archived").sort(sortGoals);
}

export async function listGoalSummaries() {
  const goals = await listGoals();
  const profile = await getPlanningProfile();
  return goals.map((goal) => summarizeGoal(goal, profile));
}

export async function createGoal(input: CreateGoalInput) {
  const now = new Date().toISOString();
  const goal: Goal = {
    ...normalizeGoalInput(input),
    id: createId("goal"),
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    version: 1,
    status: "active"
  };

  await db.goals.add(goal);
  return goal;
}

export async function updateGoal(id: string, input: UpdateGoalInput) {
  const existing = await db.goals.get(id);
  if (!existing) return undefined;

  const updated: Goal = {
    ...existing,
    ...normalizeGoalInput(input),
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: existing.version + 1
  };

  await db.goals.put(updated);
  return updated;
}

export async function addGoalContribution(
  id: string,
  input: { amount: number; mode: GoalContributionMode; sourceAccountId?: string; targetLiabilityAccountId?: string; note?: string }
) {
  const existing = await db.goals.get(id);
  if (!existing) return undefined;
  const amount = Math.abs(input.amount);
  if (amount <= 0) return existing;
  const nextAmount = Math.max(0, Math.min(existing.currentAmount + amount, existing.targetAmount));

  if (input.mode === "real_transaction") {
    if (!input.sourceAccountId) throw new Error("Source account is required for real money contributions.");
    const sourceAccount = await db.accounts.get(input.sourceAccountId);
    if (!sourceAccount || sourceAccount.deletedAt || sourceAccount.isArchived) {
      throw new Error("Source account is not available.");
    }
    const linkedLiabilityAccountId = input.targetLiabilityAccountId || (existing.type === "debt_payoff" ? existing.linkedAccountId : undefined);
    const targetLiabilityAccount = linkedLiabilityAccountId ? await db.accounts.get(linkedLiabilityAccountId) : undefined;
    if (linkedLiabilityAccountId && (!targetLiabilityAccount || getAccountType(targetLiabilityAccount) !== "liability")) {
      throw new Error("Linked liability account is not available.");
    }
    const category = await getOrCreateCategory({
      name: "Transfer",
      kind: "transfer",
      defaultBehavior: "planned",
      budgetGroup: "flexible",
      icon: "repeat"
    });
    const subcategory = await getOrCreateSubcategory({
      categoryId: category.id,
      name: existing.type === "debt_payoff" ? "Debt Payment" : "Goal Contribution",
      defaultBehavior: "planned"
    });

    await createTransaction({
      type: "transfer",
      accountId: sourceAccount.id,
      transferAccountId: targetLiabilityAccount?.id,
      goalId: existing.id,
      categoryId: category.id,
      subcategoryId: subcategory.id,
      amount,
      currency: "IDR",
      date: new Date().toISOString().slice(0, 10),
      merchant: existing.name,
      note: input.note?.trim() || `Kontribusi tujuan: ${existing.name}`,
      tags: [existing.type === "debt_payoff" ? "debt-payment" : "goal-contribution", "real-money"],
      behavior: "planned",
      frequency: "non_routine",
      source: "adjustment"
    });

    return db.goals.get(id);
  }

  return updateGoal(id, {
    currentAmount: nextAmount,
    status: nextAmount >= existing.targetAmount ? "completed" : existing.status
  });
}

export async function archiveGoal(id: string) {
  const existing = await db.goals.get(id);
  if (!existing || existing.deletedAt) return;
  await updateGoal(id, { status: "archived" });
}

function summarizeGoal(goal: Goal, profile: Awaited<ReturnType<typeof getPlanningProfile>>): GoalSummary {
  const projection = projectGoal(goal, profile);
  const expectedAnnualReturn = projection.annualReturn;
  const deadlineStatus = getDeadlineStatus(goal.monthlyContribution, projection.requiredMonthlyContribution, projection.monthsLeft, projection.remaining);

  return {
    ...goal,
    expectedAnnualReturn,
    percent: projection.progressPercent,
    remaining: projection.remaining,
    monthsLeft: projection.monthsLeft,
    remainingTimeLabel: formatRemainingTime(projection.monthsLeft),
    requiredMonthlyContribution: projection.requiredMonthlyContribution,
    fundingGap: projection.fundingGap,
    estimatedFutureValue: projection.estimatedFutureValue,
    assumedAnnualReturn: projection.annualReturn,
    projectedCompletionDate: projection.projectedCompletionDate,
    projectedCompletionLabel: projection.projectedCompletionLabel,
    deadlineStatus,
    feasibilityStatus: projection.feasibilityStatus,
    feasibilityLabel: projection.feasibilityLabel,
    projectionLogic: projection.logic
  };
}

function normalizeGoalInput<T extends Partial<CreateGoalInput | UpdateGoalInput>>(input: T): T {
  if (input.type && !["savings", "emergency_fund", "investment", "retirement", "education", "house_purchase", "vehicle", "custom_future", "custom"].includes(input.type)) {
    return { ...input, expectedAnnualReturn: 0 };
  }
  return input;
}

function getDeadlineStatus(
  monthlyContribution: number | undefined,
  requiredMonthlyContribution: number | undefined,
  monthsLeft: number | undefined,
  remaining: number
): GoalSummary["deadlineStatus"] {
  if (remaining <= 0) return "on_track";
  if (!monthsLeft || !requiredMonthlyContribution) return "open";
  if (!monthlyContribution || monthlyContribution < requiredMonthlyContribution * 0.75) return "behind";
  if (monthlyContribution < requiredMonthlyContribution) return "watch";
  return "on_track";
}

function sortGoals(left: Goal, right: Goal) {
  if (left.status !== right.status) return left.status === "active" ? -1 : 1;
  return (left.targetDate ?? "9999-12-31").localeCompare(right.targetDate ?? "9999-12-31");
}
