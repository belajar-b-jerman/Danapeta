import Dexie, { type Table } from "dexie";
import type {
  Account,
  AppSetting,
  Asset,
  Budget,
  Category,
  Goal,
  ImportBatch,
  Insight,
  Liability,
  RecurringRule,
  Subcategory,
  Transaction
} from "./schema";

export class PlannerDatabase extends Dexie {
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  subcategories!: Table<Subcategory, string>;
  transactions!: Table<Transaction, string>;
  budgets!: Table<Budget, string>;
  goals!: Table<Goal, string>;
  assets!: Table<Asset, string>;
  liabilities!: Table<Liability, string>;
  recurringRules!: Table<RecurringRule, string>;
  insights!: Table<Insight, string>;
  importBatches!: Table<ImportBatch, string>;
  appSettings!: Table<AppSetting, string>;

  constructor() {
    super("planner_keuangan");
    this.version(1).stores({
      accounts: "id, type, isArchived, syncStatus",
      categories: "id, kind, sortOrder, isSystem",
      subcategories: "id, categoryId, [categoryId+name]",
      transactions: "id, date, accountId, categoryId, subcategoryId, type, merchant, amount, behavior, frequency, [date+categoryId], [accountId+date]",
      budgets: "id, period, categoryId, subcategoryId, [period+categoryId]",
      goals: "id, status, targetDate",
      recurringRules: "id, nextRunAt, status",
      insights: "id, period, severity, status",
      importBatches: "id, createdAt, status",
      appSettings: "key"
    });

    this.version(2).stores({
      accounts: "id, name, type, isArchived, syncStatus, [type+name]",
      categories: "id, kind, normalizedName, sortOrder, isSystem, isArchived, [kind+normalizedName]",
      subcategories: "id, categoryId, normalizedName, isArchived, [categoryId+normalizedName]",
      transactions: "id, date, accountId, categoryId, subcategoryId, type, merchant, amount, behavior, frequency, [date+categoryId], [accountId+date]",
      budgets: "id, period, categoryId, subcategoryId, [period+categoryId]",
      goals: "id, status, targetDate",
      recurringRules: "id, nextRunAt, status",
      insights: "id, period, severity, status",
      importBatches: "id, createdAt, status",
      appSettings: "key"
    });

    this.version(3).stores({
      accounts: "id, name, type, isArchived, syncStatus, [type+name]",
      categories: "id, kind, normalizedName, sortOrder, isSystem, isArchived, [kind+normalizedName]",
      subcategories: "id, categoryId, normalizedName, isArchived, [categoryId+normalizedName]",
      transactions: "id, date, accountId, transferAccountId, categoryId, subcategoryId, type, merchant, amount, behavior, frequency, [date+categoryId], [accountId+date]",
      budgets: "id, period, categoryId, subcategoryId, [period+categoryId]",
      goals: "id, status, targetDate",
      recurringRules: "id, nextRunAt, status",
      insights: "id, period, severity, status",
      importBatches: "id, createdAt, status",
      appSettings: "key"
    });

    this.version(4).stores({
      accounts: "id, name, type, isArchived, syncStatus, [type+name]",
      categories: "id, kind, normalizedName, sortOrder, isSystem, isArchived, [kind+normalizedName]",
      subcategories: "id, categoryId, normalizedName, isArchived, [categoryId+normalizedName]",
      transactions: "id, date, accountId, transferAccountId, goalId, categoryId, subcategoryId, type, merchant, amount, behavior, frequency, [date+categoryId], [accountId+date]",
      budgets: "id, period, categoryId, subcategoryId, [period+categoryId]",
      goals: "id, status, targetDate",
      assets: "id, type, linkedAccountId, linkedGoalId, isArchived, includeInNetWorth",
      liabilities: "id, type, linkedAccountId, linkedGoalId, isArchived, includeInNetWorth",
      recurringRules: "id, nextRunAt, status",
      insights: "id, period, severity, status",
      importBatches: "id, createdAt, status",
      appSettings: "key"
    });

    this.version(5).stores({
      accounts: "id, name, accountType, type, isArchived, syncStatus, [accountType+type], [type+name]",
      categories: "id, kind, normalizedName, sortOrder, isSystem, isArchived, [kind+normalizedName]",
      subcategories: "id, categoryId, normalizedName, isArchived, [categoryId+normalizedName]",
      transactions: "id, date, accountId, transferAccountId, goalId, categoryId, subcategoryId, type, merchant, amount, behavior, frequency, [date+categoryId], [accountId+date]",
      budgets: "id, period, categoryId, subcategoryId, [period+categoryId]",
      goals: "id, status, targetDate",
      assets: "id, type, linkedAccountId, linkedGoalId, isArchived, includeInNetWorth",
      liabilities: "id, type, linkedAccountId, linkedGoalId, isArchived, includeInNetWorth",
      recurringRules: "id, nextRunAt, status",
      insights: "id, period, severity, status",
      importBatches: "id, createdAt, status",
      appSettings: "key"
    });
  }
}

export const db = new PlannerDatabase();
