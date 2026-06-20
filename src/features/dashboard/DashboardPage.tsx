import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Landmark,
  PiggyBank,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChartCard } from "../../components/charts/ChartCard";
import { Amount } from "../../components/finance/Amount";
import { BudgetProgress } from "../../components/finance/BudgetProgress";
import { CategoryBadge } from "../../components/finance/CategoryBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ErrorState, LoadingState } from "../../components/ui/AppState";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Stat } from "../../components/ui/Stat";
import { useRouter } from "../../app/router";
import { db } from "../../db/client";
import { listAccounts } from "../../db/repositories/accountRepository";
import { listCategories } from "../../db/repositories/categoryRepository";
import { listGoals } from "../../db/repositories/goalRepository";
import { getPlanningProfile } from "../../db/repositories/planningProfileRepository";
import { listRecurringRules } from "../../db/repositories/recurringRepository";
import { listTransactions } from "../../db/repositories/transactionRepository";
import type { Account, Asset, Budget, Category, Goal, Liability, PlanningProfile, RecurringRule, Transaction } from "../../db/schema";
import { buildDashboardAnalytics, buildNetWorthModel, toPeriodKey, type DashboardAnalytics } from "../../lib/dashboardAnalytics";
import { canUseFeature } from "../../lib/commercialTiers";
import { generateInsights } from "../../lib/insightEngine";
import { formatCompactCurrency, formatCurrency } from "../../lib/money";
import { getAccountType, toDisplayAccountBalance } from "../../lib/accounts";
import { useAppStore } from "../../stores/appStore";

const behaviorLabels: Record<string, string> = {
  fixed: "Tetap",
  variable: "Variabel",
  planned: "Direncanakan",
  impulse: "Impulsif",
  mandatory: "Wajib",
  unlabeled: "Belum dilabeli"
};

const behaviorColors: Record<string, string> = {
  fixed: "#C8B8EA",
  variable: "#A9CFEF",
  planned: "#A8DDB5",
  impulse: "#F3B89A",
  mandatory: "#D97070",
  unlabeled: "#6B7280"
};

export function DashboardPage() {
  const { navigate } = useRouter();
  const activePeriod = useAppStore((state) => state.activePeriod);
  const commercialTier = useAppStore((state) => state.commercialTier);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [planningProfile, setPlanningProfile] = useState<PlanningProfile | undefined>();
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setErrorMessage("");
    try {
      const [nextAccounts, nextAssets, nextLiabilities, nextCategories, nextTransactions, nextBudgets, nextGoals, nextRecurringRules, nextPlanningProfile] = await Promise.all([
        listAccounts(),
        db.assets.toArray(),
        db.liabilities.toArray(),
        listCategories(true),
        listTransactions(),
        db.budgets.toArray(),
        listGoals(),
        listRecurringRules(),
        getPlanningProfile()
      ]);

      setAccounts(nextAccounts);
      setAssets(nextAssets);
      setLiabilities(nextLiabilities);
      setCategories(nextCategories);
      setTransactions(nextTransactions);
      setBudgets(nextBudgets);
      setGoals(nextGoals);
      setRecurringRules(nextRecurringRules);
      setPlanningProfile(nextPlanningProfile);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  const analytics = useMemo<DashboardAnalytics>(
    () =>
      buildDashboardAnalytics({
        period: activePeriod,
        accounts,
        assets,
        liabilities,
        categories,
        transactions,
        budgets,
        goals,
        recurringRules
      }),
    [accounts, activePeriod, assets, budgets, categories, goals, liabilities, recurringRules, transactions]
  );

  const hasTransactions = transactions.length > 0;
  const canTrackNetWorth = canUseFeature(commercialTier, "net_worth_tracking");
  const canUseAdvancedCharts = canUseFeature(commercialTier, "advanced_charts");
  const canUseRecurring = canUseFeature(commercialTier, "recurring_transactions");
  const activePeriodKey = toPeriodKey(activePeriod);
  const dashboardInsights = useMemo(
    () =>
      generateInsights({
        period: activePeriodKey,
        accounts,
        assets,
        liabilities,
        categories,
        transactions,
        budgets,
        goals,
        recurringRules,
        planningProfile
      }),
    [accounts, activePeriodKey, assets, budgets, categories, goals, liabilities, planningProfile, recurringRules, transactions]
  );
  const insightSummary = useMemo(
    () => ({
      warnings: dashboardInsights.filter((insight) => insight.severity === "warning" || insight.severity === "critical").length,
      positives: dashboardInsights.filter((insight) => insight.severity === "positive").length
    }),
    [dashboardInsights]
  );
  const netWorthModel = useMemo(() => buildNetWorthModel({ accounts, assets, liabilities, goals }), [accounts, assets, goals, liabilities]);
  const lastUpdatedLabel = useMemo(() => new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }), [accounts, assets, liabilities, transactions, budgets, goals]);
  const netWorthBreakdown = useMemo(
    () => ({
      assets: [
        { label: "Accounts", value: netWorthModel.assets.filter((item) => item.source === "account").reduce((total, item) => total + item.amount, 0) },
        { label: "Investments", value: netWorthModel.assets.filter((item) => item.kind === "investment").reduce((total, item) => total + item.amount, 0) },
        { label: "Goals", value: netWorthModel.assets.filter((item) => item.source === "goal").reduce((total, item) => total + item.amount, 0) },
        { label: "Other assets", value: netWorthModel.assets.filter((item) => item.source === "asset" && item.kind !== "investment").reduce((total, item) => total + item.amount, 0) }
      ],
      liabilities: [
        { label: "Mortgage", value: netWorthModel.liabilities.filter((item) => item.kind === "mortgage").reduce((total, item) => total + item.amount, 0) },
        { label: "Loans", value: netWorthModel.liabilities.filter((item) => item.kind === "loan" || item.kind === "installment").reduce((total, item) => total + item.amount, 0) },
        { label: "Debt accounts", value: netWorthModel.liabilities.filter((item) => item.kind === "debt" || item.kind === "credit").reduce((total, item) => total + item.amount, 0) }
      ]
    }),
    [netWorthModel]
  );
  const categoryTrendData = useMemo(
    () => analytics.categoryTrendData.map((point) => ({ label: point.label, ...point.values })),
    [analytics.categoryTrendData]
  );
  const categoryTrendSignal = useMemo(() => {
    return [...analytics.categoryTrendSeries].sort((left, right) => Math.abs(right.changePercent) - Math.abs(left.changePercent))[0];
  }, [analytics.categoryTrendSeries]);

  function openCategoryExplorer(category: DashboardAnalytics["topCategories"][number]) {
    navigate(`/transactions/explorer?category=${encodeURIComponent(category.id)}&month=${activePeriodKey}`);
  }

  return (
    <>
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-sage">Peta Finansialmu</p>
          <h2 className="mt-1 text-2xl font-bold uppercase tracking-[0.04em] text-ink">DANAPETA</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
            Dashboard lokal untuk cashflow, budget, kebiasaan belanja, akun, dan perbandingan bulanan tanpa cloud wajib.
          </p>
        </div>
        <Button
          variant="secondary"
          icon={<RefreshCw size={17} aria-hidden="true" />}
          onClick={() => void loadDashboardData()}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </section>

      {!hasTransactions && (
        <Card className="border border-sage/20 bg-mint/20">
          <p className="text-sm font-semibold text-ink">Dashboard siap membaca data lokal</p>
          <p className="mt-1 text-sm leading-6 text-secondary">
            Tambahkan transaksi, import CSV, atau seed demo secara opt-in untuk mengisi chart dan analitik.
          </p>
        </Card>
      )}

      {isLoading && <LoadingState title="Memuat dashboard" body="Membaca akun, transaksi, budget, dan komitmen rutin dari penyimpanan lokal." />}
      {errorMessage && <ErrorState body={errorMessage} onRetry={() => void loadDashboardData()} />}

      <section className="flex flex-wrap items-center gap-3 rounded-lg bg-mint/20 px-4 py-3 text-sm text-secondary">
        <ShieldCheck size={18} className="text-sage" aria-hidden="true" />
        <span className="font-semibold text-ink">Offline-first</span>
        <span>Calculated from your local data.</span>
        <span>Last updated {lastUpdatedLabel}</span>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <MetricCard label="Total pemasukan" value={analytics.totalIncome} icon={<TrendingUp size={19} aria-hidden="true" />} tone="sage" />
        <MetricCard label="Total pengeluaran" value={analytics.totalExpense} icon={<TrendingDown size={19} aria-hidden="true" />} tone="peach" />
        <MetricCard label="Sisa bulan ini" value={analytics.leftToSpend} icon={<Wallet size={19} aria-hidden="true" />} tone="sky" />
        <MetricCard label="Budget aman tersisa" value={analytics.budgetSummary.remainingSafeBudget} icon={<PiggyBank size={19} aria-hidden="true" />} tone="mint" />
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
        <RatioCard label="Rasio menabung" value={analytics.savingsRate} helper="Porsi pemasukan yang tersisa bulan ini" />
        <RatioCard label="Rasio utang" value={analytics.debtRatio} helper="Liabilitas dibanding total aset" />
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-secondary">Cashflow bulanan</p>
              <Amount value={analytics.monthlyCashflow} className="mt-2 block text-2xl" />
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-lavender/25 text-ink">
              <PiggyBank size={19} aria-hidden="true" />
            </span>
          </div>
          <p className="mt-4 text-xs leading-5 text-secondary">
            Pengeluaran {formatPercentChange(analytics.expenseChangePercent)} dan pemasukan {formatPercentChange(analytics.incomeChangePercent)} dari bulan lalu.
          </p>
        </Card>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {canTrackNetWorth && (
          <SnapshotCard
            title="Snapshot Net Worth"
            eyebrow="Aset - liabilitas"
            icon={<Landmark size={19} aria-hidden="true" />}
            primaryValue={analytics.netWorth}
            rows={[
              { label: "Aset", value: analytics.totalAssets },
              { label: "Liabilitas", value: analytics.totalLiabilities },
              { label: "Delta bulan ini", value: analytics.monthlyCashflow }
            ]}
            breakdown={netWorthBreakdown}
          />
        )}

        <Card title="Ringkasan Progress Tujuan" eyebrow={`${analytics.goalSummary.activeCount} tujuan aktif`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xl font-bold tabular-nums text-ink">{analytics.goalSummary.averageProgress}%</p>
              <p className="mt-1 truncate text-sm font-semibold text-ink">
                {analytics.goalSummary.nearestGoal?.name ?? "Belum ada tujuan aktif"}
              </p>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-sage/20 text-ink">
              <Target size={19} aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-secondary">
            {analytics.goalSummary.nearestGoal
              ? `Sisa ${formatCurrency(analytics.goalSummary.nearestGoal.remaining)} menuju target terdekat.`
              : "Buat tujuan tabungan, dana darurat, atau pelunasan utang."}
          </p>
          <Button variant="ghost" className="mt-3 h-9 px-0" icon={<ArrowRight size={16} aria-hidden="true" />} onClick={() => navigate("/goals")}>
            Buka goals
          </Button>
        </Card>

        <Card title="Ringkasan Insight" eyebrow="Sinyal keuangan">
          <div className="grid grid-cols-2 gap-2">
            <SignalPill label="Perlu cek" value={insightSummary.warnings} icon={<AlertTriangle size={16} aria-hidden="true" />} tone="warning" />
            <SignalPill label="Positif" value={insightSummary.positives} icon={<CheckCircle2 size={16} aria-hidden="true" />} tone="sage" />
          </div>
          <p className="mt-3 text-xs leading-5 text-secondary">
            {dashboardInsights[0]?.title ?? "Insight akan muncul setelah data transaksi dan budget cukup."}
          </p>
          <Button variant="ghost" className="mt-3 h-9 px-0" icon={<ArrowRight size={16} aria-hidden="true" />} onClick={() => navigate("/insights")}>
            Lihat insight
          </Button>
        </Card>

        <Card title="Budget Summary" eyebrow="Batas aman">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-bold tabular-nums text-ink">{analytics.budgetSummary.activeCount}</p>
              <p className="mt-1 text-sm text-secondary">budget aktif</p>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-peach/25 text-ink">
              <BarChart3 size={19} aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-secondary">Melewati batas</span>
              <span className="font-semibold tabular-nums text-ink">{analytics.budgetSummary.exceededCount}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-secondary">Sisa aman</span>
              <span className="font-semibold tabular-nums text-ink">{formatCurrency(analytics.budgetSummary.remainingSafeBudget)}</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <ChartCard title="Cashflow Bulanan" description="Income, expense, dan sisa cashflow enam bulan terakhir. Income berarti pemasukan; expense berarti pengeluaran.">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analytics.monthlyTrend} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
              <CartesianGrid stroke="#E6ECE8" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={formatCompactCurrency} tickLine={false} axisLine={false} width={48} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Area type="monotone" dataKey="income" stroke="#4F9D69" fill="#A8DDB5" fillOpacity={0.28} strokeWidth={3} />
              <Area type="monotone" dataKey="expense" stroke="#D97070" fill="#F3B89A" fillOpacity={0.22} strokeWidth={3} />
              <Line type="monotone" dataKey="cashflow" stroke="#1F2933" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card title="Dashboard Guide" eyebrow="Cara baca">
          <div className="grid gap-3 text-sm leading-6 text-secondary">
            <p>
              Cashflow bulanan menunjukkan apakah pemasukan masih memberi ruang setelah pengeluaran. Angka ini menjadi dasar savings rate dan beberapa insight.
            </p>
            <p>
              Tren kategori di bawah membantu melihat perubahan kebiasaan, bukan sekadar porsi satu bulan. Net worth trend dipusatkan di halaman Net Worth.
            </p>
            <div className="rounded-lg bg-mint/20 p-3 text-xs font-semibold text-ink">
              Semua kalkulasi dibaca dari data lokal di device ini.
            </div>
          </div>
        </Card>
      </section>

      <section>
        {canUseAdvancedCharts ? (
          <ChartCard
            title="Category Spending Trends"
            description="Bandingkan 3-5 kategori pengeluaran utama untuk melihat perubahan kebiasaan bulanan."
            footer={
              <div className="grid gap-3">
                <div className="flex flex-wrap gap-3">
                  {analytics.categoryTrendSeries.map((category) => (
                    <span key={category.id} className="flex items-center gap-2 text-xs font-semibold text-secondary">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                      {category.name}
                    </span>
                  ))}
                </div>
                {categoryTrendSignal && (
                  <p className="text-sm leading-6 text-secondary">
                    Pola paling bergerak: <span className="font-semibold text-ink">{categoryTrendSignal.name}</span>{" "}
                    {formatPercentChange(categoryTrendSignal.changePercent)} dibanding awal periode.
                  </p>
                )}
              </div>
            }
          >
            {analytics.categoryTrendSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={categoryTrendData} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                  <CartesianGrid stroke="#E6ECE8" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={formatCompactCurrency} tickLine={false} axisLine={false} width={48} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  {analytics.categoryTrendSeries.map((category) => (
                    <Line
                      key={category.id}
                      type="monotone"
                      dataKey={category.id}
                      name={category.name}
                      stroke={category.color}
                      strokeWidth={2.5}
                      dot={{ r: 2.5 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center">
                <EmptyState title="Belum ada tren kategori" body="Tren kategori akan muncul setelah pengeluaran beberapa bulan tercatat." />
              </div>
            )}
          </ChartCard>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr_1fr]">
        <Card title="Ringkasan Akun" eyebrow="Saldo lokal">
          <div className="grid gap-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`flex min-h-14 items-center justify-between gap-3 rounded-lg px-3 ${
                  getAccountType(account) === "liability" ? "bg-peach/20" : "bg-muted/70"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{account.name}</span>
                  <span className="text-xs capitalize text-secondary">{getAccountType(account)} - {account.type}</span>
                </span>
                <Amount value={toDisplayAccountBalance(account)} className="text-sm" />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Progress Budget" action={<span className="text-sm font-medium text-secondary">{analytics.budgetProgress.length} aktif</span>}>
          <div className="grid gap-4">
            {analytics.budgetProgress.slice(0, 5).map((budget) => (
              <BudgetProgress key={budget.id} name={budget.name} spent={budget.spent} limit={budget.limit} />
            ))}
            {analytics.budgetProgress.length === 0 && <EmptyState title="Belum ada budget aktif" body="Budget bulan aktif akan tampil di sini." />}
          </div>
        </Card>

        {canUseRecurring ? (
          <Card title="Transaksi Rutin" eyebrow="Komitmen bulanan">
            <div className="flex items-start justify-between gap-3 rounded-lg bg-muted p-3">
              <div>
                <p className="text-sm font-semibold text-ink">{analytics.recurringCount} aturan aktif</p>
                <p className="mt-1 text-xs leading-5 text-secondary">Estimasi komitmen dari transaksi rutin.</p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-sky/25 text-ink">
                <CalendarClock size={19} aria-hidden="true" />
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold tabular-nums text-ink">{formatCurrency(analytics.recurringTotal)}</p>
            <p className="mt-1 text-sm text-secondary">Total transaksi rutin aktif</p>
            <Button variant="ghost" className="mt-3 h-9 px-0" icon={<ArrowRight size={16} aria-hidden="true" />} onClick={() => navigate("/transactions/explorer?recurring=1")}>
              Lihat transaksi rutin
            </Button>
          </Card>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card title="Top Spending Categories" eyebrow="Category analysis">
          <div className="grid gap-3">
            {analytics.topCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                className="block w-full rounded-lg text-left transition hover:bg-muted/50 focus:outline-none focus:ring-4 focus:ring-sage/15"
                onClick={() => openCategoryExplorer(category)}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <CategoryBadge label={category.name} color={category.color} />
                  <span className="text-sm font-semibold tabular-nums text-ink">{formatCurrency(category.value)}</span>
                </div>
                <ProgressBar value={category.percent} tone={category.percent >= 35 ? "warning" : "sage"} label={`${category.name} share`} />
              </button>
            ))}
            {analytics.topCategories.length === 0 && <EmptyState title="No spending yet" body="Kategori teratas akan muncul setelah ada expense." />}
          </div>
        </Card>

        <Card title="Spending Habit Analysis" eyebrow="Behavior mix">
          <div className="grid gap-3 md:grid-cols-2">
            {analytics.behaviorAnalysis.map((item) => (
              <div key={item.behavior} className="rounded-lg bg-muted/70 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-ink">{behaviorLabels[item.behavior] ?? item.behavior}</span>
                  <span className="text-xs font-semibold text-secondary">{item.count} rows</span>
                </div>
                <p className="text-xl font-bold tabular-nums text-ink">{formatCurrency(item.amount)}</p>
                <div className="mt-3 h-2 rounded-full" style={{ backgroundColor: `${behaviorColors[item.behavior] ?? "#88B99A"}55` }}>
                  <div className="h-2 rounded-full" style={{ width: "72%", backgroundColor: behaviorColors[item.behavior] ?? "#88B99A" }} />
                </div>
              </div>
            ))}
            {analytics.behaviorAnalysis.length === 0 && <EmptyState title="No behavior data" body="Label behavior transaksi akan mengisi analisis kebiasaan." />}
          </div>
        </Card>
      </section>
    </>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "sage" | "peach" | "sky" | "mint";
}) {
  const toneClass = {
    sage: "bg-sage/20",
    peach: "bg-peach/25",
    sky: "bg-sky/25",
    mint: "bg-mint/25"
  }[tone];

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-secondary sm:text-sm">{label}</p>
          <p className="mt-2 break-words text-lg font-bold tabular-nums text-ink sm:text-2xl">{formatCurrency(value)}</p>
        </div>
        <span className={`hidden h-11 w-11 shrink-0 place-items-center rounded-lg text-ink min-[420px]:grid ${toneClass}`}>{icon}</span>
      </div>
    </Card>
  );
}

function SnapshotCard({
  title,
  eyebrow,
  icon,
  primaryValue,
  rows,
  breakdown
}: {
  title: string;
  eyebrow: string;
  icon: React.ReactNode;
  primaryValue: number;
  rows: Array<{ label: string; value: number }>;
  breakdown?: {
    assets: Array<{ label: string; value: number }>;
    liabilities: Array<{ label: string; value: number }>;
  };
}) {
  return (
    <Card title={title} eyebrow={eyebrow}>
      <div className="flex items-start justify-between gap-3">
        <Amount value={primaryValue} className="text-2xl" />
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-mint/25 text-ink">{icon}</span>
      </div>
      <div className="mt-3 grid gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-secondary">{row.label}</span>
            <span className="font-semibold tabular-nums text-ink">{formatCurrency(row.value)}</span>
          </div>
        ))}
      </div>
      {breakdown && (
        <details className="mt-3 rounded-lg bg-muted/70 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Breakdown aset dan liabilitas</summary>
          <div className="mt-3 grid gap-3 text-sm">
            <div>
              <p className="mb-2 font-semibold text-ink">Assets</p>
              {breakdown.assets.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 py-1">
                  <span className="text-secondary">{row.label}</span>
                  <span className="font-semibold tabular-nums text-ink">{formatCurrency(row.value)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 font-semibold text-ink">Liabilities</p>
              {breakdown.liabilities.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 py-1">
                  <span className="text-secondary">{row.label}</span>
                  <span className="font-semibold tabular-nums text-ink">{formatCurrency(row.value)}</span>
                </div>
              ))}
            </div>
            <p className="rounded-lg bg-surface px-3 py-2 text-xs font-semibold text-secondary">Net Worth = Assets - Liabilities</p>
          </div>
        </details>
      )}
    </Card>
  );
}

function SignalPill({
  label,
  value,
  icon,
  tone
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "warning" | "sage";
}) {
  const toneClass = tone === "warning" ? "bg-peach/25" : "bg-mint/30";

  return (
    <div className={`rounded-lg p-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2 text-ink">
        {icon}
        <span className="text-xl font-bold tabular-nums">{value}</span>
      </div>
      <p className="mt-1 text-xs font-semibold text-secondary">{label}</p>
    </div>
  );
}

function RatioCard({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-secondary">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{value}%</p>
        </div>
        <ProgressRing value={value} />
      </div>
      <p className="mt-4 text-xs leading-5 text-secondary">{helper}</p>
    </Card>
  );
}

function ProgressRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(value, 100));
  return (
    <div
      className="grid h-12 w-12 place-items-center rounded-full text-xs font-bold tabular-nums text-ink"
      style={{ background: `conic-gradient(#88B99A ${clamped * 3.6}deg, rgb(var(--color-muted)) 0deg)` }}
      aria-label={`${clamped}%`}
    >
      <span className="grid h-9 w-9 place-items-center rounded-full bg-surface">{clamped}</span>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg bg-muted p-4 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm leading-6 text-secondary">{body}</p>
    </div>
  );
}

function formatPercentChange(value: number) {
  if (value === 0) return "0%";
  return `${value > 0 ? "+" : ""}${value}%`;
}
