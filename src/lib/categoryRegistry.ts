import type { Category, Subcategory } from "../db/schema";
import { expenseCategorySeeds } from "./categoryTaxonomy";

export type CategoryType = Category["kind"];

export type CategoryRegistryItem = {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: CategoryType;
  isArchived: boolean;
};

export function normalizeEntityName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeCategoryName(value: string) {
  const normalized = normalizeEntityName(value);
  return categoryAliases[normalized] ?? normalized;
}

export function normalizeSubcategoryName(value: string) {
  return normalizeEntityName(value);
}

export function toCategoryRegistry(categories: Category[]): CategoryRegistryItem[] {
  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      type: category.kind,
      isArchived: category.isArchived
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function categoryRegistrySeedNames() {
  return [
    ...expenseCategorySeeds.map((seed) => ({ name: seed.name, type: "expense" as const })),
    { name: "Pendapatan", type: "income" as const },
    { name: "Transfer", type: "transfer" as const }
  ];
}

export function categoryKey(input: Pick<Category, "kind" | "name">) {
  return `${input.kind}:${normalizeCategoryName(input.name)}`;
}

export function subcategoryKey(input: Pick<Subcategory, "categoryId" | "name">) {
  return `${input.categoryId}:${normalizeSubcategoryName(input.name)}`;
}

const categoryAliases: Record<string, string> = {
  income: "pendapatan",
  pemasukan: "pendapatan",
  pendapatan: "pendapatan",
  food: "makan",
  makanan: "makan",
  makan: "makan",
  transportation: "transportasi",
  transport: "transportasi",
  transportasi: "transportasi",
  household: "rumah tangga",
  rumah: "rumah tangga",
  "rumah tangga": "rumah tangga",
  bills: "tagihan",
  tagihan: "tagihan",
  health: "kesehatan",
  kesehatan: "kesehatan",
  grocery: "supermarket",
  groceries: "supermarket",
  supermarket: "supermarket"
};
