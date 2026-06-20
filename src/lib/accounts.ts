import type { Account } from "../db/schema";

const liabilityAccountTypes: Account["type"][] = ["credit", "loan", "mortgage", "installment"];

export function getAccountType(account: Pick<Account, "accountType" | "type">) {
  return account.accountType ?? (liabilityAccountTypes.includes(account.type) ? "liability" : "asset");
}

export function isLiabilityAccount(account: Pick<Account, "accountType" | "type">) {
  return getAccountType(account) === "liability";
}

export function normalizeStoredAccountBalance(accountType: Account["accountType"], balance: number) {
  return accountType === "liability" ? Math.abs(balance) : balance;
}

export function toDisplayAccountBalance(account: Pick<Account, "accountType" | "type" | "currentBalance">) {
  return isLiabilityAccount(account) ? -Math.abs(account.currentBalance) : account.currentBalance;
}

export function toDisplayOpeningBalance(account: Pick<Account, "accountType" | "type" | "openingBalance">) {
  return isLiabilityAccount(account) ? -Math.abs(account.openingBalance) : account.openingBalance;
}
