import { createId } from "../../lib/ids";
import { db } from "../client";
import type { Budget, Category, SpendingBehavior, Transaction } from "../schema";

export type BudgetWarningStatus = "healthy" | "watch" | "warning" | "critical";

export type BudgetSummary = Budget & {
  category?: Category;
  spent: number;
  effectiveLimit: number;
  remaining: number;
  percent: number;
  warningStatus: BudgetWarningStatus;
  warningMessage: string;
};

type CreateBudgetInput = Omit<Budget, "id" | "createdAt" | "updatedAt" | "syncStatus" | "version">;
type UpdateBudgetInput = Partial<Omit<Budget, "id" | "createdAt" | "syncStatus" | "version">>;

export async function listBudgets(period?: string) {
  const budgets = period ? await db.budgets.where("period").equals(period).toArray() : await db.budgets.toArray();
  return budgets.filter((budget) => !budget.deletedAt).sort((left, right) => left.name.localeCompare(right.name));
}

export async function listBudgetSummaries(period: string) {
  const [budgets, transactions, categories] = await Promise.all([
    listBudgets(period),
    db.transactions.where("date").startsWith(period).toArray(),
    db.categories.toArray()
  ]);
  const activeTransactions = transactions.filter((transaction) => !transaction.deletedAt);
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  return budgets.map((budget) => summarizeBudget(budget, activeTransactions, categoryMap.get(budget.categoryId)));
}

export async function createBudget(input: CreateBudgetInput) {
  const now = new Date().toISOString();
  const budget: Budget = {
    ...input,
    id: createId("budget"),
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    version: 1
  };

  await db.budgets.add(budget);
  return budget;
}

export async function updateBudget(id: string, input: UpdateBudgetInput) {
  const existing = await db.budgets.get(id);
  if (!existing) return undefined;

  const updated: Budget = {
    ...existing,
    ...input,
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: existing.version + 1
  };

  await db.budgets.put(updated);
  return updated;
}

export async function deleteBudget(id: string) {
  const existing = await db.budgets.get(id);
  if (!existing || existing.deletedAt) return;

  await db.budgets.update(id, {
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: existing.version + 1
  });
}

export const archiveBudget = deleteBudget;

export async function getExpenseBehaviorTotals(period: string) {
  const transactions = await db.transactions.where("date").startsWith(period).toArray();
  return transactions
    .filter((transaction) => transaction.type === "expense" && !transaction.deletedAt)
    .reduce<Record<SpendingBehavior | "unlabeled", number>>(
      (totals, transaction) => {
        const behavior = transaction.behavior ?? "unlabeled";
        totals[behavior] += transaction.amount;
        return totals;
      },
      { fixed: 0, variable: 0, planned: 0, impulse: 0, mandatory: 0, unlabeled: 0 }
    );
}

function summarizeBudget(budget: Budget, transactions: Transaction[], category?: Category): BudgetSummary {
  const spent = transactions
    .filter((transaction) => {
      if (transaction.type !== "expense") return false;
      if (transaction.categoryId !== budget.categoryId) return false;
      if (budget.subcategoryId && transaction.subcategoryId !== budget.subcategoryId) return false;
      return true;
    })
    .reduce((total, transaction) => total + transaction.amount, 0);
  const effectiveLimit = budget.limitAmount + (budget.rolloverEnabled ? budget.rolloverAmount : 0);
  const percent = effectiveLimit > 0 ? Math.round((spent / effectiveLimit) * 100) : 0;
  const warningStatus = getWarningStatus(percent, budget.alertThresholds);

  return {
    ...budget,
    category,
    spent,
    effectiveLimit,
    remaining: effectiveLimit - spent,
    percent,
    warningStatus,
    warningMessage: getWarningMessage(warningStatus, category?.name ?? budget.name)
  };
}

function getWarningStatus(percent: number, thresholds: number[]): BudgetWarningStatus {
  const warningThreshold = Math.round((thresholds[0] ?? 0.8) * 100);
  const criticalThreshold = Math.round((thresholds[1] ?? 1) * 100);
  if (percent >= criticalThreshold) return "critical";
  if (percent >= warningThreshold) return "warning";
  if (percent >= Math.max(60, warningThreshold - 15)) return "watch";
  return "healthy";
}

function getWarningMessage(status: BudgetWarningStatus, name: string) {
  if (status === "critical") return `${name} sudah melewati limit budget.`;
  if (status === "warning") return `${name} mendekati limit bulan ini.`;
  if (status === "watch") return `${name} perlu dipantau sampai akhir bulan.`;
  return `${name} masih dalam batas sehat.`;
}
