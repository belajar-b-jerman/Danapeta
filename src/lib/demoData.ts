import type { Account, Budget, Category, Subcategory, Transaction } from "../db/schema";
import { createId } from "./ids";
import { expenseCategorySeeds } from "./categoryTaxonomy";
import { normalizeCategoryName, normalizeSubcategoryName } from "./categoryRegistry";

type DemoDataset = {
  accounts: Account[];
  categories: Category[];
  subcategories: Subcategory[];
  transactions: Transaction[];
  budgets: Budget[];
};

const demoCategoryPatterns = [
  { category: "Makan", subcategories: ["Sarapan", "Makan Siang", "Makan Malam", "Jajan", "Kopi", "Bahan Masak"] },
  { category: "Transportasi", subcategories: ["Bensin Mobil", "Bensin Motor", "Parkir", "Transport Online"] },
  { category: "Rumah Tangga", subcategories: ["Perlengkapan", "Maintenance", "Kebersihan"] },
  { category: "Tagihan", subcategories: ["Listrik", "Air", "Internet"] },
  { category: "Anak & Pendidikan", subcategories: ["SPP", "Kegiatan Sekolah", "Iuran Sekolah"] },
  { category: "Kesehatan", subcategories: ["Obat", "Vitamin"] },
  { category: "Lifestyle", subcategories: ["Fashion", "Hiburan", "Self-Care"] },
  { category: "Supermarket", subcategories: ["Belanja Bulanan", "Bahan Pokok", "Kebutuhan Dapur"] }
];

const demoAmounts: Record<string, [number, number]> = {
  Makan: [18000, 95000],
  Transportasi: [5000, 250000],
  "Rumah Tangga": [25000, 450000],
  Tagihan: [120000, 850000],
  "Anak & Pendidikan": [50000, 1200000],
  Kesehatan: [25000, 350000],
  Lifestyle: [60000, 900000],
  Supermarket: [120000, 950000]
};

export function createDemoDataset(referenceDate = new Date()): DemoDataset {
  const now = new Date().toISOString();
  const accountId = createId("acct");
  const accounts: Account[] = [
    {
      id: accountId,
      createdAt: now,
      updatedAt: now,
      syncStatus: "local",
      version: 1,
      name: "Rekening Utama",
      accountType: "asset",
      type: "bank",
      currency: "IDR",
      openingBalance: 18000000,
      currentBalance: 18000000,
      color: "#88B99A",
      icon: "wallet",
      isArchived: false
    }
  ];

  const categories: Category[] = [];
  const subcategories: Subcategory[] = [];
  const categoryLookup = new Map<string, Category>();
  const subcategoryLookup = new Map<string, Subcategory>();

  expenseCategorySeeds.forEach((seed, index) => {
    const category: Category = {
      id: createId("cat"),
      createdAt: now,
      updatedAt: now,
      syncStatus: "local",
      version: 1,
      name: seed.name,
      normalizedName: normalizeCategoryName(seed.name),
      kind: "expense",
      defaultBehavior: seed.defaultBehavior,
      budgetGroup: seed.budgetGroup,
      color: seed.color,
      icon: seed.icon,
      sortOrder: index,
      isSystem: true,
      isArchived: false
    };

    categories.push(category);
    categoryLookup.set(seed.name, category);

    seed.subcategories.forEach((subcategorySeed, subcategoryIndex) => {
      const subcategory: Subcategory = {
        id: createId("subcat"),
        createdAt: now,
        updatedAt: now,
        syncStatus: "local",
        version: 1,
        categoryId: category.id,
        name: subcategorySeed.name,
        normalizedName: normalizeSubcategoryName(subcategorySeed.name),
        defaultBehavior: subcategorySeed.defaultBehavior ?? seed.defaultBehavior,
        sortOrder: subcategoryIndex,
        isSystem: true,
        isArchived: false
      };

      subcategories.push(subcategory);
      subcategoryLookup.set(`${seed.name}:${subcategorySeed.name}`, subcategory);
    });
  });

  const incomeCategory = createCategory("Income", "income", now, categories.length);
  const salarySubcategory = createSubcategory(incomeCategory.id, "Gaji", now, 0);
  categories.push(incomeCategory);
  subcategories.push(salarySubcategory);

  const transactions: Transaction[] = [
    createTransaction({
      accountId,
      categoryId: incomeCategory.id,
      subcategoryId: salarySubcategory.id,
      amount: 14500000,
      date: dateInMonth(referenceDate, 1),
      type: "income",
      behavior: "fixed",
      frequency: "routine",
      tags: ["demo", "income"]
    })
  ];

  for (let day = 1; day <= 28; day += 1) {
    const categoryPattern = demoCategoryPatterns[day % demoCategoryPatterns.length];
    const subcategoryName = categoryPattern.subcategories[day % categoryPattern.subcategories.length];
    const category = categoryLookup.get(categoryPattern.category);
    const subcategory = subcategoryLookup.get(`${categoryPattern.category}:${subcategoryName}`);
    if (!category || !subcategory) continue;

    const [minAmount, maxAmount] = demoAmounts[category.name];
    const amount = deterministicAmount(minAmount, maxAmount, day);
    const behavior = subcategory.defaultBehavior ?? category.defaultBehavior ?? "variable";

    transactions.push(
      createTransaction({
        accountId,
        categoryId: category.id,
        subcategoryId: subcategory.id,
        amount,
        date: dateInMonth(referenceDate, day),
        type: "expense",
        behavior,
        frequency: behavior === "planned" ? "non_routine" : "routine",
        tags: ["demo"]
      })
    );
  }

  const budgets = categories
    .filter((category) => category.kind === "expense")
    .slice(0, 8)
    .map<Budget>((category, index) => ({
      id: createId("budget"),
      createdAt: now,
      updatedAt: now,
      syncStatus: "local",
      version: 1,
      name: `${category.name} Bulanan`,
      period: periodKey(referenceDate),
      categoryId: category.id,
      limitAmount: [5000000, 1600000, 1200000, 2200000, 1800000, 800000, 1500000, 2500000][index],
      rolloverEnabled: false,
      rolloverAmount: 0,
      alertThresholds: [0.8, 1]
    }));

  return { accounts, categories, subcategories, transactions, budgets };
}

function createCategory(name: string, kind: Category["kind"], now: string, sortOrder: number): Category {
  return {
    id: createId("cat"),
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    version: 1,
    name,
    normalizedName: normalizeCategoryName(name),
    kind,
    color: "#88B99A",
    icon: "circle",
    sortOrder,
    isSystem: true,
    isArchived: false
  };
}

function createSubcategory(categoryId: string, name: string, now: string, sortOrder: number): Subcategory {
  return {
    id: createId("subcat"),
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    version: 1,
    categoryId,
    name,
    normalizedName: normalizeSubcategoryName(name),
    sortOrder,
    isSystem: true,
    isArchived: false
  };
}

function createTransaction(input: {
  accountId: string;
  categoryId: string;
  subcategoryId: string;
  amount: number;
  date: string;
  type: Transaction["type"];
  behavior: NonNullable<Transaction["behavior"]>;
  frequency: NonNullable<Transaction["frequency"]>;
  tags: string[];
}): Transaction {
  const now = new Date().toISOString();

  return {
    id: createId("txn"),
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    version: 1,
    accountId: input.accountId,
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    amount: input.amount,
    currency: "IDR",
    date: input.date,
    type: input.type,
    behavior: input.behavior,
    frequency: input.frequency,
    tags: input.tags,
    source: "manual"
  };
}

function deterministicAmount(min: number, max: number, day: number) {
  const span = max - min;
  const ratio = ((day * 37) % 100) / 100;
  return Math.round((min + span * ratio) / 1000) * 1000;
}

function dateInMonth(referenceDate: Date, day: number) {
  const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), day);
  return date.toISOString().slice(0, 10);
}

function periodKey(referenceDate: Date) {
  return `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, "0")}`;
}
