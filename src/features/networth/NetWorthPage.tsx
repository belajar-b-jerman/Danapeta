import { AlertTriangle, Archive, BarChart3, LineChart as LineChartIcon, Plus } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "../../components/charts/ChartCard";
import { Amount } from "../../components/finance/Amount";
import { LockedFeature } from "../../components/finance/FeatureGate";
import { HelpModalButton } from "../../components/finance/HelpModal";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/AppState";
import { Field, FormActions, Input, Select } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import { Stat } from "../../components/ui/Stat";
import { db } from "../../db/client";
import { listAccounts } from "../../db/repositories/accountRepository";
import { archiveAsset, createAsset, listAssets, updateAsset, type AssetInput } from "../../db/repositories/assetRepository";
import { listGoals } from "../../db/repositories/goalRepository";
import { listTransactions } from "../../db/repositories/transactionRepository";
import type { Account, Asset, Goal, Liability, Transaction } from "../../db/schema";
import { canUseFeature } from "../../lib/commercialTiers";
import { buildNetWorthModel } from "../../lib/dashboardAnalytics";
import { formatCompactCurrency, formatCurrency } from "../../lib/money";
import { useAppStore } from "../../stores/appStore";

const allocationColors = ["#88B99A", "#A9CFEF", "#F3B89A", "#C8B8EA", "#D97070", "#A8DDB5", "#6B7280"];

const assetCategoryOptions: Array<{ value: NonNullable<Asset["category"]>; label: string; type: Asset["type"]; liquidity: Asset["liquidity"] }> = [
  { value: "home", label: "Rumah", type: "property", liquidity: "illiquid" },
  { value: "land", label: "Tanah", type: "property", liquidity: "illiquid" },
  { value: "vehicle", label: "Kendaraan", type: "vehicle", liquidity: "semi_liquid" },
  { value: "gold", label: "Emas", type: "collectible", liquidity: "semi_liquid" },
  { value: "electronics", label: "Elektronik", type: "other", liquidity: "semi_liquid" },
  { value: "business", label: "Bisnis", type: "business", liquidity: "illiquid" },
  { value: "collectible", label: "Koleksi", type: "collectible", liquidity: "illiquid" },
  { value: "investment_property", label: "Properti investasi", type: "property", liquidity: "illiquid" },
  { value: "stock", label: "Saham", type: "investment", liquidity: "liquid" },
  { value: "mutual_fund", label: "Reksadana", type: "investment", liquidity: "liquid" },
  { value: "crypto", label: "Crypto", type: "investment", liquidity: "liquid" },
  { value: "deposit", label: "Deposito", type: "investment", liquidity: "semi_liquid" },
  { value: "other", label: "Other", type: "other", liquidity: "semi_liquid" }
];

export function NetWorthPage() {
  const commercialTier = useAppStore((state) => state.commercialTier);
  const canUseNetWorth = canUseFeature(commercialTier, "net_worth_tracking");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeAsset, setActiveAsset] = useState<Asset | undefined>();
  const [isAssetFormOpen, setAssetFormOpen] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!canUseNetWorth) return;
    void loadNetWorthData();
  }, [canUseNetWorth]);

  async function loadNetWorthData() {
    setLoading(true);
    setErrorMessage("");
    try {
      const [nextAccounts, nextAssets, nextLiabilities, nextGoals, nextTransactions] = await Promise.all([
        listAccounts(),
        listAssets(),
        db.liabilities.toArray(),
        listGoals(),
        listTransactions()
      ]);
      setAccounts(nextAccounts);
      setAssets(nextAssets);
      setLiabilities(nextLiabilities);
      setGoals(nextGoals);
      setTransactions(nextTransactions);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load net worth data.");
    } finally {
      setLoading(false);
    }
  }

  const model = useMemo(() => buildNetWorthModel({ accounts, assets, liabilities, goals }), [accounts, assets, goals, liabilities]);
  const analytics = useMemo(() => buildNetWorthAnalytics(model, transactions, goals), [goals, model, transactions]);
  const activeManualAssets = assets.filter((asset) => !asset.isArchived);

  function openAssetForm(asset?: Asset) {
    setActiveAsset(asset);
    setAssetFormOpen(true);
  }

  function closeAssetForm() {
    setActiveAsset(undefined);
    setAssetFormOpen(false);
  }

  async function handleAssetSubmit(values: AssetInput) {
    if (activeAsset) await updateAsset(activeAsset.id, values);
    else await createAsset(values);
    closeAssetForm();
    await loadNetWorthData();
  }

  async function handleArchiveAsset(asset: Asset) {
    await archiveAsset(asset.id);
    await loadNetWorthData();
  }

  if (!canUseNetWorth) {
    return (
      <>
        <section>
          <p className="text-sm font-semibold text-sage">Wealth overview hub</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">Net Worth</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
            Net Worth tersedia mulai tier Pro untuk membaca aset dan kewajiban sebagai sumber kekayaan bersih.
          </p>
        </section>
        <LockedFeature feature="net_worth_tracking" />
      </>
    );
  }

  return (
    <>
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-sage">Wealth overview hub</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">Net Worth</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
            Satu tampilan untuk aset, liability, investasi manual, dan tren kekayaan dari data lokal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HelpModalButton topic="netWorth" />
          <Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => openAssetForm()}>
            Add asset
          </Button>
        </div>
      </section>

      {isLoading && <LoadingState title="Loading net worth" body="Reading accounts, manual assets, liabilities, and local ledger history." />}
      {errorMessage && <ErrorState body={errorMessage} onRetry={() => void loadNetWorthData()} />}

      <section className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        <Stat label="Total Net Worth" value={model.netWorth} tone="sage" />
        <Stat label="Total Assets" value={model.totalAssets} tone="sky" />
        <Stat label="Total Liabilities" value={model.totalLiabilities} tone="peach" />
        <Stat label="Liquid Assets" value={model.liquidAssets} tone="sage" />
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
        <MetricCard label="Investments" value={analytics.investments} icon={<LineChartIcon size={19} aria-hidden="true" />} />
        <MetricCard label="Liability Ratio" value={`${model.debtRatio}%`} icon={<AlertTriangle size={19} aria-hidden="true" />} />
        <MetricCard label="Monthly Growth" value={formatCurrency(analytics.latestGrowth)} icon={<BarChart3 size={19} aria-hidden="true" />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <ChartCard title="Monthly Net Worth Growth" description="Estimasi tren dari net worth saat ini dan cashflow ledger bulanan.">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analytics.netWorthTrend} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
              <CartesianGrid stroke="#E6ECE8" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={formatCompactCurrency} tickLine={false} axisLine={false} width={48} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Area type="monotone" dataKey="netWorth" stroke="#4F9D69" fill="#A8DDB5" fillOpacity={0.28} strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Asset Allocation" description="Pembagian aset dari accounts dan manual assets.">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={analytics.allocation} dataKey="value" nameKey="name" innerRadius={54} outerRadius={88} paddingAngle={3}>
                {analytics.allocation.map((item, index) => (
                  <Cell key={item.name} fill={allocationColors[index % allocationColors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <ChartCard title="Assets vs Liabilities" description="Aset dan liability trend berbasis ledger lokal.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.assetLiabilityTrend} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
              <CartesianGrid stroke="#E6ECE8" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={formatCompactCurrency} tickLine={false} axisLine={false} width={48} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="assets" fill="#88B99A" radius={[6, 6, 0, 0]} />
              <Bar dataKey="liabilities" fill="#F3B89A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card title="Debt Breakdown" eyebrow="Liability accounts">
          <div className="grid gap-3">
            {analytics.debtBreakdown.map((item) => (
              <div key={item.name} className="rounded-lg bg-muted/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-ink">{item.name}</span>
                  <span className="font-bold tabular-nums text-ink">{formatCurrency(item.value)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-surface">
                  <div className="h-2 rounded-full bg-peach" style={{ width: `${item.percent}%` }} />
                </div>
              </div>
            ))}
            {analytics.debtBreakdown.length === 0 && <EmptyState title="No debt yet" body="Liability accounts akan muncul sebagai breakdown utang." />}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card
          title="Manual Assets"
          eyebrow="Single source of truth"
          action={
            <Button className="h-9 px-3" icon={<Plus size={16} aria-hidden="true" />} onClick={() => openAssetForm()}>
              Add
            </Button>
          }
        >
          <div className="grid gap-2">
            {activeManualAssets.map((asset) => (
              <div key={asset.id} className="flex min-h-14 items-center justify-between gap-3 rounded-lg bg-muted/70 px-3">
                <button type="button" className="min-w-0 text-left" onClick={() => openAssetForm(asset)}>
                  <span className="block truncate text-sm font-semibold text-ink">{asset.name}</span>
                  <span className="text-xs text-secondary">{assetCategoryLabel(asset)} - {liquidityLabel(asset.liquidity)}</span>
                </button>
                <div className="flex items-center gap-2">
                  <Amount value={asset.currentValue} className="text-sm" />
                  <Button variant="ghost" className="h-9 px-2 text-danger" icon={<Archive size={15} aria-hidden="true" />} onClick={() => void handleArchiveAsset(asset)}>
                    Archive
                  </Button>
                </div>
              </div>
            ))}
            {!isLoading && activeManualAssets.length === 0 && (
              <EmptyState title="No manual assets yet" body="Tambahkan rumah, kendaraan, emas, saham, reksadana, crypto, deposito, atau aset lain." />
            )}
          </div>
        </Card>

        <Card title="Wealth Insights" eyebrow="Local planning signals">
          <div className="grid gap-2">
            {analytics.insights.map((insight) => (
              <div key={insight.title} className={`rounded-lg p-3 ${insight.tone === "warning" ? "bg-peach/25" : "bg-mint/25"}`}>
                <p className="text-sm font-bold text-ink">{insight.title}</p>
                <p className="mt-1 text-sm leading-6 text-secondary">{insight.body}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Modal open={isAssetFormOpen} title={activeAsset ? "Edit asset" : "Add manual asset"} onClose={closeAssetForm}>
        <AssetForm asset={activeAsset} onSubmit={handleAssetSubmit} onCancel={closeAssetForm} />
      </Modal>
    </>
  );
}

function AssetForm({ asset, onSubmit, onCancel }: { asset?: Asset; onSubmit: (values: AssetInput) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(asset?.name ?? "");
  const [category, setCategory] = useState<NonNullable<Asset["category"]>>(asset?.category ?? "home");
  const [currentValue, setCurrentValue] = useState(asset ? String(asset.currentValue) : "");
  const [appreciationRate, setAppreciationRate] = useState(asset?.appreciationRate ? String(asset.appreciationRate) : "0");
  const [notes, setNotes] = useState(asset?.notes ?? "");
  const selected = assetCategoryOptions.find((item) => item.value === category) ?? assetCategoryOptions[0];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      name: name.trim(),
      category,
      type: selected.type,
      currentValue: Math.abs(Number(currentValue || 0)),
      appreciationRate: Number(appreciationRate || 0),
      notes,
      currency: "IDR",
      liquidity: selected.liquidity,
      includeInNetWorth: true
    });
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <Field label="Asset name">
        <Input required value={name} placeholder="Rumah, Tanah, Saham BBCA, Deposito" onChange={(event) => setName(event.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category">
          <Select value={category} onChange={(event) => setCategory(event.target.value as NonNullable<Asset["category"]>)}>
            {assetCategoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Estimated value">
          <Input required type="number" inputMode="numeric" min="0" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} />
        </Field>
      </div>
      <Field label="Optional appreciation (%)" hint="Manual assumption only. Tidak memakai API harga realtime.">
        <Input type="number" inputMode="decimal" step="0.01" value={appreciationRate} onChange={(event) => setAppreciationRate(event.target.value)} />
      </Field>
      <Field label="Notes">
        <Input value={notes} placeholder="Opsional" onChange={(event) => setNotes(event.target.value)} />
      </Field>
      <FormActions>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || !currentValue}>
          Save asset
        </Button>
      </FormActions>
    </form>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  const displayValue = typeof value === "number" ? formatCurrency(value) : value;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-secondary">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{displayValue}</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-mint/25 text-ink">{icon}</span>
      </div>
    </Card>
  );
}

function buildNetWorthAnalytics(
  model: ReturnType<typeof buildNetWorthModel>,
  transactions: Transaction[],
  goals: Goal[]
) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("id-ID", { month: "short" })
    };
  });
  const cashflows = months.map((month) => {
    const rows = transactions.filter((transaction) => transaction.date.startsWith(month.key));
    const income = rows.filter((transaction) => transaction.type === "income").reduce((total, item) => total + item.amount, 0);
    const expense = rows.filter((transaction) => transaction.type === "expense").reduce((total, item) => total + item.amount, 0);
    return { ...month, cashflow: income - expense };
  });
  let runningNetWorth = model.netWorth - cashflows.reduce((total, item) => total + item.cashflow, 0);
  const netWorthTrend = cashflows.map((item) => {
    runningNetWorth += item.cashflow;
    return { label: item.label, netWorth: runningNetWorth };
  });
  const allocationMap = new Map<string, number>();
  model.assets.forEach((asset) => {
    const label = assetKindLabel(asset.kind);
    allocationMap.set(label, (allocationMap.get(label) ?? 0) + asset.amount);
  });
  const allocation = Array.from(allocationMap.entries()).map(([name, value]) => ({ name, value })).filter((item) => item.value > 0);
  const debtBreakdown = model.liabilities.map((liability) => ({
    name: liability.name,
    value: liability.amount,
    percent: model.totalLiabilities > 0 ? Math.round((liability.amount / model.totalLiabilities) * 100) : 0
  }));
  const latestGrowth = cashflows[cashflows.length - 1]?.cashflow ?? 0;
  const investments = model.assets.filter((asset) => asset.kind === "investment").reduce((total, asset) => total + asset.amount, 0);
  const investmentShare = model.totalAssets > 0 ? Math.round((investments / model.totalAssets) * 100) : 0;
  const largestAssetShare =
    model.totalAssets > 0 ? Math.round((Math.max(0, ...model.assets.map((asset) => asset.amount)) / model.totalAssets) * 100) : 0;
  const debtGoals = goals.filter((goal) => goal.type === "debt_payoff" && goal.targetAmount > 0);
  const debtPayoffProgress =
    debtGoals.length > 0 ? Math.round(debtGoals.reduce((total, goal) => total + Math.min(goal.currentAmount / goal.targetAmount, 1), 0) / debtGoals.length * 100) : 0;

  return {
    investments,
    latestGrowth,
    netWorthTrend,
    allocation,
    debtBreakdown,
    assetLiabilityTrend: netWorthTrend.map((point) => ({
      label: point.label,
      assets: model.totalAssets,
      liabilities: model.totalLiabilities
    })),
    insights: [
      model.debtRatio > 40
        ? { title: "Liability ratio tinggi", body: "Total kewajiban mengambil porsi besar dari aset. Prioritaskan payoff plan yang linked ke liability account.", tone: "warning" as const }
        : { title: "Debt improving", body: `Debt payoff progress tracker berada di ${debtPayoffProgress}%.`, tone: "positive" as const },
      model.liquidAssets < model.totalAssets * 0.15
        ? { title: "Liquidity warning", body: "Aset likuid kurang dari 15% total aset. Pastikan dana darurat tetap mudah dicairkan.", tone: "warning" as const }
        : { title: "Liquidity buffer visible", body: "Aset likuid terbaca sebagai bantalan yang jelas di net worth.", tone: "positive" as const },
      investmentShare > 60 || largestAssetShare > 50
        ? { title: "Investment concentration", body: "Satu kelompok aset terlihat dominan. Review risiko konsentrasi sebelum menambah posisi.", tone: "warning" as const }
        : { title: "Allocation balanced", body: "Belum ada konsentrasi aset ekstrem dari data manual saat ini.", tone: "positive" as const },
      latestGrowth < 0
        ? { title: "Asset growth slowing", body: "Cashflow bulan terakhir negatif, sehingga estimasi growth net worth ikut melemah.", tone: "warning" as const }
        : { title: "Net worth growth positive", body: "Cashflow bulan terakhir mendukung pertumbuhan net worth.", tone: "positive" as const }
    ]
  };
}

function assetKindLabel(kind: string) {
  const labels: Record<string, string> = {
    cash: "Kas",
    bank_balance: "Saldo bank",
    savings_allocation: "Tabungan",
    emergency_fund: "Dana darurat",
    goal_linked_savings: "Tabungan tujuan",
    investment: "Investasi",
    property: "Properti",
    vehicle: "Kendaraan",
    business: "Bisnis",
    collectible: "Koleksi",
    other_asset: "Aset lain"
  };
  return labels[kind] ?? kind.replace(/_/g, " ");
}

function liquidityLabel(liquidity: Asset["liquidity"]) {
  if (liquidity === "liquid") return "Likuid";
  if (liquidity === "semi_liquid") return "Semi-likuid";
  return "Tidak likuid";
}

function assetCategoryLabel(asset: Asset) {
  return assetCategoryOptions.find((option) => option.value === asset.category)?.label ?? assetKindLabel(asset.type);
}
