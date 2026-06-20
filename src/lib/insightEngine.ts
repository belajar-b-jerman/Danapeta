import type { Account, Asset, Budget, Category, Goal, Insight, Liability, PlanningProfile, RecurringRule, Transaction } from "../db/schema";
import { buildFinancialModel, estimateMonthlyBurnRate, type FinancialModel } from "./financialModel";
import { emergencyFundGuideline } from "./emergencyFund";
import { findPlanningRuleDefinition } from "./planningRuleRegistry";
import { projectGoal } from "./planningEngine";
import { buildScenarioEngine } from "./scenarioEngine";
import { toSlug } from "./slug";

export type InsightCategory =
  | "spending behavior"
  | "overspending"
  | "savings health"
  | "debt health"
  | "budgeting quality"
  | "cashflow health"
  | "subscription detection"
  | "recurring expense analysis"
  | "emergency fund readiness"
  | "lifestyle inflation"
  | "income dependency"
  | "financial stability"
  | "investment allocation"
  | "spending anomaly"
  | "habit trends"
  | "positive achievements"
  | "financial warnings"
  | "recommendations"
  | "planning suggestions"
  | "future cashflow prediction"
  | "retirement readiness"
  | "house affordability"
  | "education funding readiness";

type InsightPriority = "low" | "medium" | "high" | "urgent";

export type FinancialHealthScore = {
  score: number;
  rawScore: number;
  maxScore: number;
  rating: "strong" | "stable" | "needs_attention" | "high_risk";
  cashflow: number;
  savings: number;
  budget: number;
  debt: number;
  emergency: number;
  stability: number;
  strongestFactor: string;
  weakestFactor: string;
};

export type InsightDraft = Omit<Insight, "id" | "createdAt" | "updatedAt" | "syncStatus" | "version" | "status"> & {
  category: InsightCategory;
  priority: InsightPriority;
  priorityScore: number;
};

type InsightRule = {
  id: string;
  category: InsightCategory;
  evaluate: (context: InsightContext) => InsightDraft[];
};

export type InsightContext = {
  period: string;
  referenceDate: Date;
  accounts: Account[];
  assets?: Asset[];
  liabilities?: Liability[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  recurringRules: RecurringRule[];
  planningProfile?: PlanningProfile;
  currentMonthTransactions: Transaction[];
  previousMonthTransactions: Transaction[];
  income: number;
  expense: number;
  previousIncome: number;
  previousExpense: number;
  netWorth: number;
  financialModel: FinancialModel;
  totalAssets: number;
  liquidBalance: number;
  emergencyDesignatedAssets: number;
  emergencyFundSource: EmergencyFundSource;
  monthlyBurnRate: number;
  debtBalance: number;
  categoryTotals: Map<string, number>;
  previousCategoryTotals: Map<string, number>;
  categoryMap: Map<string, Category>;
  dayOfMonth: number;
  daysInMonth: number;
};

export type EmergencyFundSource = {
  source: "goal" | "liquid_assets";
  label: string;
  amount: number;
  monthsCoverage: number;
  formula: string;
};

export function generateInsights(input: {
  period: string;
  accounts: Account[];
  assets?: Asset[];
  liabilities?: Liability[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  recurringRules: RecurringRule[];
  planningProfile?: PlanningProfile;
  referenceDate?: Date;
}) {
  const context = buildInsightContext(input);
  const healthScore = calculateFinancialHealthScore(context);
  const drafts = insightRules.flatMap((rule) => rule.evaluate(context));
  const healthInsight = buildHealthScoreInsight(context, healthScore);
  return rankInsights([healthInsight, ...drafts]).map((draft) => toPersistedInsight(draft));
}

export function calculateFinancialHealthScore(context: InsightContext): FinancialHealthScore {
  const savingsRate = context.income > 0 ? ((context.income - context.expense) / context.income) * 100 : 0;
  const expenseIncomeRatio = context.income > 0 ? context.expense / context.income : 1;
  const budgetCoverage = context.budgets.length > 0 ? 1 : 0;
  const budgetRiskCount = context.budgets.filter((budget) => budgetPercent(context, budget) >= 80).length;
  const runwayMonths = context.emergencyFundSource.monthsCoverage;
  const emergencyGuideline = emergencyFundGuideline(context.planningProfile);
  const debtRatio = context.financialModel.debtRatio / 100;
  const recurringLoad = recurringMonthlyTotal(context.recurringRules) / Math.max(context.income, 1);
  const cashflow = clampScore(22 - Math.max(0, expenseIncomeRatio - 0.75) * 55 + (context.income - context.expense > 0 ? 3 : -8), 0, 25);
  const savings = clampScore(savingsRate >= 20 ? 20 : savingsRate >= 10 ? 14 : savingsRate >= 0 ? 8 : 0, 0, 20);
  const budget = clampScore((budgetCoverage ? 15 : 7) - budgetRiskCount * 3, 0, 15);
  const debt = clampScore(debtRatio <= 0.1 ? 20 : debtRatio <= 0.3 ? 14 : debtRatio <= 0.5 ? 8 : 2, 0, 20);
  const emergency = clampScore(
    runwayMonths >= emergencyGuideline.idealMonths
      ? 10
      : runwayMonths >= emergencyGuideline.minimumMonths
        ? 8
        : runwayMonths >= emergencyGuideline.minimumMonths / 2
          ? 5
          : 1,
    0,
    10
  );
  const stability = clampScore(10 - Math.max(0, recurringLoad - 0.35) * 20, 0, 10);
  const components = [
    { label: "Cashflow", score: cashflow, max: 25 },
    { label: "Rasio menabung", score: savings, max: 20 },
    { label: "Disiplin budget", score: budget, max: 15 },
    { label: "Rasio utang", score: debt, max: 20 },
    { label: "Dana darurat", score: emergency, max: 10 },
    { label: "Stabilitas", score: stability, max: 10 }
  ];
  const strongest = [...components].sort((left, right) => right.score / right.max - left.score / left.max)[0];
  const weakest = [...components].sort((left, right) => left.score / left.max - right.score / right.max)[0];
  const rawScore = Math.round(cashflow + savings + budget + debt + emergency + stability);
  const maxScore = 100;
  const score = Math.round((rawScore / maxScore) * 100);

  return {
    score,
    rawScore,
    maxScore,
    rating: score >= 80 ? "strong" : score >= 65 ? "stable" : score >= 50 ? "needs_attention" : "high_risk",
    cashflow: Math.round(cashflow),
    savings: Math.round(savings),
    budget: Math.round(budget),
    debt: Math.round(debt),
    emergency: Math.round(emergency),
    stability: Math.round(stability),
    strongestFactor: strongest.label,
    weakestFactor: weakest.label
  };
}

function buildInsightContext(input: {
  period: string;
  accounts: Account[];
  assets?: Asset[];
  liabilities?: Liability[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  recurringRules: RecurringRule[];
  planningProfile?: PlanningProfile;
  referenceDate?: Date;
}): InsightContext {
  const referenceDate = input.referenceDate ?? new Date();
  const previousPeriod = shiftPeriod(input.period, -1);
  const activeTransactions = input.transactions.filter((transaction) => !transaction.deletedAt);
  const currentMonthTransactions = activeTransactions.filter((transaction) => transaction.date.startsWith(input.period));
  const previousMonthTransactions = activeTransactions.filter((transaction) => transaction.date.startsWith(previousPeriod));
  const categoryMap = new Map(input.categories.map((category) => [category.id, category]));
  const activeGoals = input.goals.filter((goal) => !goal.deletedAt && goal.status !== "archived");
  const financialModel = buildFinancialModel({ accounts: input.accounts, assets: input.assets, liabilities: input.liabilities, goals: activeGoals });
  const monthlyBurnRate = estimateMonthlyBurnRate(activeTransactions, sumByType(currentMonthTransactions, "expense"));
  const emergencyFundSource = resolveEmergencyFundSource(activeGoals, financialModel.liquidAssets, monthlyBurnRate);

  return {
    period: input.period,
    referenceDate,
    accounts: input.accounts,
    categories: input.categories,
    transactions: activeTransactions,
    budgets: input.budgets.filter((budget) => !budget.deletedAt && budget.period === input.period),
    goals: activeGoals,
    recurringRules: input.recurringRules.filter((rule) => !rule.deletedAt && rule.status === "active"),
    planningProfile: input.planningProfile,
    currentMonthTransactions,
    previousMonthTransactions,
    income: sumByType(currentMonthTransactions, "income"),
    expense: sumByType(currentMonthTransactions, "expense"),
    previousIncome: sumByType(previousMonthTransactions, "income"),
    previousExpense: sumByType(previousMonthTransactions, "expense"),
    netWorth: financialModel.netWorth,
    financialModel,
    totalAssets: financialModel.totalAssets,
    liquidBalance: financialModel.liquidAssets,
    emergencyDesignatedAssets: financialModel.emergencyDesignatedAssets,
    emergencyFundSource,
    monthlyBurnRate,
    debtBalance: financialModel.totalLiabilities,
    categoryTotals: categoryTotals(currentMonthTransactions),
    previousCategoryTotals: categoryTotals(previousMonthTransactions),
    categoryMap,
    dayOfMonth: Math.max(referenceDate.getDate(), 1),
    daysInMonth: new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate()
  };
}

const insightRules: InsightRule[] = [
  {
    id: "financial-stage-guidance",
    category: "planning suggestions",
    evaluate: (context) => {
      const score = calculateFinancialHealthScore(context);
      const cashflow = context.income - context.expense;
      const stage =
        score.score < 50 || cashflow < 0
          ? {
              title: "Fase stabilisasi: rapikan fondasi dulu",
              body:
                "Urutan perencanaan keuangan untuk kondisi ini adalah menjaga kebutuhan wajib, memulihkan cashflow, membuat dana darurat awal, lalu baru mengejar goal besar. Hindari menambah cicilan atau target agresif sampai ruang bulanannya jelas.",
              severity: "warning" as const,
              priority: "high" as const,
              route: "/budgets"
            }
          : score.score < 65
            ? {
                title: "Fase pembangunan fondasi",
                body:
                  "Fondasi sudah mulai terbaca, tetapi satu-dua rasio masih perlu diperkuat. Pilih satu fokus 30-90 hari: naikkan rasio menabung, tambah dana darurat, atau turunkan tekanan utang.",
                severity: "info" as const,
                priority: "medium" as const,
                route: "/insights"
              }
            : score.score < 80
              ? {
                  title: "Fase pemeliharaan terarah",
                  body:
                    "Kondisi relatif stabil. Langkah berikutnya adalah membuat kontribusi tujuan lebih konsisten, menjaga proteksi dasar, dan memastikan surplus tidak habis tanpa tugas.",
                  severity: "info" as const,
                  priority: "medium" as const,
                  route: "/goals"
                }
              : {
                  title: "Fase optimasi dan growth",
                  body:
                    "Fondasi terlihat kuat. Fokus berikutnya adalah menata alokasi growth, review proteksi, dan memastikan goal jangka panjang tetap sesuai horizon serta profil risiko.",
                  severity: "positive" as const,
                  priority: "low" as const,
                  route: "/goals"
                };

      return [
        makeInsight(context, {
          ruleId: "financial-stage-guidance",
          category: "planning suggestions",
          title: stage.title,
          body: stage.body,
          severity: stage.severity,
          priority: stage.priority,
          evidence: [
            { label: "Health score", value: score.score, unit: "count" },
            { label: "Faktor terlemah", value: score.weakestFactor },
            { label: "Cashflow", value: cashflow, unit: "IDR" },
            { label: "Dana darurat", value: context.emergencyFundSource.monthsCoverage, unit: "count" },
            { label: "Debt ratio", value: context.financialModel.debtRatio, unit: "percent" }
          ],
          action: { label: "Lihat prioritas", route: stage.route }
        })
      ];
    }
  },
  {
    id: "cashflow-run-rate",
    category: "future cashflow prediction",
    evaluate: (context) => {
      if (context.expense <= 0) return [];
      const projectedExpense = Math.round((context.expense / context.dayOfMonth) * context.daysInMonth);
      const projectedCashflow = context.income - projectedExpense - recurringMonthlyTotal(context.recurringRules);
      if (projectedCashflow >= 0) return [];
      return [
        makeInsight(context, {
          ruleId: "cashflow-run-rate",
          category: "future cashflow prediction",
          title: "Cashflow bulan ini perlu dipantau",
          body: "Dengan ritme pengeluaran saat ini dan komitmen rutin yang tercatat, bulan ini berpotensi ditutup di bawah pemasukan. Cek kategori fleksibel secara ringan sebelum akhir bulan.",
          severity: "warning",
          priority: "high",
          evidence: [
            { label: "Proyeksi pengeluaran", value: projectedExpense, unit: "IDR" },
            { label: "Proyeksi cashflow", value: projectedCashflow, unit: "IDR" }
          ],
          action: { label: "Lihat budget", route: "/budgets" }
        })
      ];
    }
  },
  {
    id: "savings-rate",
    category: "savings health",
    evaluate: (context) => {
      if (context.income <= 0) return [];
      const savingsRate = Math.round(((context.income - context.expense) / context.income) * 100);
      if (savingsRate >= 20) {
        return [
          makeInsight(context, {
            ruleId: "savings-rate-strong",
            category: "positive achievements",
            title: "Rasio menabung sedang kuat",
            body: "Bulan ini berada di atas patokan umum 20%. Jika ritme ini terasa realistis, konsistensinya bisa memberi ruang gerak jangka panjang.",
            severity: "positive",
            priority: "medium",
            evidence: [{ label: "Rasio menabung", value: savingsRate, unit: "percent" }],
            action: { label: "Lihat tujuan", route: "/goals" }
          })
        ];
      }
      if (savingsRate < 10) {
        return [
          makeInsight(context, {
            ruleId: "savings-rate-low",
            category: "savings health",
            title: "Rasio menabung perlu ruang",
            body: "Bulan ini masih di bawah patokan 10%. Penyesuaian kecil pada pengeluaran fleksibel dapat membantu menjaga kontribusi target tanpa perubahan besar.",
            severity: savingsRate < 0 ? "warning" : "info",
            priority: savingsRate < 0 ? "high" : "medium",
            evidence: [{ label: "Rasio menabung", value: savingsRate, unit: "percent" }],
            action: { label: "Cek transaksi", route: buildExplorerRoute({ month: context.period }) }
          })
        ];
      }
      return [];
    }
  },
  {
    id: "budget-risk",
    category: "budgeting quality",
    evaluate: (context) =>
      context.budgets
        .map((budget) => ({ budget, percent: budgetPercent(context, budget) }))
        .filter((item) => item.percent >= 80)
        .map((item) =>
          makeInsight(context, {
            ruleId: `budget-risk-${item.budget.id}`,
            category: "budgeting quality",
            title: `${item.budget.name} mendekati batas`,
            body: item.percent >= 100 ? "Budget ini sudah melewati batas. Catat penyebabnya atau tahan dulu pos yang tidak mendesak bila memungkinkan." : "Budget ini mendekati ambang pantau sebelum akhir bulan.",
            severity: "warning",
            priority: item.percent >= 100 ? "high" : "medium",
            evidence: [
              { label: "Budget terpakai", value: item.percent, unit: "percent" },
              { label: "Batas", value: effectiveBudgetLimit(item.budget), unit: "IDR" }
            ],
            action: { label: "Lihat budget", route: "/budgets" }
          })
        )
  },
  {
    id: "category-spike",
    category: "spending anomaly",
    evaluate: (context) => {
      const insights: InsightDraft[] = [];
      context.categoryTotals.forEach((current, categoryId) => {
        const previous = context.previousCategoryTotals.get(categoryId) ?? 0;
        if (previous < 100000 || current < previous * 1.35) return;
        const category = context.categoryMap.get(categoryId);
        insights.push(
          makeInsight(context, {
            ruleId: `category-spike-${categoryId}`,
            category: "spending anomaly",
            title: `Pengeluaran ${category?.name ?? "kategori"} naik`,
            body: "Kategori ini terlihat lebih tinggi dari bulan lalu. Cek apakah kenaikannya memang direncanakan, wajib, atau mulai bergeser menjadi kebiasaan.",
            severity: "warning",
            priority: "high",
            evidence: [
              { label: "Bulan ini", value: current, unit: "IDR" },
              { label: "Bulan lalu", value: previous, unit: "IDR" }
            ],
            action: {
              label: "Filter transaksi",
              route: buildExplorerRoute({
                month: context.period,
                category: category ? toSlug(category.name) : undefined
              })
            }
          })
        );
      });
      return insights;
    }
  },
  {
    id: "emergency-runway",
    category: "emergency fund readiness",
    evaluate: (context) => {
      if (context.expense <= 0) return [];
      const emergency = context.emergencyFundSource;
      const runwayMonths = emergency.monthsCoverage;
      const guideline = emergencyFundGuideline(context.planningProfile);
      const baseBody =
        emergency.source === "goal"
          ? `Dana darurat dihitung dari progress goal ${emergency.label} sebesar ${formatCurrencyValue(emergency.amount)}, setara ${runwayMonths} bulan pengeluaran.`
          : `Dana darurat dihitung dari aset likuid sebesar ${formatCurrencyValue(emergency.amount)}, setara ${runwayMonths} bulan pengeluaran.`;
      if (runwayMonths >= guideline.minimumMonths) {
        return [
          makeInsight(context, {
            ruleId: "emergency-runway-ready",
            category: "positive achievements",
            title: runwayMonths >= guideline.idealMonths ? "Dana darurat sudah di rentang ideal" : "Dana darurat sudah melewati minimum",
            body: `${baseBody} Guardrail ${guideline.label} adalah ${guideline.minimumMonths}-${guideline.idealMonths} bulan pengeluaran.`,
            severity: "positive",
            priority: "medium",
            evidence: [
              { label: "Sumber dana darurat", value: emergency.label },
              { label: "Formula dana darurat", value: emergency.formula },
              { label: "Bulan bantalan", value: runwayMonths, unit: "count" },
              { label: "Minimum dana darurat", value: guideline.minimumMonths, unit: "count" },
              { label: "Ideal dana darurat", value: guideline.idealMonths, unit: "count" },
              { label: "Status keluarga", value: guideline.label }
            ],
            action: { label: "Lihat tujuan", route: "/goals" }
          })
        ];
      }
      return [
        makeInsight(context, {
          ruleId: "emergency-runway-low",
          category: "emergency fund readiness",
          title: "Dana darurat masih terbatas",
          body: `${baseBody} Guardrail ${guideline.label} adalah ${guideline.minimumMonths}-${guideline.idealMonths} bulan pengeluaran, jadi prioritasnya mengejar minimum dulu.`,
          severity: "warning",
          priority: runwayMonths < guideline.minimumMonths / 2 ? "high" : "medium",
          evidence: [
            { label: "Sumber dana darurat", value: emergency.label },
            { label: "Formula dana darurat", value: emergency.formula },
            { label: "Bulan bantalan", value: runwayMonths, unit: "count" },
            { label: "Minimum dana darurat", value: guideline.minimumMonths, unit: "count" },
            { label: "Ideal dana darurat", value: guideline.idealMonths, unit: "count" },
            { label: "Status keluarga", value: guideline.label },
            { label: "Aset likuid", value: context.liquidBalance, unit: "IDR" },
            { label: "Dana darurat terpakai", value: emergency.amount, unit: "IDR" },
            { label: "Burn rate bulanan", value: context.monthlyBurnRate, unit: "IDR" }
          ],
          action: { label: "Buat tujuan", route: "/goals" }
        })
      ];
    }
  },
  {
    id: "recurring-load",
    category: "recurring expense analysis",
    evaluate: (context) => {
      if (context.income <= 0) return [];
      const total = recurringMonthlyTotal(context.recurringRules);
      const share = Math.round((total / context.income) * 100);
      if (share < 30) return [];
      return [
        makeInsight(context, {
          ruleId: "recurring-load",
          category: "recurring expense analysis",
          title: "Komitmen rutin cukup besar",
          body: "Template rutin mengambil porsi besar dari pemasukan. Meninjau komitmen tetap dapat membuat ruang fleksibel lebih jelas.",
          severity: "warning",
          priority: share >= 45 ? "high" : "medium",
          evidence: [
            { label: "Porsi rutin", value: share, unit: "percent" },
            { label: "Rutin bulanan", value: total, unit: "IDR" }
          ],
          action: { label: "Lihat transaksi", route: buildExplorerRoute({ month: context.period }) }
        })
      ];
    }
  },
  {
    id: "debt-ratio",
    category: "debt health",
    evaluate: (context) => {
      if (context.debtBalance <= 0) return [];
      const ratio = context.financialModel.debtRatio;
      if (ratio < 30) return [];
      return [
        makeInsight(context, {
          ruleId: "debt-ratio",
          category: "debt health",
          title: "Rasio utang perlu dipantau",
          body: "Utang menjadi porsi yang cukup besar dibanding total aset. Target pelunasan bertahap dapat membuat rencana lebih mudah dibaca.",
          severity: "warning",
          priority: ratio >= 50 ? "high" : "medium",
          evidence: [
            { label: "Rasio utang", value: ratio, unit: "percent" },
            { label: "Saldo utang", value: context.debtBalance, unit: "IDR" }
          ],
          action: { label: "Lihat tujuan", route: "/goals" }
        })
      ];
    }
  },
  {
    id: "cashflow-surplus",
    category: "planning suggestions",
    evaluate: (context) => {
      if (context.income <= 0) return [];
      const cashflow = context.income - context.expense;
      const recurring = recurringMonthlyTotal(context.recurringRules);
      const plannedGoalContributions = context.goals.reduce((total, goal) => total + (goal.monthlyContribution ?? 0), 0);
      const unallocated = cashflow - recurring - plannedGoalContributions;
      if (unallocated < Math.max(context.income * 0.08, 250000) || plannedGoalContributions >= cashflow * 0.5) return [];
      return [
        makeInsight(context, {
          ruleId: "cashflow-surplus",
          category: "planning suggestions",
          title: "Ada surplus cashflow yang bisa diarahkan",
          body: "Setelah pengeluaran dan komitmen rutin, masih ada ruang yang belum jelas dialokasikan. Sebagian bisa diarahkan ke dana darurat, pelunasan utang, atau tujuan terdekat.",
          severity: "info",
          priority: "medium",
          evidence: [
            { label: "Cashflow bulan ini", value: cashflow, unit: "IDR" },
            { label: "Komitmen rutin", value: recurring, unit: "IDR" },
            { label: "Kontribusi tujuan", value: plannedGoalContributions, unit: "IDR" },
            { label: "Surplus belum dialokasikan", value: unallocated, unit: "IDR" }
          ],
          action: { label: "Atur tujuan", route: "/goals" }
        })
      ];
    }
  },
  {
    id: "income-volatility",
    category: "income dependency",
    evaluate: (context) => {
      if (context.previousIncome <= 0 || context.income <= 0) return [];
      const change = Math.round(((context.income - context.previousIncome) / context.previousIncome) * 100);
      if (Math.abs(change) < 30) return [];
      return [
        makeInsight(context, {
          ruleId: "income-volatility",
          category: "income dependency",
          title: "Pemasukan bulan ini cukup berubah",
          body: "Pemasukan bergerak cukup jauh dari bulan lalu. Untuk planning, gunakan angka konservatif agar budget tidak terlalu bergantung pada bulan yang sedang tinggi.",
          severity: "warning",
          priority: "medium",
          evidence: [
            { label: "Pemasukan bulan ini", value: context.income, unit: "IDR" },
            { label: "Pemasukan bulan lalu", value: context.previousIncome, unit: "IDR" },
            { label: "Perubahan income", value: change, unit: "percent" }
          ],
          action: { label: "Lihat dashboard", route: "/" }
        })
      ];
    }
  },
  {
    id: "goal-contribution-low",
    category: "recommendations",
    evaluate: (context) => {
      return context.goals
        .filter((goal) => goal.status === "active" && goal.targetDate && goal.targetAmount > goal.currentAmount)
        .flatMap((goal) => {
          const projection = projectGoal(goal, context.planningProfile, context.referenceDate);
          const monthsLeft = projection.monthsLeft ?? monthsUntil(goal.targetDate!, context.referenceDate);
          if (monthsLeft <= 0) return [];
          const required = projection.requiredMonthlyContribution ?? 0;
          const planned = goal.monthlyContribution ?? 0;
          if (required <= 0 || planned >= required * 0.75) return [];
          return [
            makeInsight(context, {
              ruleId: `goal-contribution-low-${goal.id}`,
              category: "recommendations",
              title: `${goal.name} butuh kontribusi lebih jelas`,
              body: "Dengan target waktu yang ada, kontribusi bulanan sekarang belum mengejar ritme yang dibutuhkan. Sesuaikan nominal, target, atau tenggat agar rencananya realistis.",
              severity: "warning",
              priority: "medium",
              evidence: [
                { label: "Kontribusi sekarang", value: planned, unit: "IDR" },
                { label: "Estimasi dibutuhkan", value: required, unit: "IDR" },
                { label: "Sisa bulan", value: Number(monthsLeft.toFixed(1)), unit: "count" },
                { label: "Return asumsi", value: projection.annualReturn, unit: "percent" }
              ],
              action: { label: "Edit tujuan", route: "/goals" }
            })
          ];
        });
    }
  },
  {
    id: "retirement-readiness",
    category: "retirement readiness",
    evaluate: (context) => {
      const retirementGoal = context.goals.find((goal) => goal.status === "active" && goal.type === "retirement");
      if (!retirementGoal || !context.planningProfile) return [];
      const projection = projectGoal(retirementGoal, context.planningProfile, context.referenceDate);
      const yearsToRetirement = Math.max(context.planningProfile.retirementTargetAge - context.planningProfile.currentAge, 0);
      if (projection.feasibilityStatus === "on_track" || projection.feasibilityStatus === "complete") {
        return [
          makeInsight(context, {
            ruleId: "retirement-readiness-ready",
            category: "retirement readiness",
            title: "Rencana pensiun terlihat selaras",
            body: "Target nominal pensiun, horizon usia, kontribusi bulanan, dan expected return saat ini terbaca selaras. Untuk planning yang lebih lengkap, validasi lagi target nominalnya dari estimasi biaya hidup pensiun, inflasi, dan lama masa pensiun.",
            severity: "positive",
            priority: "medium",
            evidence: [
              { label: "Usia sekarang", value: context.planningProfile.currentAge, unit: "count" },
              { label: "Target pensiun", value: context.planningProfile.retirementTargetAge, unit: "count" },
              { label: "Estimasi future value", value: projection.estimatedFutureValue, unit: "IDR" },
              { label: "Return asumsi", value: projection.annualReturn, unit: "percent" }
            ],
            action: { label: "Lihat goals", route: "/goals" }
          })
        ];
      }
      return [
        makeInsight(context, {
          ruleId: "retirement-readiness-gap",
          category: "retirement readiness",
          title: "Rencana pensiun butuh penguatan",
          body: "Dengan usia, target nominal pensiun, horizon, dan expected return saat ini, kontribusi bulanan belum cukup mengejar kebutuhan target. Target nominal ini sebaiknya divalidasi dari biaya hidup pensiun per bulan, asumsi inflasi, lama masa pensiun, dan return investasi yang realistis.",
          severity: projection.feasibilityStatus === "behind" ? "warning" : "info",
          priority: "high",
          evidence: [
            { label: "Tahun menuju pensiun", value: yearsToRetirement, unit: "count" },
            { label: "Funding gap", value: projection.fundingGap, unit: "IDR" },
            { label: "Rekomendasi per bulan", value: projection.requiredMonthlyContribution ?? 0, unit: "IDR" },
            { label: "Return asumsi", value: projection.annualReturn, unit: "percent" }
          ],
          action: { label: "Atur goals", route: "/goals" }
        })
      ];
    }
  },
  {
    id: "house-affordability",
    category: "house affordability",
    evaluate: (context) => {
      const houseGoal = context.goals.find((goal) => goal.status === "active" && goal.type === "house_purchase");
      if (!houseGoal || context.income <= 0) return [];
      const projection = projectGoal(houseGoal, context.planningProfile, context.referenceDate);
      const contributionShare = ((houseGoal.monthlyContribution ?? 0) / context.income) * 100;
      if (projection.feasibilityStatus === "on_track" && contributionShare <= 30) return [];
      return [
        makeInsight(context, {
          ruleId: "house-affordability-gap",
          category: "house affordability",
          title: "Target rumah perlu dicek kemampuan bulanannya",
          body: "Target pembelian rumah terbaca berat terhadap cashflow atau belum mengejar jadwal. Gunakan kontribusi yang realistis agar tidak menekan kebutuhan pokok.",
          severity: contributionShare > 35 || projection.feasibilityStatus === "behind" ? "warning" : "info",
          priority: "high",
          evidence: [
            { label: "Porsi kontribusi rumah", value: Math.round(contributionShare), unit: "percent" },
            { label: "Funding gap", value: projection.fundingGap, unit: "IDR" },
            { label: "Rekomendasi per bulan", value: projection.requiredMonthlyContribution ?? 0, unit: "IDR" }
          ],
          action: { label: "Lihat goals", route: "/goals" }
        })
      ];
    }
  },
  {
    id: "education-funding",
    category: "education funding readiness",
    evaluate: (context) => {
      const educationGoals = context.goals.filter((goal) => goal.status === "active" && goal.type === "education");
      return educationGoals.flatMap((goal) => {
        const projection = projectGoal(goal, context.planningProfile, context.referenceDate);
        if (projection.feasibilityStatus === "on_track" || projection.feasibilityStatus === "complete") return [];
        return [
          makeInsight(context, {
            ruleId: `education-funding-${goal.id}`,
            category: "education funding readiness",
            title: `${goal.name} belum sepenuhnya terdanai`,
            body: "Tujuan pendidikan memiliki tenggat yang sensitif. Menambah kontribusi lebih awal mengurangi tekanan mendekati tahun kebutuhan.",
            severity: projection.feasibilityStatus === "behind" || projection.feasibilityStatus === "unfunded" ? "warning" : "info",
            priority: "medium",
            evidence: [
              { label: "Funding gap", value: projection.fundingGap, unit: "IDR" },
              { label: "Estimasi future value", value: projection.estimatedFutureValue, unit: "IDR" },
              { label: "Rekomendasi per bulan", value: projection.requiredMonthlyContribution ?? 0, unit: "IDR" }
            ],
            action: { label: "Edit tujuan", route: "/goals" }
          })
        ];
      });
    }
  },
  {
    id: "scenario-next-best-action",
    category: "planning suggestions",
    evaluate: (context) => {
      const scenarios = buildScenarioEngine({
        income: context.income,
        expense: context.expense,
        monthlyBurnRate: context.monthlyBurnRate,
        financialModel: context.financialModel,
        goals: context.goals,
        planningProfile: context.planningProfile
      });
      const best = scenarios[0];
      if (!best) return [];
      return [
        makeInsight(context, {
          ruleId: "scenario-next-best-action",
          category: "planning suggestions",
          title: best.title,
          body: `${best.summary} ${best.projectedImpact}`,
          severity: best.priority === "stabilization" || best.priority === "debt" ? "warning" : "info",
          priority: best.priority === "stabilization" ? "high" : "medium",
          evidence: [
            { label: "Scenario priority", value: best.priority },
            { label: "Aksi bulanan", value: best.monthlyAction, unit: "IDR" },
            ...best.evidence
          ],
          action: { label: best.priority === "debt" ? "Lihat Net Worth" : "Lihat Goals", route: best.priority === "debt" ? "/networth" : "/goals" }
        })
      ];
    }
  },
  {
    id: "illiquid-asset-concentration",
    category: "investment allocation",
    evaluate: (context) => {
      if (context.totalAssets <= 0) return [];
      const illiquidAssets = context.financialModel.assets
        .filter((asset) => asset.countsTowardNetWorth && !asset.isLiquid)
        .reduce((total, asset) => total + asset.amount, 0);
      const illiquidShare = Math.round((illiquidAssets / context.totalAssets) * 100);
      if (illiquidShare < 70 || context.emergencyFundSource.monthsCoverage >= 3) return [];
      return [
        makeInsight(context, {
          ruleId: "illiquid-asset-concentration",
          category: "investment allocation",
          title: "Net Worth besar belum tentu mudah dicairkan",
          body: "Sebagian besar aset tercatat tidak likuid, sementara dana darurat belum mencapai tiga bulan. Dari sudut pandang planning, kekayaan bersih perlu dibaca bersama kemampuan mencairkan dana saat kondisi mendesak.",
          severity: "warning",
          priority: "high",
          evidence: [
            { label: "Porsi aset tidak likuid", value: illiquidShare, unit: "percent" },
            { label: "Aset tidak likuid", value: illiquidAssets, unit: "IDR" },
            { label: "Dana darurat", value: context.emergencyFundSource.monthsCoverage, unit: "count" }
          ],
          action: { label: "Lihat Net Worth", route: "/networth" }
        })
      ];
    }
  },
  {
    id: "high-score-next-level",
    category: "positive achievements",
    evaluate: (context) => {
      const score = calculateFinancialHealthScore(context);
      if (score.score < 80 || context.income <= 0) return [];
      const surplus = Math.max(context.income - context.expense, 0);
      if (surplus <= 0) return [];
      return [
        makeInsight(context, {
          ruleId: "high-score-next-level",
          category: "positive achievements",
          title: "Fondasi sehat, waktunya naik kelas",
          body: "Skor finansial sudah kuat. Fokus berikutnya bukan sekadar menghemat, tetapi memberi tugas yang jelas untuk surplus: growth jangka panjang, proteksi, dan target besar yang realistis.",
          severity: "positive",
          priority: "medium",
          evidence: [
            { label: "Health score", value: score.score, unit: "count" },
            { label: "Surplus bulan ini", value: surplus, unit: "IDR" },
            { label: "Faktor terlemah", value: score.weakestFactor }
          ],
          action: { label: "Atur goals", route: "/goals" }
        })
      ];
    }
  },
  {
    id: "protection-gap-context",
    category: "financial warnings",
    evaluate: (context) => {
      const hasDependents = (context.planningProfile?.dependentsCount ?? 0) > 0 || context.planningProfile?.maritalStatus === "married";
      if (!hasDependents) return [];
      const pressure = context.emergencyFundSource.monthsCoverage < 3 || context.financialModel.debtRatio > 30 || context.income - context.expense < 0;
      if (!pressure) return [];
      return [
        makeInsight(context, {
          ruleId: "protection-gap-context",
          category: "financial warnings",
          title: "Proteksi keluarga perlu masuk checklist",
          body: "Ada tanggungan atau kewajiban rumah tangga, sementara salah satu fondasi masih tertekan. Review proteksi kesehatan, jiwa, pendapatan, dan kemampuan bayar debt sebelum menambah komitmen besar.",
          severity: "warning",
          priority: "high",
          evidence: [
            { label: "Tanggungan", value: context.planningProfile?.dependentsCount ?? 0, unit: "count" },
            { label: "Dana darurat", value: context.emergencyFundSource.monthsCoverage, unit: "count" },
            { label: "Debt ratio", value: context.financialModel.debtRatio, unit: "percent" },
            { label: "Cashflow", value: context.income - context.expense, unit: "IDR" }
          ],
          action: { label: "Planning profile", route: "/insights" }
        })
      ];
    }
  },
  {
    id: "subscription-candidate",
    category: "subscription detection",
    evaluate: (context) => {
      return detectSubscriptionCandidates(context.transactions)
        .slice(0, 2)
        .map((candidate) =>
          makeInsight(context, {
            ruleId: `subscription-candidate-${candidate.merchant}`,
            category: "subscription detection",
            title: "Kemungkinan langganan berulang",
            body: "Deteksi ini berbasis pola nama merchant dan interval transaksi. Cek dulu sebelum ditandai sebagai langganan agar false positive tetap rendah.",
            severity: "info",
            priority: "medium",
            evidence: [
              { label: "Merchant", value: candidate.merchant },
              { label: "Confidence", value: candidate.confidence },
              { label: "Kemunculan", value: candidate.count, unit: "count" },
              { label: "Median interval hari", value: candidate.medianIntervalDays, unit: "count" },
              { label: "Total nominal", value: candidate.total, unit: "IDR" }
            ],
            action: { label: "Lihat transaksi", route: buildExplorerRoute({ merchant: candidate.merchant, frequency: "routine" }) }
          })
        );
    }
  }
];

function buildHealthScoreInsight(context: InsightContext, healthScore: FinancialHealthScore): InsightDraft {
  return makeInsight(context, {
    ruleId: "financial-health-score",
    category: "financial stability",
    title: `Skor kesehatan keuangan: ${healthScore.score}`,
    body: `Kondisi saat ini terbaca ${healthRatingLabel(healthScore.rating)} berdasarkan cashflow, rasio menabung, budget, utang, dana darurat, dan komitmen rutin.`,
    severity: healthScore.score >= 80 ? "positive" : healthScore.score >= 65 ? "info" : "warning",
    priority: healthScore.score < 50 ? "high" : healthScore.score < 65 ? "medium" : "low",
    evidence: [
      { label: "Health score", value: healthScore.score, unit: "count" },
      { label: "Total score", value: `${healthScore.rawScore}/${healthScore.maxScore}` },
      { label: "Poin cashflow", value: healthScore.cashflow, unit: "count" },
      { label: "Bobot cashflow", value: "25" },
      { label: "Poin menabung", value: healthScore.savings, unit: "count" },
      { label: "Bobot menabung", value: "20" },
      { label: "Poin budget", value: healthScore.budget, unit: "count" },
      { label: "Bobot budget", value: "15" },
      { label: "Poin utang", value: healthScore.debt, unit: "count" },
      { label: "Bobot utang", value: "20" },
      { label: "Poin dana darurat", value: healthScore.emergency, unit: "count" },
      { label: "Bobot dana darurat", value: "10" },
      { label: "Poin stabilitas", value: healthScore.stability, unit: "count" },
      { label: "Bobot stabilitas", value: "10" },
      { label: "Faktor terbesar", value: healthScore.strongestFactor },
      { label: "Faktor terlemah", value: healthScore.weakestFactor }
    ],
    action: { label: "Lihat dashboard", route: "/" }
  });
}

function makeInsight(
  context: InsightContext,
  input: {
    ruleId: string;
    category: InsightCategory;
    title: string;
    body: string;
    severity: Insight["severity"];
    priority: InsightPriority;
    evidence: Insight["evidence"];
    action?: Insight["action"];
  }
): InsightDraft {
  const ruleDefinition = findPlanningRuleDefinition(input.ruleId);
  return {
    period: context.period,
    ruleId: input.ruleId,
    title: input.title,
    body: input.body,
    severity: input.severity,
    evidence: [
      { label: "Category", value: input.category },
      { label: "Priority", value: input.priority },
      { label: "Priority score", value: priorityScore(input.severity, input.category, input.priority, Boolean(input.action)), unit: "count" },
      { label: "Why", value: ruleDefinition?.description ?? "Insight ini muncul dari aturan lokal yang membaca data periode aktif." },
      { label: "Formula", value: ruleDefinition?.formula ?? "local aggregates + threshold" },
      { label: "Threshold", value: ruleDefinition?.threshold ?? "Rule-specific threshold" },
      { label: "Recommendation", value: ruleDefinition?.recommendation ?? input.body },
      { label: "Data sources", value: ruleDefinition?.dataSources.join(", ") ?? "transactions, accounts" },
      { label: "Privacy", value: "Calculated from your local data on this device." },
      ...input.evidence
    ],
    action: input.action,
    category: input.category,
    priority: input.priority,
    priorityScore: priorityScore(input.severity, input.category, input.priority, Boolean(input.action))
  };
}

function toPersistedInsight(draft: InsightDraft): Insight {
  const now = new Date().toISOString();
  return {
    id: stableInsightId(draft.period, draft.ruleId),
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    version: 1,
    period: draft.period,
    ruleId: draft.ruleId,
    title: draft.title,
    body: draft.body,
    severity: draft.severity,
    evidence: draft.evidence,
    action: draft.action,
    status: "new"
  };
}

function rankInsights(insights: InsightDraft[]) {
  const byRuleId = new Map<string, InsightDraft>();
  [...insights]
    .sort((left, right) => right.priorityScore - left.priorityScore)
    .forEach((insight) => {
      if (!byRuleId.has(insight.ruleId)) byRuleId.set(insight.ruleId, insight);
    });

  return Array.from(byRuleId.values()).slice(0, 16);
}

function priorityScore(severity: Insight["severity"], category: InsightCategory, priority: InsightPriority, hasAction: boolean) {
  const severityWeight = { critical: 80, warning: 60, info: 35, positive: 25 }[severity];
  const categoryWeight = categoryWeightFor(category);
  const priorityWeight = { urgent: 20, high: 14, medium: 8, low: 3 }[priority];
  return severityWeight + categoryWeight + priorityWeight + (hasAction ? 8 : 0);
}

function categoryWeightFor(category: InsightCategory) {
  if (["cashflow health", "financial warnings", "debt health", "future cashflow prediction", "retirement readiness", "house affordability"].includes(category)) return 15;
  if (category === "education funding readiness") return 12;
  if (["emergency fund readiness", "overspending", "budgeting quality", "spending anomaly"].includes(category)) return 12;
  if (["savings health", "recurring expense analysis", "subscription detection"].includes(category)) return 10;
  if (category === "positive achievements") return 5;
  return 7;
}

function categoryTotals(transactions: Transaction[]) {
  const totals = new Map<string, number>();
  transactions
    .filter((transaction) => transaction.type === "expense")
    .forEach((transaction) => totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amount));
  return totals;
}

function sumByType(transactions: Transaction[], type: Transaction["type"]) {
  return transactions.filter((transaction) => transaction.type === type).reduce((total, transaction) => total + transaction.amount, 0);
}

function budgetPercent(context: InsightContext, budget: Budget) {
  const spent = context.currentMonthTransactions
    .filter((transaction) => {
      if (transaction.type !== "expense") return false;
      if (transaction.categoryId !== budget.categoryId) return false;
      if (budget.subcategoryId && transaction.subcategoryId !== budget.subcategoryId) return false;
      return true;
    })
    .reduce((total, transaction) => total + transaction.amount, 0);
  const limit = effectiveBudgetLimit(budget);
  return limit > 0 ? Math.round((spent / limit) * 100) : 0;
}

function effectiveBudgetLimit(budget: Budget) {
  return budget.limitAmount + (budget.rolloverEnabled ? budget.rolloverAmount : 0);
}

function recurringMonthlyTotal(rules: RecurringRule[]) {
  return rules.reduce((total, rule) => {
    if (rule.frequency === "daily") return total + rule.transactionTemplate.amount * 30;
    if (rule.frequency === "weekly") return total + rule.transactionTemplate.amount * 4;
    if (rule.frequency === "yearly") return total + rule.transactionTemplate.amount / 12;
    return total + rule.transactionTemplate.amount;
  }, 0);
}

function healthRatingLabel(rating: FinancialHealthScore["rating"]) {
  const labels: Record<FinancialHealthScore["rating"], string> = {
    strong: "kuat",
    stable: "stabil",
    needs_attention: "perlu perhatian ringan",
    high_risk: "perlu ditata ulang bertahap"
  };
  return labels[rating];
}

function shiftPeriod(periodKey: string, offset: number) {
  const [year, month] = periodKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthsUntil(targetDate: string, referenceDate: Date) {
  const [year, month, day] = targetDate.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const days = (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(days / (365.2425 / 12), 0);
}

function clampScore(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function stableInsightId(period: string, ruleId: string) {
  return `insight-${toSlug(period)}-${toSlug(ruleId)}`;
}

function resolveEmergencyFundSource(goals: Goal[], liquidAssets: number, monthlyBurnRate: number): EmergencyFundSource {
  const emergencyGoal = goals
    .filter((goal) => goal.type === "emergency_fund" || /dana darurat|emergency/i.test(goal.name))
    .sort((left, right) => right.currentAmount - left.currentAmount)[0];
  const amount = emergencyGoal ? Math.max(emergencyGoal.currentAmount, 0) : Math.max(liquidAssets, 0);
  const monthsCoverage = monthlyBurnRate <= 0 ? (amount > 0 ? 6 : 0) : Number((amount / monthlyBurnRate).toFixed(1));

  if (emergencyGoal) {
    return {
      source: "goal",
      label: emergencyGoal.name,
      amount,
      monthsCoverage,
      formula: "progress goal Dana Darurat / burn rate bulanan"
    };
  }

  return {
    source: "liquid_assets",
    label: "aset likuid",
    amount,
    monthsCoverage,
    formula: "aset likuid / burn rate bulanan"
  };
}


function detectSubscriptionCandidates(transactions: Transaction[]) {
  const grouped = new Map<string, Transaction[]>();
  transactions
    .filter((transaction) => transaction.type === "expense" && transaction.merchant && transaction.amount > 0)
    .forEach((transaction) => {
      const merchant = transaction.merchant!.trim().toLowerCase();
      if (merchant.length < 3) return;
      grouped.set(merchant, [...(grouped.get(merchant) ?? []), transaction]);
    });

  return Array.from(grouped.entries()).flatMap(([merchant, rows]) => {
    const sorted = rows.sort((left, right) => left.date.localeCompare(right.date));
    if (sorted.length < 3) return [];
    const intervals = sorted.slice(1).map((row, index) => daysBetween(sorted[index].date, row.date));
    const medianIntervalDays = Math.round(median(intervals));
    const intervalMatches = intervals.filter((days) => days >= 25 && days <= 35).length;
    const amounts = sorted.map((row) => row.amount);
    const amountMedian = median(amounts);
    const amountVariance = amountMedian > 0 ? Math.max(...amounts.map((amount) => Math.abs(amount - amountMedian) / amountMedian)) : 1;
    if (intervalMatches < 2 || amountVariance > 0.25) return [];
    const confidence = intervalMatches >= 3 && amountVariance <= 0.1 ? "high" : "medium";
    return [{ merchant, count: sorted.length, total: amounts.reduce((sum, amount) => sum + amount, 0), medianIntervalDays, confidence }];
  });
}

function daysBetween(leftDate: string, rightDate: string) {
  return Math.round((new Date(rightDate).getTime() - new Date(leftDate).getTime()) / (24 * 60 * 60 * 1000));
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatCurrencyValue(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

function buildExplorerRoute(filters: { category?: string; month?: string; behavior?: string; merchant?: string; frequency?: string; tag?: string; dateFrom?: string; dateTo?: string }) {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.month) params.set("month", filters.month);
  if (filters.behavior) params.set("behavior", filters.behavior);
  if (filters.merchant) params.set("merchant", filters.merchant);
  if (filters.frequency) params.set("frequency", filters.frequency);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const query = params.toString();
  return `/transactions/explorer${query ? `?${query}` : ""}`;
}
