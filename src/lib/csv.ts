import type { Account, Category, Subcategory, Transaction } from "../db/schema";

export type CsvTransactionInput = {
  date: string;
  type: Transaction["type"];
  amount: number;
  accountName: string;
  transferAccountName?: string;
  categoryName: string;
  subcategoryName?: string;
  merchant?: string;
  note?: string;
  tags: string[];
  behavior?: Transaction["behavior"];
  frequency?: Transaction["frequency"];
};

const headers = [
  "date",
  "type",
  "amount",
  "account",
  "transferAccount",
  "category",
  "subcategory",
  "behavior",
  "frequency",
  "merchant",
  "note",
  "tags"
];

export function exportTransactionsCsv(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
  subcategories: Subcategory[]
) {
  const accountMap = new Map(accounts.map((account) => [account.id, account.name]));
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
  const subcategoryMap = new Map(subcategories.map((subcategory) => [subcategory.id, subcategory.name]));

  const rows = transactions.map((transaction) => [
    transaction.date,
    transaction.type,
    String(transaction.amount),
    accountMap.get(transaction.accountId) ?? "",
    transaction.transferAccountId ? accountMap.get(transaction.transferAccountId) ?? "" : "",
    categoryMap.get(transaction.categoryId) ?? "",
    transaction.subcategoryId ? subcategoryMap.get(transaction.subcategoryId) ?? "" : "",
    transaction.behavior ?? "",
    transaction.frequency ?? "",
    transaction.merchant ?? "",
    transaction.note ?? "",
    transaction.tags.join("|")
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function parseTransactionsCsv(csv: string): CsvTransactionInput[] {
  const rows = parseCsvRows(csv).filter((row) => row.some(Boolean));
  if (rows.length <= 1) return [];

  const header = rows[0].map((cell) => normalizeKey(cell));
  return rows.slice(1).map((row) => {
    const record = new Map(header.map((key, index) => [key, row[index] ?? ""]));
    return {
      date: record.get("date") || new Date().toISOString().slice(0, 10),
      type: normalizeType(record.get("type")),
      amount: parseAmount(record.get("amount") || "0"),
      accountName: record.get("account") || "Rekening Utama",
      transferAccountName: record.get("transferaccount") || undefined,
      categoryName: record.get("category") || "",
      subcategoryName: record.get("subcategory") || undefined,
      merchant: record.get("merchant") || record.get("description") || undefined,
      note: record.get("note") || undefined,
      tags: (record.get("tags") || "")
        .split("|")
        .map((tag) => tag.trim())
        .filter(Boolean),
      behavior: normalizeBehavior(record.get("behavior") || record.get("type")),
      frequency: normalizeFrequency(record.get("frequency"))
    };
  });
}

function escapeCsvCell(cell: string) {
  if (!/[",\n]/.test(cell)) return cell;
  return `"${cell.replace(/"/g, "\"\"")}"`;
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === "\"" && inQuotes && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  rows.push(row);
  return rows;
}

function normalizeKey(value = "") {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function normalizeType(value = ""): Transaction["type"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("income") || normalized.includes("pemasukan")) return "income";
  if (normalized.includes("transfer")) return "transfer";
  return "expense";
}

function parseAmount(value: string) {
  const normalized = value.replace(/[^\d-]/g, "");
  return Math.abs(Number(normalized || 0));
}

function normalizeBehavior(value = ""): Transaction["behavior"] | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes("tetap") || normalized.includes("fixed")) return "fixed";
  if (normalized.includes("impulsif") || normalized.includes("impulse")) return "impulse";
  if (normalized.includes("direncanakan") || normalized.includes("planned")) return "planned";
  if (normalized.includes("wajib") || normalized.includes("mandatory")) return "mandatory";
  if (normalized.includes("variabel") || normalized.includes("variable")) return "variable";
  return undefined;
}

function normalizeFrequency(value = ""): Transaction["frequency"] | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes("non")) return "non_routine";
  if (normalized.includes("rutin") || normalized.includes("routine")) return "routine";
  return undefined;
}
