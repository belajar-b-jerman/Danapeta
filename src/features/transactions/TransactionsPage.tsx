import { Download, Plus, ReceiptText, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Amount } from "../../components/finance/Amount";
import { BehaviorBadge } from "../../components/finance/BehaviorBadge";
import { CategoryBadge } from "../../components/finance/CategoryBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/AppState";
import { LockedFeature } from "../../components/finance/FeatureGate";
import { Field, FormActions, Input, Select } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import { Stat } from "../../components/ui/Stat";
import { useRouter } from "../../app/router";
import {
  archiveAccount,
  createManualAccount,
  deleteAccount,
  getAccountLinkCount,
  listAccounts,
  updateAccount
} from "../../db/repositories/accountRepository";
import { getOrCreateCategory, getOrCreateSubcategory, listCategories, listSubcategoriesIncludingArchived } from "../../db/repositories/categoryRepository";
import { createRecurringRule, isRuleSourceTransaction, listRecurringRules } from "../../db/repositories/recurringRepository";
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  listTransactionsByDate,
  updateTransaction,
} from "../../db/repositories/transactionRepository";
import type { Account, Category, RecurringRule, Subcategory, Transaction } from "../../db/schema";
import { canUseFeature, getTierLimit } from "../../lib/commercialTiers";
import { exportTransactionsCsv, parseTransactionsCsv } from "../../lib/csv";
import { normalizeCategoryName, normalizeSubcategoryName } from "../../lib/categoryRegistry";
import { getAccountType, toDisplayAccountBalance } from "../../lib/accounts";
import { toPeriodKey } from "../../lib/dashboardAnalytics";
import { formatCurrency } from "../../lib/money";
import { useAppStore } from "../../stores/appStore";
import { TransactionForm, type TransactionFormValues } from "./TransactionForm";

export function TransactionsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { navigate } = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ledgerTransactions, setLedgerTransactions] = useState<Transaction[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [activeTransaction, setActiveTransaction] = useState<Transaction | undefined>();
  const [activeAccount, setActiveAccount] = useState<Account | undefined>();
  const [isFormOpen, setFormOpen] = useState(false);
  const [isAccountFormOpen, setAccountFormOpen] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const activePeriod = useAppStore((state) => state.activePeriod);
  const commercialTier = useAppStore((state) => state.commercialTier);

  useEffect(() => {
    void loadReferenceData();
  }, []);

  useEffect(() => {
    void refreshTransactions();
  }, []);

  async function loadReferenceData() {
    setErrorMessage("");
    try {
      const [nextAccounts, nextCategories, nextSubcategories] = await Promise.all([
        listAccounts(true),
        listCategories(true),
        listSubcategoriesIncludingArchived()
      ]);
      setAccounts(nextAccounts);
      setCategories(nextCategories);
      setSubcategories(nextSubcategories);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load transaction references.");
    }
  }

  async function refreshTransactions() {
    setLoading(true);
    setErrorMessage("");
    try {
      const [nextTransactions, nextLedgerTransactions, nextRecurringRules] = await Promise.all([listTransactionsByDate(20), listTransactions(), listRecurringRules()]);
      setTransactions(nextTransactions);
      setLedgerTransactions(nextLedgerTransactions);
      setRecurringRules(nextRecurringRules);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load transactions.");
    } finally {
      setLoading(false);
    }
  }

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const subcategoryById = useMemo(() => new Map(subcategories.map((subcategory) => [subcategory.id, subcategory])), [subcategories]);
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const activeAccounts = useMemo(() => accounts.filter((account) => !account.isArchived), [accounts]);
  const canExport = canUseFeature(commercialTier, "export_features");
  const canCreateRecurring = canUseFeature(commercialTier, "recurring_transactions");
  const canUseTransactions = canUseFeature(commercialTier, "transaction_tracker");
  const accountLimit = getTierLimit(commercialTier, "account_count");
  const hasReachedAccountLimit = Number.isFinite(accountLimit) && activeAccounts.length >= accountLimit;
  const activePeriodKey = toPeriodKey(activePeriod);
  const recurringTransactionIds = useMemo(() => recurringSourceTransactionIds(recurringRules, ledgerTransactions), [ledgerTransactions, recurringRules]);

  const summary = useMemo(() => {
    return ledgerTransactions
      .filter((transaction) => transaction.date.startsWith(activePeriodKey))
      .reduce(
      (total, transaction) => {
        if (transaction.type === "income") total.income += transaction.amount;
        if (transaction.type === "expense") total.expense += transaction.amount;
        if (transaction.type === "transfer") total.transfer += transaction.amount;
        return total;
      },
      { income: 0, expense: 0, transfer: 0 }
    );
  }, [activePeriodKey, ledgerTransactions]);

  if (!canUseTransactions) {
    return (
      <>
        <section>
          <p className="text-sm font-semibold text-sage">Fitur terkunci</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">Transaksi</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
            Pencatatan transaksi tersedia setelah aktivasi lisensi BASIC gratis dari website.
          </p>
        </section>
        <LockedFeature feature="transaction_tracker" />
      </>
    );
  }

  async function handleSubmit(values: TransactionFormValues) {
      const payload = {
      type: values.type,
      accountId: values.accountId,
      transferAccountId: values.transferAccountId,
      categoryId: values.categoryId,
      subcategoryId: values.subcategoryId,
      amount: values.amount,
      currency: "IDR" as const,
      date: values.date,
      merchant: values.merchant,
      note: values.note,
      tags: values.recurring ? uniqueTags([...values.tags, "transaksi-rutin"]) : values.tags,
      behavior: values.behavior,
      frequency: values.frequency,
      source: "manual" as const
    };

    if (activeTransaction) {
      await updateTransaction(activeTransaction.id, payload);
    } else {
      const createdTransaction = await createTransaction(payload);
      if (values.recurring && canCreateRecurring) {
        await createRecurringRule({
          name: values.merchant || categoryById.get(values.categoryId)?.name || "Transaksi rutin",
          sourceTransactionId: createdTransaction.id,
          transactionTemplate: {
            type: payload.type,
            accountId: payload.accountId,
            transferAccountId: payload.transferAccountId,
            categoryId: payload.categoryId,
            subcategoryId: payload.subcategoryId,
            amount: payload.amount,
            currency: payload.currency,
            merchant: payload.merchant,
            note: payload.note,
            tags: payload.tags,
            behavior: payload.behavior,
            frequency: payload.frequency
          },
          frequency: values.recurring.frequency,
          interval: values.recurring.interval,
          nextRunAt: getNextRecurringDate(values.date, values.recurring.frequency)
        });
      }
    }

    closeForm();
    await Promise.all([loadReferenceData(), refreshTransactions()]);
  }

  async function handleDelete(transaction: Transaction) {
    await deleteTransaction(transaction.id);
    await Promise.all([loadReferenceData(), refreshTransactions()]);
  }

  function openForm(transaction?: Transaction) {
    setActiveTransaction(transaction);
    setFormOpen(true);
  }

  function closeForm() {
    setActiveTransaction(undefined);
    setFormOpen(false);
  }

  function openAccountForm(account?: Account) {
    if (!account && hasReachedAccountLimit) {
      setErrorMessage(`BASIC gratis dibatasi ${accountLimit} akun aktif. Upgrade ke PRO atau ELITE untuk akun tanpa batas.`);
      return;
    }
    setActiveAccount(account);
    setAccountFormOpen(true);
  }

  function closeAccountForm() {
    setActiveAccount(undefined);
    setAccountFormOpen(false);
  }

  async function handleAccountSubmit(values: AccountFormValues) {
    if (activeAccount) {
      await updateAccount(activeAccount.id, values);
    } else {
      await createManualAccount(values);
    }
    closeAccountForm();
    await Promise.all([loadReferenceData(), refreshTransactions()]);
  }

  async function handleArchiveAccount(account: Account) {
    await archiveAccount(account.id);
    await loadReferenceData();
  }

  async function handleDeleteAccount(account: Account) {
    const linkCount = await getAccountLinkCount(account.id);
    if (linkCount > 0) {
      const shouldArchive = window.confirm(
        `${account.name} has ${linkCount} linked transaction(s). Delete is blocked to preserve history. Archive this account instead?`
      );
      if (!shouldArchive) return;
      await deleteAccount(account.id, { archiveIfLinked: true });
    } else {
      const shouldDelete = window.confirm(`Delete ${account.name}? This account has no linked transactions.`);
      if (!shouldDelete) return;
      await deleteAccount(account.id);
    }
    await loadReferenceData();
  }

  function handleExport() {
    if (!canExport) return;
    const csv = exportTransactionsCsv(ledgerTransactions, accounts, categories, subcategories);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `danapeta-transaksi-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    const csv = await file.text();
    const rows = parseTransactionsCsv(csv);
    const fallbackAccount = activeAccounts[0];
    if (!fallbackAccount) return;

    for (const row of rows) {
      const account = accounts.find((item) => item.name.toLowerCase() === row.accountName.toLowerCase()) ?? fallbackAccount;
      const normalizedCategory = normalizeCategoryName(row.categoryName);
      const category =
        row.categoryName.trim()
          ? categories.find((item) => normalizeCategoryName(item.name) === normalizedCategory && item.kind === row.type) ??
            (await getOrCreateCategory({
              name: row.categoryName,
              kind: row.type,
              defaultBehavior: row.behavior
            }))
          : undefined;
      const normalizedSubcategory = row.subcategoryName ? normalizeSubcategoryName(row.subcategoryName) : "";
      const subcategory =
        category && row.subcategoryName?.trim()
          ? subcategories.find(
              (item) =>
                item.categoryId === category.id &&
                normalizedSubcategory &&
                normalizeSubcategoryName(item.name) === normalizedSubcategory
            ) ??
            (await getOrCreateSubcategory({
              categoryId: category.id,
              name: row.subcategoryName,
              defaultBehavior: row.behavior ?? category.defaultBehavior
            }))
          : undefined;
      const transferAccount = row.transferAccountName
        ? accounts.find((item) => item.name.toLowerCase() === row.transferAccountName?.toLowerCase())
        : undefined;

      if (!category) continue;

      await createTransaction({
        type: row.type,
        accountId: account.id,
        transferAccountId: row.type === "transfer" ? transferAccount?.id : undefined,
        categoryId: category.id,
        subcategoryId: subcategory?.id,
        amount: row.amount,
        currency: "IDR",
        date: row.date,
        merchant: row.merchant,
        note: row.note,
        tags: ["import", ...row.tags],
        behavior: row.behavior ?? category.defaultBehavior,
        frequency: row.frequency ?? (category.defaultBehavior === "planned" ? "non_routine" : "routine"),
        source: "import"
      });
    }

    await Promise.all([loadReferenceData(), refreshTransactions()]);
  }

  return (
    <>
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-sage">Daily input engine</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">Transactions</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
            Add, import, export, and review your latest local ledger activity.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="secondary" icon={<ReceiptText size={17} aria-hidden="true" />} onClick={() => navigate("/transactions/explorer")}>
            Explorer
          </Button>
          <Button variant="secondary" icon={<Upload size={17} aria-hidden="true" />} onClick={() => fileInputRef.current?.click()}>
            Import
          </Button>
          <Button variant="secondary" icon={<Download size={17} aria-hidden="true" />} onClick={handleExport} disabled={!canExport}>
            Export
          </Button>
          <Button className="col-span-2" icon={<Plus size={18} aria-hidden="true" />} onClick={() => openForm()}>
            Add transaction
          </Button>
        </div>
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImport(file);
            event.currentTarget.value = "";
          }}
        />
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
        <Stat label="Income" value={formatCurrency(summary.income)} tone="sage" />
        <Stat label="Expense" value={formatCurrency(summary.expense)} tone="peach" />
        <Stat label="Transfer" value={formatCurrency(summary.transfer)} tone="sky" />
      </section>

      {isLoading && <LoadingState title="Loading transactions" body="Applying filters to the local ledger." />}
      {errorMessage && <ErrorState body={errorMessage} onRetry={() => void refreshTransactions()} />}

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.45fr]">
        <Card
          title="Local Balances"
          eyebrow="Accounts"
          action={
            <Button className="h-9 px-3" icon={<Plus size={16} aria-hidden="true" />} disabled={hasReachedAccountLimit} onClick={() => openAccountForm()}>
              Add
            </Button>
          }
        >
          {hasReachedAccountLimit && (
            <div className="mb-3 rounded-lg bg-muted p-3 text-sm leading-6 text-secondary">
              BASIC gratis mencakup 1 akun aktif. PRO dan ELITE membuka akun tanpa batas.
            </div>
          )}
          <div className="grid gap-2">
            {activeAccounts.map((account) => (
              <div
                key={account.id}
                className={`flex min-h-14 items-center justify-between rounded-lg px-3 ${
                  getAccountType(account) === "liability" ? "bg-peach/20" : "bg-muted"
                }`}
              >
                <button type="button" className="min-w-0 text-left" onClick={() => openAccountForm(account)}>
                  <span className="block text-sm font-semibold text-ink">{account.name}</span>
                  <span className="text-xs text-secondary">{account.type}</span>
                </button>
                <div className="flex items-center gap-2">
                  <AccountTypeBadge account={account} />
                  <Amount value={toDisplayAccountBalance(account)} className="text-sm" />
                  <Button variant="ghost" className="h-9 px-2 text-xs" onClick={() => void handleArchiveAccount(account)}>
                    Archive
                  </Button>
                  <Button variant="ghost" className="h-9 px-2 text-xs text-danger" onClick={() => void handleDeleteAccount(account)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {!isLoading && activeAccounts.length === 0 && <EmptyState title="No accounts yet" body="Akun lokal akan muncul di sini setelah dibuat." />}
          </div>
        </Card>

        <Card title="20 Latest Transactions" action={<span className="text-sm font-medium text-secondary">{transactions.length} rows</span>}>
          <div className="grid gap-2">
            {transactions.map((transaction) => {
              const category = categoryById.get(transaction.categoryId);
              const subcategory = transaction.subcategoryId ? subcategoryById.get(transaction.subcategoryId) : undefined;
              const signedAmount = transaction.type === "expense" || transaction.type === "transfer" ? -transaction.amount : transaction.amount;
              const categoryName = category?.name ?? "Unknown category";
              const title = transaction.merchant || transaction.note || subcategory?.name || categoryName || transaction.type;
              const detail = transaction.note && transaction.merchant ? transaction.note : subcategory?.name || categoryName || transaction.type;
              return (
                <article key={transaction.id} className="rounded-lg bg-muted/70 p-3">
                  <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => openForm(transaction)}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">{title}</span>
                      <span className="mt-1 block truncate text-xs font-medium text-ink/75">{detail}</span>
                      <span className="mt-1 block text-xs text-secondary">
                        {transaction.date} - {accountById.get(transaction.accountId)?.name}
                        {transaction.type === "transfer" && transaction.transferAccountId
                          ? ` to ${accountById.get(transaction.transferAccountId)?.name ?? "account"}`
                          : ""}
                      </span>
                    </span>
                    <Amount value={signedAmount} className="text-sm" />
                  </button>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {category ? (
                      <CategoryBadge label={category.name} color={category.color} />
                    ) : (
                      <span className="rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">Unknown category</span>
                    )}
                    {subcategory && <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-secondary">{subcategory.name}</span>}
                    {transaction.behavior && <BehaviorBadge behavior={transaction.behavior} />}
                    {recurringTransactionIds.has(transaction.id) && (
                      <span className="rounded-full bg-sky/25 px-2.5 py-1 text-xs font-semibold text-ink">Transaksi rutin</span>
                    )}
                    {transaction.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-secondary">
                        #{tag}
                      </span>
                    ))}
                    <button className="ml-auto min-h-8 px-2 text-xs font-semibold text-danger" onClick={() => void handleDelete(transaction)}>
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}

            {!isLoading && transactions.length === 0 && (
              <EmptyState title="No transactions yet" body="Add one manually or import a CSV to start the local ledger." />
            )}
          </div>
        </Card>
      </section>

      <Modal open={isFormOpen} title={activeTransaction ? "Edit transaction" : "Add transaction"} onClose={closeForm}>
        <TransactionForm
          accounts={accounts}
          categories={categories}
          subcategories={subcategories}
          transaction={activeTransaction}
          canCreateRecurring={canCreateRecurring}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      </Modal>

      <Modal open={isAccountFormOpen} title={activeAccount ? "Edit account" : "Add account"} onClose={closeAccountForm}>
        <AccountForm account={activeAccount} onSubmit={handleAccountSubmit} onCancel={closeAccountForm} />
      </Modal>

    </>
  );
}

type AccountFormValues = Pick<Account, "name" | "accountType" | "type" | "openingBalance" | "color" | "icon">;

function AccountForm({
  account,
  onSubmit,
  onCancel
}: {
  account?: Account;
  onSubmit: (values: AccountFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [accountType, setAccountType] = useState<Account["accountType"]>(account ? getAccountType(account) : "asset");
  const [type, setType] = useState<Account["type"]>(account?.type ?? "bank");
  const [openingBalance, setOpeningBalance] = useState(account ? String(Math.abs(account.openingBalance)) : "0");
  const [color, setColor] = useState(account?.color ?? "#88B99A");
  const [icon, setIcon] = useState(account?.icon ?? "landmark");

  useEffect(() => {
    if (accountType === "liability" && !["credit", "loan", "mortgage", "installment", "other"].includes(type)) {
      setType("loan");
    }
    if (accountType === "asset" && ["credit", "loan", "mortgage", "installment"].includes(type)) {
      setType("bank");
    }
  }, [accountType, type]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      name: name.trim(),
      accountType,
      type,
      openingBalance: Number(openingBalance || 0),
      color,
      icon: icon.trim() || "landmark"
    });
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <Field label="Account name">
        <Input required value={name} placeholder="Rekening Utama, Cash, Kartu Kredit" onChange={(event) => setName(event.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Account type">
          <Select value={accountType} onChange={(event) => setAccountType(event.target.value as Account["accountType"])}>
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
          </Select>
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(event) => setType(event.target.value as Account["type"])}>
            {accountType === "asset" ? (
              <>
                <option value="bank">Bank</option>
                <option value="cash">Cash</option>
                <option value="ewallet">E-wallet</option>
                <option value="savings">Savings</option>
                <option value="investment">Investment</option>
              </>
            ) : (
              <>
                <option value="credit">Credit card</option>
                <option value="loan">Personal loan</option>
                <option value="mortgage">Mortgage/KPR</option>
                <option value="installment">Vehicle/installment loan</option>
              </>
            )}
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field
          label={accountType === "liability" ? "Opening debt balance" : "Opening balance"}
          hint={account ? "Changing this adjusts current balance by the same delta." : accountType === "liability" ? "Masukkan nominal utang sebagai angka positif." : undefined}
        >
          <Input required type="number" inputMode="numeric" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Color">
          <Input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        </Field>
        <Field label="Icon">
          <Input value={icon} placeholder="landmark" onChange={(event) => setIcon(event.target.value)} />
        </Field>
      </div>
      <FormActions>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          Save account
        </Button>
      </FormActions>
    </form>
  );
}

function AccountTypeBadge({ account }: { account: Account }) {
  const accountType = getAccountType(account);
  const className = accountType === "liability" ? "bg-peach/30 text-ink" : "bg-mint/30 text-ink";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{accountType === "liability" ? "Liability" : "Asset"}</span>;
}

function recurringSourceTransactionIds(rules: RecurringRule[], transactions: Transaction[]) {
  const ids = new Set<string>();
  rules.forEach((rule) => {
    if (rule.sourceTransactionId) {
      ids.add(rule.sourceTransactionId);
      return;
    }
    const sourceTransaction = transactions.find((transaction) => isRuleSourceTransaction(rule, transaction));
    if (sourceTransaction) ids.add(sourceTransaction.id);
  });
  return ids;
}

function uniqueTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

function getNextRecurringDate(dateValue: string, frequency: "daily" | "weekly" | "monthly" | "yearly") {
  const date = new Date(`${dateValue}T00:00:00`);
  if (frequency === "daily") date.setDate(date.getDate() + 1);
  if (frequency === "weekly") date.setDate(date.getDate() + 7);
  if (frequency === "monthly") date.setMonth(date.getMonth() + 1);
  if (frequency === "yearly") date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}
