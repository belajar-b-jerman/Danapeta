import { db } from "../client";
import type { Account, Category, Subcategory, Transaction } from "../schema";
import {
  findCategoryByName,
  findSubcategoryByName,
  getOrCreateCategory,
  getOrCreateSubcategory
} from "../repositories/categoryRepository";
import { normalizeCategoryName, normalizeSubcategoryName } from "../../lib/categoryRegistry";
import { getAccountType, normalizeStoredAccountBalance } from "../../lib/accounts";

const DATA_FOUNDATION_VERSION = 4;

export async function runDataFoundationMigrations() {
  const currentVersion = await db.appSettings.get("dataFoundationVersion");

  await backfillNormalizedNames();
  await migrateLegacyTransactionCategories();
  await deduplicateCategories();
  await deduplicateSubcategories();
  await backfillAccountTypes();
  await deduplicateAccounts();

  if (currentVersion?.value !== DATA_FOUNDATION_VERSION) {
    await db.appSettings.put({
      key: "dataFoundationVersion",
      value: DATA_FOUNDATION_VERSION,
      updatedAt: new Date().toISOString()
    });
  }
}

async function backfillNormalizedNames() {
  const [categories, subcategories] = await Promise.all([db.categories.toArray(), db.subcategories.toArray()]);

  await Promise.all([
    ...categories
      .filter((category) => category.normalizedName !== normalizeCategoryName(category.name))
      .map((category) => db.categories.update(category.id, { normalizedName: normalizeCategoryName(category.name) })),
    ...subcategories
      .filter((subcategory) => subcategory.normalizedName !== normalizeSubcategoryName(subcategory.name))
      .map((subcategory) => db.subcategories.update(subcategory.id, { normalizedName: normalizeSubcategoryName(subcategory.name) }))
  ]);
}

async function migrateLegacyTransactionCategories() {
  const categories = await db.categories.toArray();
  const categoryIds = new Set(categories.map((category) => category.id));
  const transactions = (await db.transactions.toArray()) as Array<Transaction & LegacyCategoryText>;

  for (const transaction of transactions) {
    if (transaction.categoryId && categoryIds.has(transaction.categoryId)) continue;

    const categoryName =
      transaction.categoryName ||
      transaction.category ||
      legacyTextId(transaction.categoryId) ||
      defaultCategoryName(transaction.type);
    if (!categoryName) continue;
    const subcategoryName = transaction.subcategoryName || transaction.subcategory || legacyTextId(transaction.subcategoryId);
    const category =
      (await findCategoryByName(categoryName, transaction.type)) ??
      (await getOrCreateCategory({
        name: categoryName,
        kind: transaction.type,
        defaultBehavior: transaction.behavior
      }));
    const subcategory = subcategoryName
      ? await getOrCreateSubcategory({
          categoryId: category.id,
          name: subcategoryName,
          defaultBehavior: transaction.behavior
        })
      : await firstSubcategory(category.id);

    await db.transactions.update(transaction.id, {
      categoryId: category.id,
      subcategoryId: subcategory?.id,
      updatedAt: new Date().toISOString(),
      syncStatus: "local",
      version: transaction.version + 1
    });
  }
}

async function deduplicateCategories() {
  const categories = await db.categories.toArray();
  const groups = groupBy(categories, (category) => `${category.kind}:${normalizedCategory(category)}`);
  const now = new Date().toISOString();

  for (const group of groups.values()) {
    if (group.length <= 1) continue;

    const keeper = chooseCategoryKeeper(group);
    const duplicates = group.filter((category) => category.id !== keeper.id);

    for (const duplicate of duplicates) {
      await db.transaction("rw", [db.categories, db.subcategories, db.transactions, db.budgets, db.recurringRules], async () => {
        const transactions = await db.transactions.where("categoryId").equals(duplicate.id).toArray();
        await Promise.all(transactions.map((transaction) => db.transactions.update(transaction.id, { categoryId: keeper.id })));

        const budgets = await db.budgets.where("categoryId").equals(duplicate.id).toArray();
        await Promise.all(budgets.map((budget) => db.budgets.update(budget.id, { categoryId: keeper.id })));

        const subcategories = await db.subcategories.where("categoryId").equals(duplicate.id).toArray();
        await Promise.all(subcategories.map((subcategory) => db.subcategories.update(subcategory.id, { categoryId: keeper.id })));

        await remapRecurringCategory(duplicate.id, keeper.id);
        await db.categories.update(duplicate.id, {
          isArchived: true,
          updatedAt: now,
          syncStatus: "local",
          version: duplicate.version + 1
        });
      });
    }
  }
}

async function deduplicateSubcategories() {
  const subcategories = await db.subcategories.toArray();
  const groups = groupBy(subcategories, (subcategory) => `${subcategory.categoryId}:${normalizedSubcategory(subcategory)}`);
  const now = new Date().toISOString();

  for (const group of groups.values()) {
    if (group.length <= 1) continue;

    const keeper = chooseSubcategoryKeeper(group);
    const duplicates = group.filter((subcategory) => subcategory.id !== keeper.id);

    for (const duplicate of duplicates) {
      await db.transaction("rw", [db.subcategories, db.transactions, db.budgets, db.recurringRules], async () => {
        const transactions = await db.transactions.where("subcategoryId").equals(duplicate.id).toArray();
        await Promise.all(transactions.map((transaction) => db.transactions.update(transaction.id, { subcategoryId: keeper.id })));

        const budgets = await db.budgets.where("subcategoryId").equals(duplicate.id).toArray();
        await Promise.all(budgets.map((budget) => db.budgets.update(budget.id, { subcategoryId: keeper.id })));

        await remapRecurringSubcategory(duplicate.id, keeper.id);
        await db.subcategories.update(duplicate.id, {
          isArchived: true,
          updatedAt: now,
          syncStatus: "local",
          version: duplicate.version + 1
        });
      });
    }
  }
}

async function deduplicateAccounts() {
  const accounts = await db.accounts.toArray();
  const groups = groupBy(
    accounts.filter((account) => !account.isArchived),
    (account) => accountKey(account)
  );
  const now = new Date().toISOString();

  for (const group of groups.values()) {
    if (group.length <= 1) continue;

    const [keeper, ...duplicates] = group.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const mergedBalance = group.reduce((total, account) => total + account.currentBalance, 0);

    await db.transaction("rw", db.accounts, db.transactions, async () => {
      for (const duplicate of duplicates) {
        const accountTransactions = await db.transactions.where("accountId").equals(duplicate.id).toArray();
        await Promise.all(accountTransactions.map((transaction) => db.transactions.update(transaction.id, { accountId: keeper.id })));

        const transferTransactions = await db.transactions.where("transferAccountId").equals(duplicate.id).toArray();
        await Promise.all(transferTransactions.map((transaction) => db.transactions.update(transaction.id, { transferAccountId: keeper.id })));

        await db.accounts.update(duplicate.id, {
          isArchived: true,
          updatedAt: now,
          syncStatus: "local",
          version: duplicate.version + 1
        });
      }

      await db.accounts.update(keeper.id, {
        currentBalance: mergedBalance,
        updatedAt: now,
        syncStatus: "local",
        version: keeper.version + 1
      });
    });
  }
}

async function backfillAccountTypes() {
  const accounts = await db.accounts.toArray();
  const now = new Date().toISOString();

  await Promise.all(
    accounts.map((account) => {
      const accountType = getAccountType(account);
      const openingBalance = normalizeStoredAccountBalance(accountType, account.openingBalance);
      const currentBalance = normalizeStoredAccountBalance(accountType, account.currentBalance);
      const needsUpdate =
        account.accountType !== accountType ||
        account.openingBalance !== openingBalance ||
        account.currentBalance !== currentBalance;

      if (!needsUpdate) return Promise.resolve();
      return db.accounts.update(account.id, {
        accountType,
        openingBalance,
        currentBalance,
        updatedAt: now,
        syncStatus: "local",
        version: account.version + 1
      });
    })
  );
}

async function firstSubcategory(categoryId: string) {
  const subcategories = await db.subcategories.where("categoryId").equals(categoryId).sortBy("sortOrder");
  return subcategories.find((subcategory) => !subcategory.isArchived);
}

async function remapRecurringCategory(fromId: string, toId: string) {
  const rules = await db.recurringRules.toArray();
  await Promise.all(
    rules
      .filter((rule) => rule.transactionTemplate.categoryId === fromId)
      .map((rule) =>
        db.recurringRules.update(rule.id, {
          transactionTemplate: { ...rule.transactionTemplate, categoryId: toId },
          updatedAt: new Date().toISOString(),
          syncStatus: "local",
          version: rule.version + 1
        })
      )
  );
}

async function remapRecurringSubcategory(fromId: string, toId: string) {
  const rules = await db.recurringRules.toArray();
  await Promise.all(
    rules
      .filter((rule) => rule.transactionTemplate.subcategoryId === fromId)
      .map((rule) =>
        db.recurringRules.update(rule.id, {
          transactionTemplate: { ...rule.transactionTemplate, subcategoryId: toId },
          updatedAt: new Date().toISOString(),
          syncStatus: "local",
          version: rule.version + 1
        })
      )
  );
}

function chooseCategoryKeeper(categories: Category[]) {
  return [...categories].sort((left, right) => {
    if (left.isArchived !== right.isArchived) return left.isArchived ? 1 : -1;
    if (left.isSystem !== right.isSystem) return left.isSystem ? -1 : 1;
    return left.createdAt.localeCompare(right.createdAt);
  })[0];
}

function chooseSubcategoryKeeper(subcategories: Subcategory[]) {
  return [...subcategories].sort((left, right) => {
    if (left.isArchived !== right.isArchived) return left.isArchived ? 1 : -1;
    if (left.isSystem !== right.isSystem) return left.isSystem ? -1 : 1;
    return left.createdAt.localeCompare(right.createdAt);
  })[0];
}

function normalizedCategory(category: Category) {
  return category.normalizedName ?? normalizeCategoryName(category.name);
}

function normalizedSubcategory(subcategory: Subcategory) {
  return subcategory.normalizedName ?? normalizeSubcategoryName(subcategory.name);
}

function defaultCategoryName(type: Transaction["type"]) {
  if (type === "income") return "Pendapatan";
  if (type === "transfer") return "Transfer";
  return "";
}

function legacyTextId(value: string | undefined) {
  if (!value) return "";
  return /^(cat|subcat)[_-]/i.test(value) ? "" : value;
}

function accountKey(account: Account) {
  return `${getAccountType(account)}:${account.type}:${account.name.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
    return groups;
  }, new Map<string, T[]>());
}

type LegacyCategoryText = {
  category?: string;
  categoryName?: string;
  subcategory?: string;
  subcategoryName?: string;
};
