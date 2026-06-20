import { ArrowDownAZ, CalendarDays, Filter, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Amount } from "../../components/finance/Amount";
import { BehaviorBadge } from "../../components/finance/BehaviorBadge";
import { CategoryBadge } from "../../components/finance/CategoryBadge";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/AppState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { LockedFeature } from "../../components/finance/FeatureGate";
import { Field, Input, Select } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import { useRouter } from "../../app/router";
import { listAccounts } from "../../db/repositories/accountRepository";
import { listCategories, listSubcategoriesIncludingArchived } from "../../db/repositories/categoryRepository";
import { createRecurringRule, isRuleSourceTransaction, listRecurringRules } from "../../db/repositories/recurringRepository";
import { createTransaction, deleteTransaction, listTransactions, updateTransaction } from "../../db/repositories/transactionRepository";
import type { Account, Category, RecurringRule, SpendingBehavior, SpendingFrequency, Subcategory, Transaction } from "../../db/schema";
import { canUseFeature } from "../../lib/commercialTiers";
import { normalizeCategoryName, normalizeSubcategoryName } from "../../lib/categoryRegistry";
import { formatCurrency } from "../../lib/money";
import { toSlug } from "../../lib/slug";
import { useAppStore } from "../../stores/appStore";
import { TransactionForm, type TransactionFormValues } from "./TransactionForm";

type SortOption = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

const behaviorLabels: Record<SpendingBehavior, string> = {
  fixed: "Tetap",
  variable: "Variabel",
  planned: "Direncanakan",
  impulse: "Impulsif",
  mandatory: "Wajib"
};

const frequencyLabels: Record<SpendingFrequency, string> = {
  routine: "Rutin",
  non_routine: "Non-rutin"
};

export function TransactionExplorerPage() {
  const { navigate, search } = useRouter();
  const query = useMemo(() => new URLSearchParams(search), [search]);
  const commercialTier = useAppStore((state) => state.commercialTier);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [month, setMonth] = useState(query.get("month") ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [behavior, setBehavior] = useState<SpendingBehavior | "">("");
  const [frequency, setFrequency] = useState<SpendingFrequency | "">("");
  const [dateFrom, setDateFrom] = useState(query.get("dateFrom") ?? "");
  const [dateTo, setDateTo] = useState(query.get("dateTo") ?? "");
  const [tag, setTag] = useState(query.get("tag") ?? "");
  const [recurringOnly, setRecurringOnly] = useState(query.get("recurring") === "1");
  const [searchTerm, setSearchTerm] = useState(query.get("q") ?? "");
  const [sort, setSort] = useState<SortOption>("date-desc");
  const [activeTransaction, setActiveTransaction] = useState<Transaction | undefined>();
  const [isFormOpen, setFormOpen] = useState(false);
  const [restoreScrollY, setRestoreScrollY] = useState<number | undefined>();
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const canCreateRecurring = canUseFeature(commercialTier, "recurring_transactions");
  const canUseTransactions = canUseFeature(commercialTier, "transaction_tracker");

  useEffect(() => {
    void loadExplorerData();
  }, []);

  useEffect(() => {
    const categoryParam = query.get("category") ?? "";
    const subcategoryParam = query.get("subcategory") ?? "";
    const behaviorParam = query.get("behavior") ?? "";
    const frequencyParam = query.get("frequency") ?? "";
    const sortParam = query.get("sort") ?? "";
    const merchantParam = query.get("merchant") ?? "";
    const tagParam = query.get("tag") ?? "";
    const searchParam = query.get("q") ?? merchantParam;
    const matchedCategory = resolveCategoryFromQuery(categoryParam, categories, transactions, query.get("month") ?? "");
    const matchedSubcategory = subcategories.find(
      (subcategory) =>
        matchesQueryValue(subcategoryParam, subcategory.id, subcategory.name) &&
        (!matchedCategory || subcategory.categoryId === matchedCategory.id)
    );

    setCategoryId(matchedCategory?.id ?? "");
    setSubcategoryId(matchedSubcategory?.id ?? "");
    setMonth(query.get("month") ?? "");
    setBehavior(isSpendingBehavior(behaviorParam) ? behaviorParam : "");
    setFrequency(isSpendingFrequency(frequencyParam) ? frequencyParam : "");
    setDateFrom(query.get("dateFrom") ?? "");
    setDateTo(query.get("dateTo") ?? "");
    setTag(tagParam);
    setRecurringOnly(query.get("recurring") === "1");
    setSearchTerm(searchParam);
    setSort(isSortOption(sortParam) ? sortParam : "date-desc");
  }, [categories, query, subcategories, transactions]);

  async function loadExplorerData() {
    setLoading(true);
    setErrorMessage("");
    try {
      const [nextAccounts, nextCategories, nextSubcategories, nextTransactions, nextRecurringRules] = await Promise.all([
        listAccounts(true),
        listCategories(true),
        listSubcategoriesIncludingArchived(),
        listTransactions(),
        listRecurringRules()
      ]);
      setAccounts(nextAccounts);
      setCategories(nextCategories);
      setSubcategories(nextSubcategories);
      setTransactions(nextTransactions);
      setRecurringRules(nextRecurringRules);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load transaction explorer.");
    } finally {
      setLoading(false);
    }
  }

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const subcategoryById = useMemo(() => new Map(subcategories.map((subcategory) => [subcategory.id, subcategory])), [subcategories]);
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const uniqueCategoryOptions = useMemo(() => uniqueCategories(categories), [categories]);
  const uniqueSubcategoryOptions = useMemo(() => uniqueSubcategories(subcategories), [subcategories]);
  const categoryFilterIds = useMemo(() => equivalentCategoryIds(categoryId, categories), [categories, categoryId]);
  const availableSubcategories = useMemo(
    () =>
      uniqueSubcategoryOptions.filter(
        (subcategory) =>
          (!categoryId || categoryFilterIds.has(subcategory.categoryId)) &&
          (!subcategory.isArchived || subcategory.id === subcategoryId)
      ),
    [categoryFilterIds, categoryId, subcategoryId, uniqueSubcategoryOptions]
  );
  const availableCategories = useMemo(
    () => includeSelectedCategory(uniqueCategoryOptions.filter((category) => !category.isArchived || category.id === categoryId), categoryById.get(categoryId)),
    [categoryById, categoryId, uniqueCategoryOptions]
  );
  const monthOptions = useMemo(() => {
    const months = Array.from(new Set(transactions.map((transaction) => transaction.date.slice(0, 7))));
    return months.sort((left, right) => right.localeCompare(left));
  }, [transactions]);
  const recurringTransactionIds = useMemo(() => recurringSourceTransactionIds(recurringRules, transactions), [recurringRules, transactions]);

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return transactions
      .filter((transaction) => {
        if (month && !transaction.date.startsWith(month)) return false;
        if (categoryId && !categoryFilterIds.has(transaction.categoryId)) return false;
        if (subcategoryId && transaction.subcategoryId !== subcategoryId) return false;
        if (behavior && transaction.behavior !== behavior) return false;
        if (frequency && transaction.frequency !== frequency) return false;
        if (dateFrom && transaction.date < dateFrom) return false;
        if (dateTo && transaction.date > dateTo) return false;
        if (tag && !transaction.tags.map((item) => item.toLowerCase()).includes(tag.toLowerCase())) return false;
        if (recurringOnly && !recurringTransactionIds.has(transaction.id)) return false;
        if (normalizedSearch && !matchesTransactionSearch(transaction, normalizedSearch, categoryById, subcategoryById, accountById)) return false;
        return true;
      })
      .sort((left, right) => {
        if (sort === "date-asc") return left.date.localeCompare(right.date);
        if (sort === "amount-desc") return right.amount - left.amount;
        if (sort === "amount-asc") return left.amount - right.amount;
        return right.date.localeCompare(left.date);
      });
  }, [accountById, behavior, categoryById, categoryFilterIds, categoryId, dateFrom, dateTo, frequency, month, recurringOnly, recurringTransactionIds, searchTerm, sort, subcategoryById, subcategoryId, tag, transactions]);

  const activeFilters = [
    month ? `Bulan ${month}` : "",
    dateFrom ? `Dari ${dateFrom}` : "",
    dateTo ? `Sampai ${dateTo}` : "",
    categoryId ? categoryById.get(categoryId)?.name : "",
    subcategoryId ? subcategoryById.get(subcategoryId)?.name : "",
    behavior ? behaviorLabels[behavior] : "",
    frequency ? frequencyLabels[frequency] : "",
    tag ? `Tag ${tag}` : "",
    recurringOnly ? "Transaksi rutin" : "",
    searchTerm ? `Cari "${searchTerm}"` : ""
  ].filter(Boolean);

  const totalExpense = filteredTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0);

  if (!canUseTransactions) {
    return (
      <>
        <section>
          <p className="text-sm font-semibold text-sage">Fitur terkunci</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">Explorer</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
            Explorer transaksi tersedia setelah aktivasi lisensi BASIC gratis dari website.
          </p>
        </section>
        <LockedFeature feature="transaction_tracker" />
      </>
    );
  }

  function resetFilters() {
    setMonth("");
    setCategoryId("");
    setSubcategoryId("");
    setBehavior("");
    setFrequency("");
    setDateFrom("");
    setDateTo("");
    setTag("");
    setSearchTerm("");
    setSort("date-desc");
    navigate("/transactions/explorer");
  }

  function updateFilters(next: Partial<{ month: string; categoryId: string; subcategoryId: string; behavior: SpendingBehavior | ""; frequency: SpendingFrequency | ""; dateFrom: string; dateTo: string; tag: string; searchTerm: string; sort: SortOption }>) {
    const nextMonth = next.month ?? month;
    const nextCategoryId = next.categoryId ?? categoryId;
    const nextSubcategoryId = next.subcategoryId ?? subcategoryId;
    const nextBehavior = next.behavior ?? behavior;
    const nextFrequency = next.frequency ?? frequency;
    const nextDateFrom = next.dateFrom ?? dateFrom;
    const nextDateTo = next.dateTo ?? dateTo;
    const nextTag = next.tag ?? tag;
    const nextSearchTerm = next.searchTerm ?? searchTerm;
    const nextSort = next.sort ?? sort;

    setMonth(nextMonth);
    setCategoryId(nextCategoryId);
    setSubcategoryId(nextSubcategoryId);
    setBehavior(nextBehavior);
    setFrequency(nextFrequency);
    setDateFrom(nextDateFrom);
    setDateTo(nextDateTo);
    setTag(nextTag);
    setSearchTerm(nextSearchTerm);
    setSort(nextSort);

    const params = new URLSearchParams();
    const nextCategory = categories.find((category) => category.id === nextCategoryId);
    const nextSubcategory = subcategories.find((subcategory) => subcategory.id === nextSubcategoryId);

    if (nextMonth) params.set("month", nextMonth);
    if (nextCategory) params.set("category", nextCategory.id);
    if (nextSubcategory) params.set("subcategory", nextSubcategory.id);
    if (nextBehavior) params.set("behavior", nextBehavior);
    if (nextFrequency) params.set("frequency", nextFrequency);
    if (nextDateFrom) params.set("dateFrom", nextDateFrom);
    if (nextDateTo) params.set("dateTo", nextDateTo);
    if (nextTag.trim()) params.set("tag", nextTag.trim());
    if (nextSearchTerm.trim()) params.set("q", nextSearchTerm.trim());
    if (nextSort !== "date-desc") params.set("sort", nextSort);

    const nextQuery = params.toString();
    navigate(`/transactions/explorer${nextQuery ? `?${nextQuery}` : ""}`);
  }

  function openForm(transaction?: Transaction) {
    setRestoreScrollY(window.scrollY);
    setActiveTransaction(transaction);
    setFormOpen(true);
  }

  function closeForm() {
    setActiveTransaction(undefined);
    setFormOpen(false);
    restoreScrollPosition();
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
      source: activeTransaction?.source ?? ("manual" as const)
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
    setFormOpen(false);
    setActiveTransaction(undefined);
    await loadExplorerData();
    restoreScrollPosition();
  }

  async function handleDelete(transaction: Transaction) {
    setRestoreScrollY(window.scrollY);
    await deleteTransaction(transaction.id);
    await loadExplorerData();
    restoreScrollPosition();
  }

  function restoreScrollPosition() {
    const nextScrollY = restoreScrollY;
    if (nextScrollY === undefined) return;
    window.requestAnimationFrame(() => window.scrollTo({ top: nextScrollY }));
    setRestoreScrollY(undefined);
  }

  return (
    <>
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-sage">Transaction explorer</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">Full Transaction History</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
            Browse transaksi lengkap dengan search lokal untuk title, kategori, subkategori, notes, behavior, dan frequency.
          </p>
        </div>
        <Button icon={<Plus size={17} aria-hidden="true" />} onClick={() => openForm()}>
          Add transaction
        </Button>
      </section>

      {isLoading && <LoadingState title="Loading explorer" body="Reading the local transaction history." />}
      {errorMessage && <ErrorState body={errorMessage} onRetry={() => void loadExplorerData()} />}

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink">Filters</span>
          <Button variant="ghost" className="h-9 px-3" icon={<Filter size={16} aria-hidden="true" />} onClick={resetFilters}>
            Reset
          </Button>
        </div>
        <div className="mb-3">
          <Field label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={16} aria-hidden="true" />
              <Input
                className="pl-9"
                value={searchTerm}
                placeholder="Cari title, kategori, subkategori, notes"
                onChange={(event) => updateFilters({ searchTerm: event.target.value })}
              />
            </div>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Field label="Bulan">
            <Select value={month} onChange={(event) => updateFilters({ month: event.target.value })}>
              <option value="">Semua bulan</option>
              {monthOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kategori">
            <Select
              value={categoryId}
              onChange={(event) => {
                updateFilters({ categoryId: event.target.value, subcategoryId: "" });
              }}
            >
              <option value="">Semua kategori</option>
              {availableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subkategori">
            <Select value={subcategoryId} onChange={(event) => updateFilters({ subcategoryId: event.target.value })}>
              <option value="">Semua subkategori</option>
              {availableSubcategories.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Behavior">
            <Select value={behavior} onChange={(event) => updateFilters({ behavior: event.target.value as SpendingBehavior | "" })}>
              <option value="">Semua behavior</option>
              {Object.entries(behaviorLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Frequency">
            <Select value={frequency} onChange={(event) => updateFilters({ frequency: event.target.value as SpendingFrequency | "" })}>
              <option value="">Semua frequency</option>
              {Object.entries(frequencyLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dari tanggal">
            <Input type="date" value={dateFrom} onChange={(event) => updateFilters({ dateFrom: event.target.value })} />
          </Field>
          <Field label="Sampai tanggal">
            <Input type="date" value={dateTo} onChange={(event) => updateFilters({ dateTo: event.target.value })} />
          </Field>
          <Field label="Tag">
            <Input value={tag} placeholder="goal-contribution" onChange={(event) => updateFilters({ tag: event.target.value })} />
          </Field>
          <Field label="Sort">
            <Select value={sort} onChange={(event) => updateFilters({ sort: event.target.value as SortOption })}>
              <option value="date-desc">Tanggal terbaru</option>
              <option value="date-asc">Tanggal terlama</option>
              <option value="amount-desc">Nominal terbesar</option>
              <option value="amount-asc">Nominal terkecil</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card
        title="Active Filter Summary"
        action={<span className="text-sm font-medium text-secondary">{filteredTransactions.length} rows</span>}
      >
        <div className="flex flex-wrap gap-2">
          {activeFilters.length > 0 ? activeFilters.map((label) => (
            <span key={label} className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-secondary">
              {label}
            </span>
          )) : <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-secondary">Tidak ada filter aktif</span>}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SummaryTile icon={<CalendarDays size={18} aria-hidden="true" />} label="Expense terfilter" value={formatCurrency(totalExpense)} />
          <SummaryTile icon={<ArrowDownAZ size={18} aria-hidden="true" />} label="Sorting" value={sortLabel(sort)} />
        </div>
      </Card>

      <section className="grid gap-2">
        {filteredTransactions.map((transaction) => {
          const category = categoryById.get(transaction.categoryId);
          const subcategory = transaction.subcategoryId ? subcategoryById.get(transaction.subcategoryId) : undefined;
          const account = accountById.get(transaction.accountId);
          const signedAmount = transaction.type === "expense" || transaction.type === "transfer" ? -transaction.amount : transaction.amount;
          const categoryName = category?.name ?? "Unknown category";
          const title = transaction.merchant || transaction.note || subcategory?.name || categoryName || transaction.type;
          const detail = transaction.note && transaction.merchant ? transaction.note : subcategory?.name || categoryName || transaction.type;
          return (
            <article key={transaction.id} className="rounded-lg bg-surface p-3 shadow-soft">
              <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => openForm(transaction)}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-ink">{title}</span>
                  <span className="mt-1 block truncate text-xs font-medium text-ink/75">{detail}</span>
                  <span className="mt-1 block text-xs text-secondary">
                    {transaction.date} - {account?.name ?? "Unknown account"}
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
                {subcategory && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-secondary">{subcategory.name}</span>}
                {transaction.behavior && <BehaviorBadge behavior={transaction.behavior} />}
                {transaction.frequency && (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-secondary">
                    {frequencyLabels[transaction.frequency]}
                  </span>
                )}
                {recurringTransactionIds.has(transaction.id) && (
                  <span className="rounded-full bg-sky/25 px-2.5 py-1 text-xs font-semibold text-ink">Transaksi rutin</span>
                )}
                <Button variant="ghost" className="ml-auto h-8 px-2 text-xs" onClick={() => openForm(transaction)}>
                  Edit
                </Button>
                <Button variant="ghost" className="h-8 px-2 text-xs text-danger" onClick={() => void handleDelete(transaction)}>
                  Delete
                </Button>
              </div>
            </article>
          );
        })}

        {!isLoading && filteredTransactions.length === 0 && (
          <EmptyState title="No matching transactions" body="Ubah filter atau kata kunci untuk melihat transaksi lain dari ledger lokal." />
        )}
      </section>

      <Modal open={isFormOpen} title={activeTransaction ? "Edit transaction" : "Add transaction"} onClose={closeForm}>
        <TransactionForm
          accounts={accounts}
          categories={categories}
          subcategories={subcategories}
          transaction={activeTransaction}
          canCreateRecurring={!activeTransaction && canCreateRecurring}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      </Modal>
    </>
  );
}

function SummaryTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-lg bg-muted/70 px-3">
      <span className="flex items-center gap-2 text-sm font-semibold text-ink">
        {icon}
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums text-ink">{value}</span>
    </div>
  );
}

function sortLabel(sort: SortOption) {
  if (sort === "date-asc") return "Tanggal terlama";
  if (sort === "amount-desc") return "Nominal terbesar";
  if (sort === "amount-asc") return "Nominal terkecil";
  return "Tanggal terbaru";
}

function getNextRecurringDate(dateValue: string, frequency: "daily" | "weekly" | "monthly" | "yearly") {
  const date = new Date(`${dateValue}T00:00:00`);
  if (frequency === "daily") date.setDate(date.getDate() + 1);
  if (frequency === "weekly") date.setDate(date.getDate() + 7);
  if (frequency === "monthly") date.setMonth(date.getMonth() + 1);
  if (frequency === "yearly") date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function matchesQueryValue(queryValue: string, id: string, name: string) {
  return Boolean(queryValue) && (queryValue === id || queryValue === toSlug(name));
}

function resolveCategoryFromQuery(queryValue: string, categories: Category[], transactions: Transaction[], month: string) {
  if (!queryValue) return undefined;
  const exact = categories.find((category) => category.id === queryValue);
  if (exact) return exact;

  const candidates = categories.filter((category) => matchesQueryValue(queryValue, category.id, category.name));
  if (candidates.length <= 1) return candidates[0];

  return candidates
    .map((category) => ({
      category,
      transactionCount: transactions.filter((transaction) => {
        if (transaction.categoryId !== category.id) return false;
        if (month && !transaction.date.startsWith(month)) return false;
        return true;
      }).length
    }))
    .sort((left, right) => {
      if (right.transactionCount !== left.transactionCount) return right.transactionCount - left.transactionCount;
      if (left.category.isArchived !== right.category.isArchived) return left.category.isArchived ? 1 : -1;
      return left.category.sortOrder - right.category.sortOrder;
    })[0]?.category;
}

function equivalentCategoryIds(categoryId: string, categories: Category[]) {
  const selected = categories.find((category) => category.id === categoryId);
  if (!selected) return new Set(categoryId ? [categoryId] : []);
  const normalizedName = normalizeCategoryName(selected.name);
  return new Set(
    categories
      .filter((category) => category.kind === selected.kind && normalizeCategoryName(category.name) === normalizedName)
      .map((category) => category.id)
  );
}

function includeSelectedCategory(options: Category[], selected?: Category) {
  if (!selected || options.some((category) => category.id === selected.id)) return options;
  return [...options, selected].sort((left, right) => left.sortOrder - right.sortOrder);
}

function matchesTransactionSearch(
  transaction: Transaction,
  search: string,
  categoryById: Map<string, Category>,
  subcategoryById: Map<string, Subcategory>,
  accountById: Map<string, Account>
) {
  const category = categoryById.get(transaction.categoryId);
  const subcategory = transaction.subcategoryId ? subcategoryById.get(transaction.subcategoryId) : undefined;
  const account = accountById.get(transaction.accountId);
  const transferAccount = transaction.transferAccountId ? accountById.get(transaction.transferAccountId) : undefined;
  const haystack = [
    transaction.merchant,
    transaction.note,
    transaction.tags.join(" "),
    category?.name ?? "Unknown category",
    subcategory?.name,
    account?.name ?? "Unknown account",
    transferAccount?.name,
    transaction.type,
    transaction.behavior,
    transaction.frequency
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

function uniqueCategories(categories: Category[]) {
  const byKey = new Map<string, Category>();
  categories.forEach((category) => {
    const key = `${category.kind}:${normalizeCategoryName(category.name)}`;
    const existing = byKey.get(key);
    if (!existing || (existing.isArchived && !category.isArchived)) byKey.set(key, category);
  });
  return Array.from(byKey.values()).sort((left, right) => left.sortOrder - right.sortOrder);
}

function uniqueSubcategories(subcategories: Subcategory[]) {
  const byKey = new Map<string, Subcategory>();
  subcategories.forEach((subcategory) => {
    const key = `${subcategory.categoryId}:${normalizeSubcategoryName(subcategory.name)}`;
    const existing = byKey.get(key);
    if (!existing || (existing.isArchived && !subcategory.isArchived)) byKey.set(key, subcategory);
  });
  return Array.from(byKey.values()).sort((left, right) => left.sortOrder - right.sortOrder);
}

function isSpendingBehavior(value: string): value is SpendingBehavior {
  return ["fixed", "variable", "planned", "impulse", "mandatory"].includes(value);
}

function isSpendingFrequency(value: string): value is SpendingFrequency {
  return ["routine", "non_routine"].includes(value);
}

function isSortOption(value: string): value is SortOption {
  return ["date-desc", "date-asc", "amount-desc", "amount-asc"].includes(value);
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
