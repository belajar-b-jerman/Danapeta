import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Account, Category, SpendingBehavior, SpendingFrequency, Subcategory, Transaction } from "../../db/schema";
import { Button } from "../../components/ui/Button";
import { Field, FormActions, Input, Select, Textarea } from "../../components/ui/Form";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { toIsoDateInputValue } from "../../lib/dates";
import { normalizeCategoryName, normalizeSubcategoryName } from "../../lib/categoryRegistry";

export type TransactionFormValues = {
  type: Transaction["type"];
  amount: number;
  accountId: string;
  transferAccountId?: string;
  categoryId: string;
  subcategoryId?: string;
  date: string;
  merchant?: string;
  note?: string;
  tags: string[];
  behavior?: SpendingBehavior;
  frequency?: SpendingFrequency;
  recurring?: {
    frequency: "daily" | "weekly" | "monthly" | "yearly";
    interval: number;
  };
};

type TransactionFormProps = {
  accounts: Account[];
  categories: Category[];
  subcategories: Subcategory[];
  transaction?: Transaction;
  canCreateRecurring?: boolean;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
  onCancel: () => void;
};

const typeOptions = [
  { label: "Expense", value: "expense" },
  { label: "Income", value: "income" },
  { label: "Transfer", value: "transfer" }
] satisfies Array<{ label: string; value: Transaction["type"] }>;

export function TransactionForm({ accounts, categories, subcategories, transaction, canCreateRecurring = true, onSubmit, onCancel }: TransactionFormProps) {
  const defaultAccount = accounts.find((account) => !account.isArchived) ?? accounts[0];
  const [type, setType] = useState<Transaction["type"]>(transaction?.type ?? "expense");
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [accountId, setAccountId] = useState(transaction?.accountId ?? defaultAccount?.id ?? "");
  const [transferAccountId, setTransferAccountId] = useState(
    transaction?.transferAccountId ?? accounts.find((account) => !account.isArchived && account.id !== defaultAccount?.id)?.id ?? ""
  );
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
  const [subcategoryId, setSubcategoryId] = useState(transaction?.subcategoryId ?? "");
  const [date, setDate] = useState(transaction?.date ?? toIsoDateInputValue());
  const [merchant, setMerchant] = useState(transaction?.merchant ?? "");
  const [note, setNote] = useState(transaction?.note ?? "");
  const [tags, setTags] = useState(transaction?.tags.join(", ") ?? "");
  const [behavior, setBehavior] = useState<SpendingBehavior>(transaction?.behavior ?? "variable");
  const [frequency, setFrequency] = useState<SpendingFrequency>(transaction?.frequency ?? "routine");
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [isSubmitting, setSubmitting] = useState(false);

  const availableCategories = useMemo(
    () => uniqueCategories(categories).filter((category) => category.kind === type && (!category.isArchived || category.id === transaction?.categoryId)),
    [categories, transaction?.categoryId, type]
  );
  const availableSubcategories = useMemo(
    () =>
      uniqueSubcategories(subcategories).filter(
        (subcategory) =>
          subcategory.categoryId === categoryId && (!subcategory.isArchived || subcategory.id === transaction?.subcategoryId)
      ),
    [categoryId, subcategories, transaction?.subcategoryId]
  );
  const availableAccounts = useMemo(
    () => accounts.filter((account) => !account.isArchived || account.id === transaction?.accountId || account.id === transaction?.transferAccountId),
    [accounts, transaction?.accountId, transaction?.transferAccountId]
  );

  useEffect(() => {
    if (categoryId && !availableCategories.some((category) => category.id === categoryId)) {
      setCategoryId("");
    }
  }, [availableCategories, categoryId]);

  useEffect(() => {
    if (subcategoryId && !availableSubcategories.some((subcategory) => subcategory.id === subcategoryId)) {
      setSubcategoryId("");
    }
  }, [availableSubcategories, subcategoryId]);

  useEffect(() => {
    if (type !== "transfer" || !accountId || transferAccountId !== accountId) return;
    setTransferAccountId(availableAccounts.find((account) => account.id !== accountId)?.id ?? "");
  }, [accountId, availableAccounts, transferAccountId, type]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await onSubmit({
        type,
        amount: Math.abs(Number(amount)),
        accountId,
        transferAccountId: type === "transfer" ? transferAccountId : undefined,
        categoryId,
        subcategoryId,
        date,
        merchant: merchant.trim() || undefined,
        note: note.trim() || undefined,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        behavior,
        frequency,
        recurring:
          recurringEnabled && !transaction
            ? {
                frequency: recurringFrequency,
                interval: 1
              }
            : undefined
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <SegmentedControl value={type} options={typeOptions} onChange={setType} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount">
          <Input
            inputMode="numeric"
            min="0"
            required
            type="number"
            placeholder="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label="Date">
          <Input required type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={type === "transfer" ? "From account" : "Account"}>
          <Select required value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            {availableAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </Field>
        {type === "transfer" ? (
          <Field label="To account">
            <Select required value={transferAccountId} onChange={(event) => setTransferAccountId(event.target.value)}>
              {availableAccounts
                .filter((account) => account.id !== accountId)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </Select>
          </Field>
        ) : (
          <Field label="Merchant / source">
            <Input value={merchant} placeholder="Optional" onChange={(event) => setMerchant(event.target.value)} />
          </Field>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category">
          <Select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Pilih kategori</option>
            {transaction?.categoryId && !availableCategories.some((category) => category.id === transaction.categoryId) && (
              <option value={transaction.categoryId}>Unknown category</option>
            )}
            {availableCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Subcategory">
          <Select value={subcategoryId} onChange={(event) => setSubcategoryId(event.target.value)}>
            <option value="">Tanpa subkategori</option>
            {transaction?.subcategoryId && !availableSubcategories.some((subcategory) => subcategory.id === transaction.subcategoryId) && (
              <option value={transaction.subcategoryId}>Unknown subcategory</option>
            )}
            {availableSubcategories.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>
                {subcategory.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Behavior">
          <Select value={behavior} onChange={(event) => setBehavior(event.target.value as SpendingBehavior)}>
            <option value="fixed">Tetap</option>
            <option value="variable">Variabel</option>
            <option value="planned">Direncanakan</option>
            <option value="impulse">Impulsif</option>
            <option value="mandatory">Wajib</option>
          </Select>
        </Field>
        <Field label="Frequency">
          <Select value={frequency} onChange={(event) => setFrequency(event.target.value as SpendingFrequency)}>
            <option value="routine">Rutin</option>
            <option value="non_routine">Non-rutin</option>
          </Select>
        </Field>
      </div>

      <Field label="Tags">
        <Input value={tags} placeholder="food, routine" onChange={(event) => setTags(event.target.value)} />
      </Field>

      <Field label="Notes">
        <Textarea value={note} placeholder="Optional private note" onChange={(event) => setNote(event.target.value)} />
      </Field>

      {!transaction && canCreateRecurring && (
        <div className="rounded-lg bg-muted p-3">
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className="h-5 w-5 accent-sage"
              checked={recurringEnabled}
              onChange={(event) => setRecurringEnabled(event.target.checked)}
            />
            Jadikan transaksi rutin
          </label>
          {recurringEnabled && (
            <div className="mt-3">
              <Field label="Ulangi">
                <Select
                  value={recurringFrequency}
                  onChange={(event) => setRecurringFrequency(event.target.value as "daily" | "weekly" | "monthly" | "yearly")}
                >
                  <option value="daily">Harian</option>
                  <option value="weekly">Mingguan</option>
                  <option value="monthly">Bulanan</option>
                  <option value="yearly">Tahunan</option>
                </Select>
              </Field>
            </div>
          )}
        </div>
      )}

      <FormActions>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !amount || !accountId || !categoryId || (type === "transfer" && !transferAccountId)}>
          {transaction ? "Save transaction" : "Add transaction"}
        </Button>
      </FormActions>
    </form>
  );
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
