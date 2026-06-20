import { AlertTriangle, Plus, Repeat, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BehaviorBadge } from "../../components/finance/BehaviorBadge";
import { BudgetProgress } from "../../components/finance/BudgetProgress";
import { LockedFeature } from "../../components/finance/FeatureGate";
import { HelpModalButton } from "../../components/finance/HelpModal";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/AppState";
import { Field, FormActions, Input, Select } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Stat } from "../../components/ui/Stat";
import { listCategories, listSubcategories } from "../../db/repositories/categoryRepository";
import {
  createBudget,
  deleteBudget,
  getExpenseBehaviorTotals,
  listBudgetSummaries,
  updateBudget,
  type BudgetSummary
} from "../../db/repositories/budgetRepository";
import type { Category, SpendingBehavior, Subcategory } from "../../db/schema";
import { canUseFeature } from "../../lib/commercialTiers";
import { toPeriodKey } from "../../lib/dashboardAnalytics";
import { formatCurrency } from "../../lib/money";
import { useAppStore } from "../../stores/appStore";

const warningStyles: Record<BudgetSummary["warningStatus"], string> = {
  healthy: "bg-mint/30 text-ink",
  watch: "bg-sky/25 text-ink",
  warning: "bg-peach/30 text-ink",
  critical: "bg-danger/15 text-ink"
};

export function BudgetsPage() {
  const activePeriod = useAppStore((state) => state.activePeriod);
  const commercialTier = useAppStore((state) => state.commercialTier);
  const period = useMemo(() => toPeriodKey(activePeriod), [activePeriod]);
  const canUseBudgets = canUseFeature(commercialTier, "monthly_budgeting");
  const [budgets, setBudgets] = useState<BudgetSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [behaviorTotals, setBehaviorTotals] = useState<Record<SpendingBehavior | "unlabeled", number>>({
    fixed: 0,
    variable: 0,
    planned: 0,
    impulse: 0,
    mandatory: 0,
    unlabeled: 0
  });
  const [activeBudget, setActiveBudget] = useState<BudgetSummary | undefined>();
  const [isFormOpen, setFormOpen] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!canUseBudgets) return;
    void loadBudgetData();
  }, [canUseBudgets, period]);

  async function loadBudgetData() {
    setLoading(true);
    setErrorMessage("");
    try {
      const [nextBudgets, nextCategories, nextSubcategories, nextBehaviorTotals] = await Promise.all([
        listBudgetSummaries(period),
        listCategories(),
        listSubcategories(),
        getExpenseBehaviorTotals(period)
      ]);
      setBudgets(nextBudgets);
      setCategories(nextCategories.filter((category) => category.kind === "expense"));
      setSubcategories(nextSubcategories);
      setBehaviorTotals(nextBehaviorTotals);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load budgets.");
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    return budgets.reduce(
      (summary, budget) => {
        summary.limit += budget.effectiveLimit;
        summary.spent += budget.spent;
        summary.remaining += budget.remaining;
        if (budget.warningStatus === "warning" || budget.warningStatus === "critical") summary.warnings += 1;
        return summary;
      },
      { limit: 0, spent: 0, remaining: 0, warnings: 0 }
    );
  }, [budgets]);

  function openForm(budget?: BudgetSummary) {
    setActiveBudget(budget);
    setFormOpen(true);
  }

  function closeForm() {
    setActiveBudget(undefined);
    setFormOpen(false);
  }

  async function handleSubmit(values: BudgetFormValues) {
    if (activeBudget) {
      await updateBudget(activeBudget.id, values);
    } else {
      await createBudget(values);
    }
    closeForm();
    await loadBudgetData();
  }

  async function handleDeleteBudget(budget: BudgetSummary) {
    await deleteBudget(budget.id);
    closeForm();
    await loadBudgetData();
  }

  const fixedTotal = behaviorTotals.fixed + behaviorTotals.mandatory;
  const variableTotal = behaviorTotals.variable + behaviorTotals.impulse + behaviorTotals.planned + behaviorTotals.unlabeled;
  const behaviorGrandTotal = fixedTotal + variableTotal;

  if (!canUseBudgets) {
    return (
      <>
        <section>
          <p className="text-sm font-semibold text-sage">Envelope planning</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">Budget System</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
            Budget bulanan tersedia mulai tier Pro untuk membantu mengatur kategori pengeluaran.
          </p>
        </section>
        <LockedFeature feature="monthly_budgeting" />
      </>
    );
  }

  return (
    <>
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-sage">Envelope planning</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">Budget System</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
            Kelola monthly budget, category envelope, rollover, dan warning untuk fixed maupun variable spending.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HelpModalButton topic="budget" />
          <Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => openForm()}>
            Add budget
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        <Stat label="Monthly limit" value={totals.limit} tone="sage" />
        <Stat label="Spent" value={totals.spent} tone="peach" />
        <Stat label="Remaining" value={totals.remaining} tone="sky" />
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-secondary">Warnings</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{totals.warnings}</p>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-peach/25 text-ink">
              <AlertTriangle size={19} aria-hidden="true" />
            </span>
          </div>
        </Card>
      </section>

      {isLoading && <LoadingState title="Loading budgets" body="Calculating budget progress and behavior totals for the active month." />}
      {errorMessage && <ErrorState body={errorMessage} onRetry={() => void loadBudgetData()} />}

      <section className="rounded-lg bg-mint/20 px-4 py-3 text-sm leading-6 text-secondary">
        Budget discipline melihat pemakaian kategori terhadap batas bulanan. Warning muncul lebih awal agar keputusan kecil bisa dilakukan sebelum overrun.
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card title="Budget Progress" action={<span className="text-sm font-medium text-secondary">{period}</span>}>
          <div className="grid gap-4">
            {budgets.map((budget) => (
              <button key={budget.id} type="button" className="rounded-lg bg-muted/60 p-3 text-left" onClick={() => openForm(budget)}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-ink">{budget.name}</p>
                    <p className="mt-1 text-xs text-secondary">
                      {budget.category?.name ?? "Category"} - {budget.percent}% used
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${warningStyles[budget.warningStatus]}`}>
                    {budget.warningStatus}
                  </span>
                </div>
                <BudgetProgress name={budget.name} spent={budget.spent} limit={budget.effectiveLimit} />
                <p className="mt-3 text-xs leading-5 text-secondary">{budget.warningMessage}</p>
              </button>
            ))}
            {!isLoading && budgets.length === 0 && (
              <EmptyState
                title="No budget yet"
                body="Create category budgets for this month to start tracking warnings."
                action={<Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => openForm()}>Add budget</Button>}
              />
            )}
          </div>
        </Card>

        <div className="grid gap-4">
          <Card title="Fixed vs Variable" eyebrow="Spending mix">
            <div className="grid gap-4">
              <MixRow label="Fixed + mandatory" value={fixedTotal} total={behaviorGrandTotal} tone="lavender" />
              <MixRow label="Variable + planned" value={variableTotal} total={behaviorGrandTotal} tone="sage" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <BehaviorBadge behavior="fixed" />
              <BehaviorBadge behavior="mandatory" />
              <BehaviorBadge behavior="variable" />
              <BehaviorBadge behavior="planned" />
              <BehaviorBadge behavior="impulse" />
            </div>
          </Card>

          <Card title="Rollover Budgets" eyebrow="Carry-forward">
            <div className="grid gap-2">
              {budgets.filter((budget) => budget.rolloverEnabled).map((budget) => (
                <div key={budget.id} className="flex min-h-14 items-center justify-between rounded-lg bg-muted/70 px-3">
                  <span>
                    <span className="block text-sm font-semibold text-ink">{budget.name}</span>
                    <span className="text-xs text-secondary">Rollover aktif</span>
                  </span>
                  <span className="text-sm font-bold tabular-nums text-ink">{formatCurrency(budget.rolloverAmount)}</span>
                </div>
              ))}
              {budgets.every((budget) => !budget.rolloverEnabled) && (
                <div className="rounded-lg bg-muted p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Repeat size={18} aria-hidden="true" />
                    No rollover yet
                  </div>
                  <p className="mt-1 text-sm leading-6 text-secondary">Enable rollover on a budget to carry surplus or deficit into this month.</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </section>

      <Modal open={isFormOpen} title={activeBudget ? "Edit budget" : "Add budget"} onClose={closeForm}>
        <BudgetForm
          period={period}
          categories={categories}
          subcategories={subcategories}
          budget={activeBudget}
          onSubmit={handleSubmit}
          onDelete={activeBudget ? handleDeleteBudget : undefined}
          onCancel={closeForm}
        />
      </Modal>
    </>
  );
}

type BudgetFormValues = {
  name: string;
  period: string;
  categoryId: string;
  subcategoryId?: string;
  limitAmount: number;
  rolloverEnabled: boolean;
  rolloverAmount: number;
  alertThresholds: number[];
};

function BudgetForm({
  period,
  categories,
  subcategories,
  budget,
  onSubmit,
  onDelete,
  onCancel
}: {
  period: string;
  categories: Category[];
  subcategories: Subcategory[];
  budget?: BudgetSummary;
  onSubmit: (values: BudgetFormValues) => Promise<void>;
  onDelete?: (budget: BudgetSummary) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(budget?.name ?? "");
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? "");
  const [subcategoryId, setSubcategoryId] = useState(budget?.subcategoryId ?? "");
  const [limitAmount, setLimitAmount] = useState(budget ? String(budget.limitAmount) : "");
  const [rolloverEnabled, setRolloverEnabled] = useState(budget?.rolloverEnabled ?? false);
  const [rolloverAmount, setRolloverAmount] = useState(budget ? String(budget.rolloverAmount) : "0");
  const [warningThreshold, setWarningThreshold] = useState(String(Math.round((budget?.alertThresholds[0] ?? 0.8) * 100)));
  const availableSubcategories = subcategories.filter((subcategory) => subcategory.categoryId === categoryId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedCategory = categories.find((category) => category.id === categoryId);
    await onSubmit({
      name: name.trim() || `${selectedCategory?.name ?? "Budget"} Bulanan`,
      period,
      categoryId,
      subcategoryId: subcategoryId || undefined,
      limitAmount: Math.abs(Number(limitAmount)),
      rolloverEnabled,
      rolloverAmount: rolloverEnabled ? Number(rolloverAmount || 0) : 0,
      alertThresholds: [Number(warningThreshold || 80) / 100, 1]
    });
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <Field label="Budget name">
        <Input value={name} placeholder="Makan Harian, Tagihan Bulanan" onChange={(event) => setName(event.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category">
          <Select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Pilih kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Subcategory">
          <Select value={subcategoryId} onChange={(event) => setSubcategoryId(event.target.value)}>
            <option value="">All subcategories</option>
            {availableSubcategories.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>
                {subcategory.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Monthly limit">
          <Input required type="number" inputMode="numeric" min="0" value={limitAmount} onChange={(event) => setLimitAmount(event.target.value)} />
        </Field>
        <Field label="Warning at (%)">
          <Input type="number" inputMode="numeric" min="1" max="100" value={warningThreshold} onChange={(event) => setWarningThreshold(event.target.value)} />
        </Field>
      </div>
      <div className="rounded-lg bg-muted p-3">
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-ink">
          <input className="h-5 w-5 accent-sage" type="checkbox" checked={rolloverEnabled} onChange={(event) => setRolloverEnabled(event.target.checked)} />
          Enable rollover budget
        </label>
        {rolloverEnabled && (
          <div className="mt-3">
            <Field label="Rollover amount">
              <Input type="number" inputMode="numeric" value={rolloverAmount} onChange={(event) => setRolloverAmount(event.target.value)} />
            </Field>
          </div>
        )}
      </div>
      <FormActions>
        {budget && onDelete && (
          <Button variant="ghost" className="mr-auto text-danger" onClick={() => void onDelete(budget)}>
            Archive budget
          </Button>
        )}
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!categoryId || !limitAmount}>
          Save budget
        </Button>
      </FormActions>
    </form>
  );
}

function MixRow({ label, value, total, tone }: { label: string; value: number; total: number; tone: "sage" | "lavender" }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <WalletCards size={17} aria-hidden="true" />
          {label}
        </span>
        <span className="text-sm font-bold tabular-nums text-ink">{formatCurrency(value)}</span>
      </div>
      <ProgressBar value={percent} tone={tone === "sage" ? "sage" : "sky"} label={label} />
    </div>
  );
}
