import { db } from "../client";
import type { Category, SpendingBehavior, Subcategory } from "../schema";
import { createId } from "../../lib/ids";
import { expenseCategorySeeds } from "../../lib/categoryTaxonomy";
import { categoryColorAt } from "../../lib/categoryColors";
import {
  normalizeCategoryName,
  normalizeSubcategoryName,
  toCategoryRegistry,
  type CategoryRegistryItem
} from "../../lib/categoryRegistry";

type CategoryInput = {
  name: string;
  kind: Category["kind"];
  color?: string;
  icon?: string;
  defaultBehavior?: SpendingBehavior;
  budgetGroup?: Category["budgetGroup"];
};

type SubcategoryInput = {
  categoryId: string;
  name: string;
  defaultBehavior?: SpendingBehavior;
  color?: string;
  icon?: string;
};

export async function seedDefaultExpenseCategories() {
  const now = new Date().toISOString();
  await deduplicateCategoryGraph();
  const existingCategories = await db.categories.toArray();
  const existingSubcategories = await db.subcategories.toArray();
  const categories: Category[] = [];
  const subcategories: Subcategory[] = [];

  const categoryByKey = new Map(
    existingCategories.map((category) => [`${category.kind}:${normalizedCategory(category)}`, category])
  );
  const subcategoryKeys = new Set(
    existingSubcategories.map((subcategory) => `${subcategory.categoryId}:${normalizedSubcategory(subcategory)}`)
  );

  expenseCategorySeeds.forEach((seed, categoryIndex) => {
    const key = `expense:${normalizeCategoryName(seed.name)}`;
    const existingCategory = categoryByKey.get(key);
    const categoryId = existingCategory?.id ?? createId("cat");

    if (!existingCategory) {
      const category = createCategory({
        id: categoryId,
        now,
        name: seed.name,
        kind: "expense",
        defaultBehavior: seed.defaultBehavior,
        budgetGroup: seed.budgetGroup,
        color: seed.color,
        icon: seed.icon,
        sortOrder: categoryIndex,
        isSystem: true
      });
      categories.push(category);
      categoryByKey.set(key, category);
    }

    seed.subcategories.forEach((subcategory, subcategoryIndex) => {
      const subcategoryKey = `${categoryId}:${normalizeSubcategoryName(subcategory.name)}`;
      if (subcategoryKeys.has(subcategoryKey)) return;

      subcategories.push(
        createSubcategory({
          id: createId("subcat"),
          now,
          categoryId,
          name: subcategory.name,
          defaultBehavior: subcategory.defaultBehavior ?? seed.defaultBehavior,
          sortOrder: subcategoryIndex,
          isSystem: true
        })
      );
      subcategoryKeys.add(subcategoryKey);
    });
  });

  await ensureSystemCategory({
    now,
    existingByKey: categoryByKey,
    existingSubcategoryKeys: subcategoryKeys,
    categories,
    subcategories,
    input: {
      name: "Pendapatan",
      kind: "income",
      defaultBehavior: "fixed",
      budgetGroup: "commitment",
      color: categoryColorAt(expenseCategorySeeds.length),
      icon: "wallet-cards"
    },
    sortOrder: expenseCategorySeeds.length,
    subcategoryNames: ["Gaji", "Bonus", "Freelance", "Lainnya"]
  });

  await ensureSystemCategory({
    now,
    existingByKey: categoryByKey,
    existingSubcategoryKeys: subcategoryKeys,
    categories,
    subcategories,
    input: {
      name: "Transfer",
      kind: "transfer",
      defaultBehavior: "variable",
      budgetGroup: "flexible",
      color: categoryColorAt(expenseCategorySeeds.length + 1),
      icon: "repeat"
    },
    sortOrder: expenseCategorySeeds.length + 1,
    subcategoryNames: ["Antar Akun"]
  });

  await db.transaction("rw", db.categories, db.subcategories, async () => {
    if (categories.length > 0) await db.categories.bulkAdd(categories);
    if (subcategories.length > 0) await db.subcategories.bulkAdd(subcategories);
    await backfillNormalizedCategoryNames([...existingCategories, ...categories], [...existingSubcategories, ...subcategories]);
  });
  await deduplicateCategoryGraph();
}

export async function listCategories(includeArchived = false) {
  const categories = await db.categories.toArray();
  return categories.filter((category) => includeArchived || !category.isArchived).sort(sortCategories);
}

export async function listSubcategories(includeArchived = false) {
  const subcategories = await db.subcategories.toArray();
  return subcategories.filter((subcategory) => includeArchived || !subcategory.isArchived).sort((left, right) => left.sortOrder - right.sortOrder);
}

export async function listSubcategoriesIncludingArchived() {
  return listSubcategories(true);
}

export async function listCategoryRegistry(): Promise<CategoryRegistryItem[]> {
  return toCategoryRegistry(await listCategories());
}

export async function listSubcategoriesByCategory(categoryId: string) {
  return db.subcategories.where("categoryId").equals(categoryId).sortBy("sortOrder");
}

export async function addCategory(input: CategoryInput) {
  return getOrCreateCategory(input);
}

export async function editCategory(id: string, input: Partial<Omit<CategoryInput, "kind">>) {
  const existing = await db.categories.get(id);
  if (!existing) return undefined;

  const nextName = input.name?.trim() || existing.name;
  const duplicate = await findCategoryByName(nextName, existing.kind);
  if (duplicate && duplicate.id !== id) {
    await mergeCategoryInto(id, duplicate.id);
    if (input.color || input.icon || input.defaultBehavior || input.budgetGroup) {
      await db.categories.update(duplicate.id, {
        color: input.color ?? duplicate.color,
        icon: input.icon ?? duplicate.icon,
        defaultBehavior: input.defaultBehavior ?? duplicate.defaultBehavior,
        budgetGroup: input.budgetGroup ?? duplicate.budgetGroup,
        updatedAt: new Date().toISOString(),
        syncStatus: "local",
        version: duplicate.version + 1
      });
    }
    return db.categories.get(duplicate.id);
  }

  await db.categories.update(id, {
    ...input,
    name: nextName,
    normalizedName: normalizeCategoryName(nextName),
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: existing.version + 1
  });

  await updateLegacyTransactionCategoryText(id, nextName);
  return db.categories.get(id);
}

export async function archiveCategory(id: string) {
  const category = await db.categories.get(id);
  if (!category) return;

  await db.categories.update(id, {
    isArchived: true,
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: category.version + 1
  });
}

export async function restoreCategory(id: string) {
  const category = await db.categories.get(id);
  if (!category || !category.isArchived) return category;
  const duplicate = await findCategoryByName(category.name, category.kind);
  if (duplicate && duplicate.id !== id && !duplicate.isArchived) {
    await mergeCategoryInto(id, duplicate.id);
    return duplicate;
  }

  await db.categories.update(id, {
    isArchived: false,
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: category.version + 1
  });
  return db.categories.get(id);
}

export async function addSubcategory(input: SubcategoryInput) {
  const category = await db.categories.get(input.categoryId);
  if (!category) throw new Error("Category does not exist.");

  const existing = await findSubcategoryByName(input.categoryId, input.name);
  if (existing && !existing.isArchived) return existing;

  const now = new Date().toISOString();
  const siblings = await db.subcategories.where("categoryId").equals(input.categoryId).toArray();
  const subcategory = createSubcategory({
    id: createId("subcat"),
    now,
    categoryId: input.categoryId,
    name: input.name,
    defaultBehavior: input.defaultBehavior ?? category.defaultBehavior,
    color: input.color,
    icon: input.icon,
    sortOrder: siblings.length,
    isSystem: false
  });

  await db.subcategories.add(subcategory);
  return subcategory;
}

export async function editSubcategory(id: string, input: Partial<Omit<SubcategoryInput, "categoryId">>) {
  const existing = await db.subcategories.get(id);
  if (!existing) return undefined;

  const nextName = input.name?.trim() || existing.name;
  const duplicate = await findSubcategoryByName(existing.categoryId, nextName);
  if (duplicate && duplicate.id !== id) {
    await mergeSubcategoryInto(id, duplicate.id);
    if (input.defaultBehavior || input.color || input.icon) {
      await db.subcategories.update(duplicate.id, {
        defaultBehavior: input.defaultBehavior ?? duplicate.defaultBehavior,
        color: input.color ?? duplicate.color,
        icon: input.icon ?? duplicate.icon,
        updatedAt: new Date().toISOString(),
        syncStatus: "local",
        version: duplicate.version + 1
      });
    }
    return db.subcategories.get(duplicate.id);
  }

  await db.subcategories.update(id, {
    ...input,
    name: nextName,
    normalizedName: normalizeSubcategoryName(nextName),
    color: input.color,
    icon: input.icon,
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: existing.version + 1
  });

  await updateLegacyTransactionSubcategoryText(id, nextName);
  return db.subcategories.get(id);
}

export async function archiveSubcategory(id: string) {
  const subcategory = await db.subcategories.get(id);
  if (!subcategory) return;

  await db.subcategories.update(id, {
    isArchived: true,
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: subcategory.version + 1
  });
}

export async function restoreSubcategory(id: string) {
  const subcategory = await db.subcategories.get(id);
  if (!subcategory || !subcategory.isArchived) return subcategory;
  const duplicate = await findSubcategoryByName(subcategory.categoryId, subcategory.name);
  if (duplicate && duplicate.id !== id && !duplicate.isArchived) {
    await mergeSubcategoryInto(id, duplicate.id);
    return duplicate;
  }

  await db.subcategories.update(id, {
    isArchived: false,
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: subcategory.version + 1
  });
  return db.subcategories.get(id);
}

export async function getOrCreateCategory(input: CategoryInput) {
  const existing = await findCategoryByName(input.name, input.kind);
  if (existing && !existing.isArchived) return existing;
  if (existing?.isArchived) {
    await restoreCategory(existing.id);
    return (await db.categories.get(existing.id)) ?? existing;
  }

  const now = new Date().toISOString();
  const categories = await db.categories.toArray();
  const category = createCategory({
    id: createId("cat"),
    now,
    name: input.name,
    kind: input.kind,
    defaultBehavior: input.defaultBehavior,
    budgetGroup: input.budgetGroup,
    color: input.color ?? categoryColorAt(categories.length),
    icon: input.icon ?? defaultIconForKind(input.kind),
    sortOrder: categories.filter((item) => item.kind === input.kind).length,
    isSystem: false
  });

  await db.categories.add(category);
  return category;
}

export async function getOrCreateSubcategory(input: SubcategoryInput) {
  return addSubcategory(input);
}

export async function findCategoryByName(name: string, kind: Category["kind"]) {
  const normalized = normalizeCategoryName(name);
  const categories = await db.categories.where("kind").equals(kind).toArray();
  return categories
    .filter((category) => normalizedCategory(category) === normalized)
    .sort(preferActiveThenFresh)[0];
}

export async function findSubcategoryByName(categoryId: string, name: string) {
  const normalized = normalizeSubcategoryName(name);
  const subcategories = await db.subcategories.where("categoryId").equals(categoryId).toArray();
  return subcategories
    .filter((subcategory) => normalizedSubcategory(subcategory) === normalized)
    .sort(preferActiveThenFresh)[0];
}

async function deduplicateCategoryGraph() {
  const categories = await db.categories.toArray();
  const categoryGroups = groupBy(categories, (category) => `${category.kind}:${normalizedCategory(category)}`);

  for (const group of categoryGroups.values()) {
    const duplicates = group.filter((category) => !category.deletedAt);
    if (duplicates.length <= 1) continue;
    const [keeper, ...rest] = [...duplicates].sort(preferKeeperCategory);
    for (const duplicate of rest) {
      await mergeCategoryInto(duplicate.id, keeper.id);
    }
  }

  const subcategories = await db.subcategories.toArray();
  const subcategoryGroups = groupBy(subcategories, (subcategory) => `${subcategory.categoryId}:${normalizedSubcategory(subcategory)}`);
  for (const group of subcategoryGroups.values()) {
    const duplicates = group.filter((subcategory) => !subcategory.deletedAt);
    if (duplicates.length <= 1) continue;
    const [keeper, ...rest] = [...duplicates].sort(preferActiveThenFresh);
    for (const duplicate of rest) {
      await mergeSubcategoryInto(duplicate.id, keeper.id);
    }
  }
}

async function mergeCategoryInto(fromId: string, toId: string) {
  const duplicate = await db.categories.get(fromId);
  const keeper = await db.categories.get(toId);
  if (!duplicate || !keeper || fromId === toId) return;
  const now = new Date().toISOString();

  await db.transaction("rw", [db.categories, db.subcategories, db.transactions, db.budgets, db.recurringRules], async () => {
    const transactions = await db.transactions.where("categoryId").equals(fromId).toArray();
    await Promise.all(transactions.map((transaction) => db.transactions.update(transaction.id, { categoryId: toId })));

    const budgets = await db.budgets.where("categoryId").equals(fromId).toArray();
    await Promise.all(budgets.map((budget) => db.budgets.update(budget.id, { categoryId: toId })));

    const subcategories = await db.subcategories.where("categoryId").equals(fromId).toArray();
    await Promise.all(subcategories.map((subcategory) => db.subcategories.update(subcategory.id, { categoryId: toId })));

    const rules = await db.recurringRules.toArray();
    await Promise.all(
      rules
        .filter((rule) => rule.transactionTemplate.categoryId === fromId)
        .map((rule) =>
          db.recurringRules.update(rule.id, {
            transactionTemplate: { ...rule.transactionTemplate, categoryId: toId },
            updatedAt: now,
            syncStatus: "local",
            version: rule.version + 1
          })
        )
    );

    await db.categories.update(fromId, {
      isArchived: true,
      updatedAt: now,
      syncStatus: "local",
      version: duplicate.version + 1
    });
  });
}

async function mergeSubcategoryInto(fromId: string, toId: string) {
  const duplicate = await db.subcategories.get(fromId);
  if (!duplicate || fromId === toId) return;
  const now = new Date().toISOString();

  await db.transaction("rw", [db.subcategories, db.transactions, db.budgets, db.recurringRules], async () => {
    const transactions = await db.transactions.where("subcategoryId").equals(fromId).toArray();
    await Promise.all(transactions.map((transaction) => db.transactions.update(transaction.id, { subcategoryId: toId })));

    const budgets = await db.budgets.where("subcategoryId").equals(fromId).toArray();
    await Promise.all(budgets.map((budget) => db.budgets.update(budget.id, { subcategoryId: toId })));

    const rules = await db.recurringRules.toArray();
    await Promise.all(
      rules
        .filter((rule) => rule.transactionTemplate.subcategoryId === fromId)
        .map((rule) =>
          db.recurringRules.update(rule.id, {
            transactionTemplate: { ...rule.transactionTemplate, subcategoryId: toId },
            updatedAt: now,
            syncStatus: "local",
            version: rule.version + 1
          })
        )
    );

    await db.subcategories.update(fromId, {
      isArchived: true,
      updatedAt: now,
      syncStatus: "local",
      version: duplicate.version + 1
    });
  });
}

async function ensureSystemCategory({
  now,
  existingByKey,
  existingSubcategoryKeys,
  categories,
  subcategories,
  input,
  sortOrder,
  subcategoryNames
}: {
  now: string;
  existingByKey: Map<string, Category>;
  existingSubcategoryKeys: Set<string>;
  categories: Category[];
  subcategories: Subcategory[];
  input: CategoryInput;
  sortOrder: number;
  subcategoryNames: string[];
}) {
  const key = `${input.kind}:${normalizeCategoryName(input.name)}`;
  const existingCategory = existingByKey.get(key);
  const categoryId = existingCategory?.id ?? createId("cat");

  if (!existingCategory) {
    const category = createCategory({ id: categoryId, now, ...input, sortOrder, isSystem: true });
    categories.push(category);
    existingByKey.set(key, category);
  }

  subcategoryNames.forEach((name, index) => {
    const subcategoryKey = `${categoryId}:${normalizeSubcategoryName(name)}`;
    if (existingSubcategoryKeys.has(subcategoryKey)) return;

    subcategories.push(
      createSubcategory({
        id: createId("subcat"),
        now,
        categoryId,
        name,
        defaultBehavior: name === "Gaji" ? "fixed" : input.defaultBehavior,
        sortOrder: index,
        isSystem: true
      })
    );
    existingSubcategoryKeys.add(subcategoryKey);
  });
}

function createCategory({
  id,
  now,
  name,
  kind,
  defaultBehavior,
  budgetGroup,
  color,
  icon,
  sortOrder,
  isSystem
}: CategoryInput & { id: string; now: string; sortOrder: number; isSystem: boolean }): Category {
  const trimmedName = name.trim();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    version: 1,
    name: trimmedName,
    normalizedName: normalizeCategoryName(trimmedName),
    kind,
    defaultBehavior,
    budgetGroup,
    color: color ?? categoryColorAt(sortOrder),
    icon: icon ?? defaultIconForKind(kind),
    sortOrder,
    isSystem,
    isArchived: false
  };
}

function createSubcategory({
  id,
  now,
  categoryId,
  name,
  defaultBehavior,
  color,
  icon,
  sortOrder,
  isSystem
}: SubcategoryInput & { id: string; now: string; sortOrder: number; isSystem: boolean }): Subcategory {
  const trimmedName = name.trim();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    version: 1,
    categoryId,
    name: trimmedName,
    normalizedName: normalizeSubcategoryName(trimmedName),
    defaultBehavior,
    color,
    icon,
    sortOrder,
    isSystem,
    isArchived: false
  };
}

async function backfillNormalizedCategoryNames(categories: Category[], subcategories: Subcategory[]) {
  const categoryUpdates = categories
    .filter((category) => category.normalizedName !== normalizeCategoryName(category.name))
    .map((category) => db.categories.update(category.id, { normalizedName: normalizeCategoryName(category.name) }));
  const subcategoryUpdates = subcategories
    .filter((subcategory) => subcategory.normalizedName !== normalizeSubcategoryName(subcategory.name))
    .map((subcategory) => db.subcategories.update(subcategory.id, { normalizedName: normalizeSubcategoryName(subcategory.name) }));

  await Promise.all([...categoryUpdates, ...subcategoryUpdates]);
}

function normalizedCategory(category: Category) {
  return category.normalizedName ?? normalizeCategoryName(category.name);
}

function normalizedSubcategory(subcategory: Subcategory) {
  return subcategory.normalizedName ?? normalizeSubcategoryName(subcategory.name);
}

function sortCategories(left: Category, right: Category) {
  if (left.kind !== right.kind) return kindOrder(left.kind) - kindOrder(right.kind);
  return left.sortOrder - right.sortOrder;
}

function preferKeeperCategory(left: Category, right: Category) {
  if (left.isArchived !== right.isArchived) return left.isArchived ? 1 : -1;
  if (left.isSystem !== right.isSystem) return left.isSystem ? -1 : 1;
  if (left.createdAt !== right.createdAt) return left.createdAt.localeCompare(right.createdAt);
  return left.id.localeCompare(right.id);
}

function preferActiveThenFresh<T extends { isArchived: boolean; createdAt: string; id: string }>(left: T, right: T) {
  if (left.isArchived !== right.isArchived) return left.isArchived ? 1 : -1;
  if (left.createdAt !== right.createdAt) return left.createdAt.localeCompare(right.createdAt);
  return left.id.localeCompare(right.id);
}

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const key = keyFn(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return groups;
}

function kindOrder(kind: Category["kind"]) {
  if (kind === "expense") return 0;
  if (kind === "income") return 1;
  return 2;
}

function defaultIconForKind(kind: Category["kind"]) {
  if (kind === "income") return "wallet-cards";
  if (kind === "transfer") return "repeat";
  return "circle";
}

async function updateLegacyTransactionCategoryText(categoryId: string, name: string) {
  const transactions = await db.transactions.where("categoryId").equals(categoryId).toArray();
  await Promise.all(
    transactions
      .filter((transaction) => "category" in transaction || "categoryName" in transaction)
      .map((transaction) => db.transactions.update(transaction.id, { category: name, categoryName: name } as Partial<TransactionWithLegacyText>))
  );
}

async function updateLegacyTransactionSubcategoryText(subcategoryId: string, name: string) {
  const transactions = await db.transactions.where("subcategoryId").equals(subcategoryId).toArray();
  await Promise.all(
    transactions
      .filter((transaction) => "subcategory" in transaction || "subcategoryName" in transaction)
      .map((transaction) =>
        db.transactions.update(transaction.id, { subcategory: name, subcategoryName: name } as Partial<TransactionWithLegacyText>)
      )
  );
}

type TransactionWithLegacyText = {
  category?: string;
  categoryName?: string;
  subcategory?: string;
  subcategoryName?: string;
};
