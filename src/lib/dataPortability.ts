import { db } from "../db/client";
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
} from "../db/schema";

export type PlannerBackup = {
  app: "danapeta" | "uang-planner";
  schemaVersion: 1 | 2;
  exportedAt: string;
  tables: {
    accounts: Account[];
    categories: Category[];
    subcategories: Subcategory[];
    transactions: Transaction[];
    budgets: Budget[];
    goals: Goal[];
    assets?: Asset[];
    liabilities?: Liability[];
    recurringRules: RecurringRule[];
    insights: Insight[];
    importBatches: ImportBatch[];
    appSettings: AppSetting[];
  };
};

export async function createPlannerBackup(): Promise<PlannerBackup> {
  const [
    accounts,
    categories,
    subcategories,
    transactions,
    budgets,
    goals,
    assets,
    liabilities,
    recurringRules,
    insights,
    importBatches,
    appSettings
  ] = await Promise.all([
    db.accounts.toArray(),
    db.categories.toArray(),
    db.subcategories.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    db.goals.toArray(),
    db.assets.toArray(),
    db.liabilities.toArray(),
    db.recurringRules.toArray(),
    db.insights.toArray(),
    db.importBatches.toArray(),
    db.appSettings.toArray()
  ]);

  return {
    app: "danapeta",
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    tables: {
      accounts,
      categories,
      subcategories,
      transactions,
      budgets,
      goals,
      assets,
      liabilities,
      recurringRules,
      insights,
      importBatches,
      appSettings: sanitizePortableAppSettings(appSettings)
    }
  };
}

export function downloadJsonBackup(backup: PlannerBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `danapeta-backup-${backup.exportedAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parsePlannerBackup(raw: string): PlannerBackup {
  const parsed = JSON.parse(raw) as PlannerBackup;
  if (!["danapeta", "uang-planner"].includes(parsed.app) || ![1, 2].includes(parsed.schemaVersion) || !parsed.tables) {
    throw new Error("File ini bukan backup DANAPETA yang valid.");
  }
  validateBackupTables(parsed);
  return normalizeBackup(parsed);
}

export async function restorePlannerBackup(backup: PlannerBackup) {
  const preservedAppSettings = sanitizePreservedAppSettings(await db.appSettings.toArray());
  const tables = [
    db.accounts,
    db.categories,
    db.subcategories,
    db.transactions,
    db.budgets,
    db.goals,
    db.assets,
    db.liabilities,
    db.recurringRules,
    db.insights,
    db.importBatches,
    db.appSettings
  ];

  await db.transaction(
    "rw",
    tables,
    async () => {
      await db.accounts.clear();
      await db.categories.clear();
      await db.subcategories.clear();
      await db.transactions.clear();
      await db.budgets.clear();
      await db.goals.clear();
      await db.assets.clear();
      await db.liabilities.clear();
      await db.recurringRules.clear();
      await db.insights.clear();
      await db.importBatches.clear();
      await db.appSettings.clear();

      await Promise.all([
        db.accounts.bulkPut(backup.tables.accounts),
        db.categories.bulkPut(backup.tables.categories),
        db.subcategories.bulkPut(backup.tables.subcategories),
        db.transactions.bulkPut(backup.tables.transactions),
        db.budgets.bulkPut(backup.tables.budgets),
        db.goals.bulkPut(backup.tables.goals),
        db.assets.bulkPut(backup.tables.assets ?? []),
        db.liabilities.bulkPut(backup.tables.liabilities ?? []),
        db.recurringRules.bulkPut(backup.tables.recurringRules),
        db.insights.bulkPut(backup.tables.insights),
        db.importBatches.bulkPut(backup.tables.importBatches),
        db.appSettings.bulkPut([...sanitizePortableAppSettings(backup.tables.appSettings), ...preservedAppSettings])
      ]);
    }
  );
}

export async function resetPlannerData() {
  const preservedAppSettings = sanitizePreservedAppSettings(await db.appSettings.toArray());
  const preservedUiSettings = (await db.appSettings.toArray()).filter((setting) => ["theme", "hasCompletedOnboarding"].includes(setting.key));

  await db.transaction(
    "rw",
    [
      db.accounts,
      db.categories,
      db.subcategories,
      db.transactions,
      db.budgets,
      db.goals,
      db.assets,
      db.liabilities,
      db.recurringRules,
      db.insights,
      db.importBatches,
      db.appSettings
    ],
    async () => {
      await db.accounts.clear();
      await db.categories.clear();
      await db.subcategories.clear();
      await db.transactions.clear();
      await db.budgets.clear();
      await db.goals.clear();
      await db.assets.clear();
      await db.liabilities.clear();
      await db.recurringRules.clear();
      await db.insights.clear();
      await db.importBatches.clear();
      await db.appSettings.clear();
      await db.appSettings.bulkPut([...preservedUiSettings, ...preservedAppSettings]);
    }
  );
}

function validateBackupTables(backup: PlannerBackup) {
  const requiredTables: Array<keyof PlannerBackup["tables"]> = [
    "accounts",
    "categories",
    "subcategories",
    "transactions",
    "budgets",
    "goals",
    "recurringRules",
    "insights",
    "importBatches",
    "appSettings"
  ];

  requiredTables.forEach((table) => {
    if (!Array.isArray(backup.tables[table])) {
      throw new Error(`Backup table "${table}" is missing or invalid.`);
    }
  });
}

function normalizeBackup(backup: PlannerBackup): PlannerBackup {
  return {
    ...backup,
    app: "danapeta",
    schemaVersion: backup.schemaVersion === 1 ? 2 : backup.schemaVersion,
    tables: {
      ...backup.tables,
      assets: backup.tables.assets ?? [],
      liabilities: backup.tables.liabilities ?? []
    }
  };
}

function sanitizePortableAppSettings(settings: AppSetting[]) {
  const blockedKeys = new Set(["commercialLicense", "commercialTier", "deviceIdentity"]);
  return settings.filter((setting) => !blockedKeys.has(setting.key));
}

function sanitizePreservedAppSettings(settings: AppSetting[]) {
  const preservedKeys = new Set(["commercialLicense", "deviceIdentity"]);
  return settings.filter((setting) => preservedKeys.has(setting.key) && setting.value !== undefined);
}
