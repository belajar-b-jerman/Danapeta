import { createId } from "../../lib/ids";
import { db } from "../client";
import type { RecurringRule, Transaction } from "../schema";
import { createTransaction } from "./transactionRepository";

type CreateRecurringRuleInput = Omit<RecurringRule, "id" | "createdAt" | "updatedAt" | "syncStatus" | "version" | "lastRunAt" | "status">;

export async function createRecurringRule(input: CreateRecurringRuleInput) {
  const now = new Date().toISOString();
  const rule: RecurringRule = {
    ...input,
    id: createId("recur"),
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    version: 1,
    status: "active"
  };

  await db.recurringRules.add(rule);
  return rule;
}

export async function listRecurringRules() {
  const [rules, transactions] = await Promise.all([db.recurringRules.where("status").equals("active").toArray(), db.transactions.toArray()]);
  const activeTransactions = transactions.filter((transaction) => !transaction.deletedAt);
  return rules.filter((rule) => {
    if (rule.deletedAt) return false;
    if (rule.sourceTransactionId) {
      return activeTransactions.some((transaction) => transaction.id === rule.sourceTransactionId);
    }
    return activeTransactions.some((transaction) => isRuleSourceTransaction(rule, transaction));
  });
}

export async function runDueRecurringTransactions(referenceDate = new Date()) {
  const today = referenceDate.toISOString().slice(0, 10);
  const rules = await listRecurringRules();
  const dueRules = rules.filter((rule) => rule.nextRunAt <= today);

  for (const rule of dueRules) {
    await createTransaction({
      ...rule.transactionTemplate,
      date: rule.nextRunAt,
      source: "recurring"
    } as Omit<Transaction, "id" | "createdAt" | "updatedAt" | "syncStatus" | "version">);

    await db.recurringRules.update(rule.id, {
      lastRunAt: rule.nextRunAt,
      nextRunAt: getNextRunAt(rule.nextRunAt, rule.frequency, rule.interval),
      updatedAt: new Date().toISOString(),
      version: rule.version + 1
    });
  }
}

function getNextRunAt(dateValue: string, frequency: RecurringRule["frequency"], interval: number) {
  const date = new Date(`${dateValue}T00:00:00`);

  if (frequency === "daily") date.setDate(date.getDate() + interval);
  if (frequency === "weekly") date.setDate(date.getDate() + interval * 7);
  if (frequency === "monthly") date.setMonth(date.getMonth() + interval);
  if (frequency === "yearly") date.setFullYear(date.getFullYear() + interval);

  return date.toISOString().slice(0, 10);
}

export function isRuleSourceTransaction(rule: RecurringRule, transaction: Transaction) {
  const template = rule.transactionTemplate;
  return (
    transaction.source === "manual" &&
    transaction.type === template.type &&
    transaction.accountId === template.accountId &&
    transaction.transferAccountId === template.transferAccountId &&
    transaction.categoryId === template.categoryId &&
    transaction.subcategoryId === template.subcategoryId &&
    transaction.amount === template.amount &&
    transaction.merchant === template.merchant
  );
}
