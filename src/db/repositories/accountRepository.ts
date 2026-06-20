import { createId } from "../../lib/ids";
import { getAccountType, normalizeStoredAccountBalance } from "../../lib/accounts";
import { db } from "../client";
import type { Account } from "../schema";

export async function seedDefaultAccounts() {
  const existing = await db.accounts.toArray();
  await deduplicateAccounts(existing);

  const activeAccounts = (await db.accounts.toArray()).filter((account) => !account.isArchived);
  if (activeAccounts.some((account) => normalizeAccountKey(account.name, getAccountType(account), account.type) === normalizeAccountKey("Rekening Utama", "asset", "bank"))) return;

  const now = new Date().toISOString();
  const accounts: Account[] = [
    createAccount("Rekening Utama", "asset", "bank", 0, "#88B99A", "landmark", now)
  ];

  await db.accounts.bulkAdd(accounts);
}

export async function listAccounts(includeArchived = false) {
  const accounts = await db.accounts.toArray();
  return accounts.filter((account) => includeArchived || !account.isArchived);
}

export async function createManualAccount(input: Pick<Account, "name" | "accountType" | "type" | "openingBalance" | "color" | "icon">) {
  const existing = (await db.accounts.toArray()).find(
    (account) =>
      !account.isArchived &&
      normalizeAccountKey(account.name, getAccountType(account), account.type) === normalizeAccountKey(input.name, input.accountType, input.type)
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const account = createAccount(input.name, input.accountType, input.type, input.openingBalance, input.color, input.icon, now);
  await db.accounts.add(account);
  return account;
}

export async function updateAccount(id: string, input: Partial<Pick<Account, "name" | "accountType" | "type" | "openingBalance" | "color" | "icon">>) {
  const existing = await db.accounts.get(id);
  if (!existing || existing.deletedAt) return undefined;

  const nextName = input.name?.trim() || existing.name;
  const nextAccountType = input.accountType ?? getAccountType(existing);
  const nextAccountKind = input.type ?? existing.type;
  const duplicate = (await db.accounts.toArray()).find(
    (account) =>
      !account.isArchived &&
      account.id !== id &&
      normalizeAccountKey(account.name, getAccountType(account), account.type) === normalizeAccountKey(nextName, nextAccountType, nextAccountKind)
  );
  if (duplicate) throw new Error(`Account "${nextName}" already exists.`);

  const existingOpeningBalance = normalizeStoredAccountBalance(getAccountType(existing), existing.openingBalance);
  const existingCurrentBalance = normalizeStoredAccountBalance(getAccountType(existing), existing.currentBalance);
  const nextOpeningBalance = normalizeStoredAccountBalance(nextAccountType, input.openingBalance ?? existingOpeningBalance);
  const openingBalanceDelta = nextOpeningBalance - existingOpeningBalance;

  await db.accounts.update(id, {
    ...input,
    name: nextName,
    accountType: nextAccountType,
    type: nextAccountKind,
    openingBalance: nextOpeningBalance,
    currentBalance: normalizeStoredAccountBalance(nextAccountType, existingCurrentBalance + openingBalanceDelta),
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: existing.version + 1
  });

  return db.accounts.get(id);
}

export async function archiveAccount(id: string) {
  const existing = await db.accounts.get(id);
  if (!existing || existing.deletedAt || existing.isArchived) return;

  await db.accounts.update(id, {
    isArchived: true,
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: existing.version + 1
  });
}

export async function restoreAccount(id: string) {
  const existing = await db.accounts.get(id);
  if (!existing || existing.deletedAt || !existing.isArchived) return existing;
  const duplicate = (await db.accounts.toArray()).find(
    (account) =>
      !account.isArchived &&
      account.id !== id &&
      normalizeAccountKey(account.name, getAccountType(account), account.type) === normalizeAccountKey(existing.name, getAccountType(existing), existing.type)
  );
  if (duplicate) throw new Error(`Active account "${existing.name}" already exists.`);

  await db.accounts.update(id, {
    isArchived: false,
    updatedAt: new Date().toISOString(),
    syncStatus: "local",
    version: existing.version + 1
  });
  return db.accounts.get(id);
}

export async function getAccountLinkCount(id: string) {
  const [primary, transfer] = await Promise.all([
    db.transactions.where("accountId").equals(id).count(),
    db.transactions.where("transferAccountId").equals(id).count()
  ]);
  return primary + transfer;
}

export async function deleteAccount(
  id: string,
  options: { reassignToAccountId?: string; archiveIfLinked?: boolean } = {}
) {
  const existing = await db.accounts.get(id);
  if (!existing || existing.deletedAt) return;

  const linkCount = await getAccountLinkCount(id);
  if (linkCount > 0 && options.archiveIfLinked) {
    await archiveAccount(id);
    return;
  }

  if (linkCount > 0 && !options.reassignToAccountId) {
    throw new Error("Account has linked transactions.");
  }

  const now = new Date().toISOString();
  await db.transaction("rw", db.accounts, db.transactions, async () => {
    if (linkCount > 0 && options.reassignToAccountId) {
      const transactions = await db.transactions.where("accountId").equals(id).toArray();
      await Promise.all(transactions.map((transaction) => db.transactions.update(transaction.id, { accountId: options.reassignToAccountId })));

      const transferTransactions = await db.transactions.where("transferAccountId").equals(id).toArray();
      await Promise.all(
        transferTransactions.map((transaction) =>
          db.transactions.update(transaction.id, { transferAccountId: options.reassignToAccountId })
        )
      );
    }

    await db.accounts.update(id, {
      deletedAt: now,
      isArchived: true,
      updatedAt: now,
      syncStatus: "local",
      version: existing.version + 1
    });
  });
}

async function deduplicateAccounts(accounts: Account[]) {
  const byKey = new Map<string, Account>();
  const duplicates: Account[] = [];

  accounts
    .filter((account) => !account.isArchived)
    .forEach((account) => {
      const key = normalizeAccountKey(account.name, getAccountType(account), account.type);
      const keeper = byKey.get(key);
      if (!keeper) {
        byKey.set(key, account);
        return;
      }

      keeper.currentBalance += account.currentBalance;
      duplicates.push(account);
    });

  if (duplicates.length === 0) return;

  const now = new Date().toISOString();
  await db.transaction("rw", db.accounts, db.transactions, async () => {
    await Promise.all(
      duplicates.map(async (duplicate) => {
        const keeper = byKey.get(normalizeAccountKey(duplicate.name, getAccountType(duplicate), duplicate.type));
        if (!keeper || keeper.id === duplicate.id) return;

        const transactions = await db.transactions.where("accountId").equals(duplicate.id).toArray();
        await Promise.all(transactions.map((transaction) => db.transactions.update(transaction.id, { accountId: keeper.id })));

        const transferTransactions = await db.transactions.where("transferAccountId").equals(duplicate.id).toArray();
        await Promise.all(transferTransactions.map((transaction) => db.transactions.update(transaction.id, { transferAccountId: keeper.id })));

        await db.accounts.update(keeper.id, {
          currentBalance: keeper.currentBalance,
          updatedAt: now,
          version: keeper.version + 1
        });
        await db.accounts.update(duplicate.id, {
          isArchived: true,
          updatedAt: now,
          syncStatus: "local",
          version: duplicate.version + 1
        });
      })
    );
  });
}

function normalizeAccountKey(name: string, accountType: Account["accountType"], type: Account["type"]) {
  return `${accountType}:${type}:${name.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

export async function adjustAccountBalance(accountId: string, delta: number) {
  const account = await db.accounts.get(accountId);
  if (!account) return;

  await db.accounts.update(accountId, {
    currentBalance: account.currentBalance + delta,
    updatedAt: new Date().toISOString(),
    version: account.version + 1
  });
}

function createAccount(
  name: string,
  accountType: Account["accountType"],
  type: Account["type"],
  openingBalance: number,
  color: string,
  icon: string,
  now: string
): Account {
  const storedOpeningBalance = normalizeStoredAccountBalance(accountType, openingBalance);
  return {
    id: createId("acct"),
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    version: 1,
    name,
    accountType,
    type,
    currency: "IDR",
    openingBalance: storedOpeningBalance,
    currentBalance: storedOpeningBalance,
    color,
    icon,
    isArchived: false
  };
}
