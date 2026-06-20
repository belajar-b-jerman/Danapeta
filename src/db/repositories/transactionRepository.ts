import { db } from "../client";
import type { Account, Transaction } from "../schema";
import { createId } from "../../lib/ids";
import { adjustAccountBalance } from "./accountRepository";
import { isLiabilityAccount } from "../../lib/accounts";

type CreateTransactionInput = Omit<Transaction, "id" | "createdAt" | "updatedAt" | "syncStatus" | "version">;
type UpdateTransactionInput = Partial<Omit<Transaction, "id" | "createdAt" | "syncStatus" | "version">>;

export type TransactionFilters = {
  search?: string;
  accountIds?: string[];
  categoryIds?: string[];
  behaviors?: Transaction["behavior"][];
  frequencies?: Transaction["frequency"][];
  type?: Transaction["type"] | "all";
  dateFrom?: string;
  dateTo?: string;
};

export async function createTransaction(input: CreateTransactionInput) {
  const now = new Date().toISOString();
  const transaction: Transaction = {
    ...input,
    id: createId("txn"),
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    version: 1
  };

  await db.transaction("rw", db.transactions, db.accounts, db.goals, async () => {
    await db.transactions.add(transaction);
    await applyTransactionBalance(transaction, 1);
    await applyGoalContribution(transaction, 1);
  });

  return transaction;
}

export async function listTransactionsByDate(limit = 50) {
  const transactions = await db.transactions.orderBy("date").reverse().toArray();
  return transactions.filter((transaction) => !transaction.deletedAt).slice(0, limit);
}

export async function listTransactions(filters: TransactionFilters = {}) {
  const transactions = await db.transactions.orderBy("date").reverse().toArray();
  const search = filters.search?.trim().toLowerCase();

  return transactions.filter((transaction) => {
    if (transaction.deletedAt) return false;
    if (filters.type && filters.type !== "all" && transaction.type !== filters.type) return false;
    if (filters.accountIds?.length && !filters.accountIds.includes(transaction.accountId)) return false;
    if (filters.categoryIds?.length && !filters.categoryIds.includes(transaction.categoryId)) return false;
    if (filters.behaviors?.length && (!transaction.behavior || !filters.behaviors.includes(transaction.behavior))) return false;
    if (filters.frequencies?.length && (!transaction.frequency || !filters.frequencies.includes(transaction.frequency))) return false;
    if (filters.dateFrom && transaction.date < filters.dateFrom) return false;
    if (filters.dateTo && transaction.date > filters.dateTo) return false;
    if (!search) return true;

    return [transaction.merchant, transaction.note, transaction.tags.join(" ")]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
}

export async function getTransaction(id: string) {
  return db.transactions.get(id);
}

export async function updateTransaction(id: string, input: UpdateTransactionInput) {
  const existing = await db.transactions.get(id);
  if (!existing) return undefined;

  const updated: Transaction = {
    ...existing,
    ...input,
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: existing.version + 1
  };

  await db.transaction("rw", db.transactions, db.accounts, db.goals, async () => {
    await applyTransactionBalance(existing, -1);
    await applyGoalContribution(existing, -1);
    await db.transactions.put(updated);
    await applyTransactionBalance(updated, 1);
    await applyGoalContribution(updated, 1);
  });

  return updated;
}

export async function deleteTransaction(id: string) {
  const existing = await db.transactions.get(id);
  if (!existing || existing.deletedAt) return;

  await db.transaction("rw", db.transactions, db.accounts, db.goals, db.recurringRules, async () => {
    await applyTransactionBalance(existing, -1);
    await applyGoalContribution(existing, -1);
    await endRecurringRulesForSourceTransaction(id);
    await db.transactions.update(id, {
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: "local",
      version: existing.version + 1
    });
  });
}

async function endRecurringRulesForSourceTransaction(transactionId: string) {
  const now = new Date().toISOString();
  const rules = await db.recurringRules.toArray();
  await Promise.all(
    rules
      .filter((rule) => !rule.deletedAt && rule.status === "active" && rule.sourceTransactionId === transactionId)
      .map((rule) =>
        db.recurringRules.update(rule.id, {
          status: "ended",
          deletedAt: now,
          updatedAt: now,
          syncStatus: "local",
          version: rule.version + 1
        })
      )
  );
}

async function applyGoalContribution(transaction: Transaction, direction: 1 | -1) {
  if (!transaction.goalId || transaction.deletedAt || !isRealMoneyGoalTransaction(transaction)) return;
  const goal = await db.goals.get(transaction.goalId);
  if (!goal || goal.deletedAt || goal.status === "archived") return;
  const nextAmount = Math.max(0, Math.min(goal.currentAmount + transaction.amount * direction, goal.targetAmount));
  await db.goals.update(goal.id, {
    currentAmount: nextAmount,
    status: nextAmount >= goal.targetAmount ? "completed" : goal.status === "completed" && nextAmount < goal.targetAmount ? "active" : goal.status,
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: goal.version + 1
  });
}

function isRealMoneyGoalTransaction(transaction: Transaction) {
  return (
    transaction.type === "transfer" &&
    (transaction.tags.includes("real-money") || transaction.tags.includes("goal-contribution") || transaction.tags.includes("debt-payment"))
  );
}

async function applyTransactionBalance(transaction: Transaction, direction: 1 | -1) {
  const account = await db.accounts.get(transaction.accountId);
  if (!account) return;

  if (transaction.type === "income") {
    await applyIncoming(account, transaction.amount, direction);
    return;
  }

  if (transaction.type === "expense") {
    await applyOutgoing(account, transaction.amount, direction);
    return;
  }

  if (transaction.type === "transfer" && transaction.transferAccountId) {
    const targetAccount = await db.accounts.get(transaction.transferAccountId);
    if (!targetAccount) return;
    await applyOutgoing(account, transaction.amount, direction);
    await applyIncoming(targetAccount, transaction.amount, direction);
    return;
  }

  if (transaction.type === "transfer" && transaction.goalId) {
    await applyOutgoing(account, transaction.amount, direction);
  }
}

async function applyIncoming(account: Account, amount: number, direction: 1 | -1) {
  const delta = isLiabilityAccount(account) ? -amount * direction : amount * direction;
  await adjustAccountBalance(account.id, delta);
}

async function applyOutgoing(account: Account, amount: number, direction: 1 | -1) {
  const delta = isLiabilityAccount(account) ? amount * direction : -amount * direction;
  await adjustAccountBalance(account.id, delta);
}
