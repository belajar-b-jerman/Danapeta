import type { Account, Asset, Budget, Category, Goal, Liability, RecurringRule, Transaction } from "../db/schema";
import { buildFinancialModel, type FinancialModel } from "./financialModel";

export type MonthlyPoint = {
  label: string;
  income: number;
  expense: number;
  cashflow: number;
};

export type CategoryPoint = {
  id: string;
  name: string;
  value: number;
  color: string;
  percent: number;
};

export type CategoryTrendSeries = {
  id: string;
  name: string;
  color: string;
  total: number;
  changePercent: number;
};

export type CategoryTrendPoint = {
  label: string;
  values: Record<string, number>;
};

export type BudgetPoint = {
  id: string;
  name: string;
  limit: number;
  spent: number;
  percent: number;
  remaining: number;
};

export type BehaviorPoint = {
  behavior: string;
  amount: number;
  count: number;
};

export type GoalSummaryPoint = {
  activeCount: number;
  nearestGoal?: {
    id: string;
    name: string;
    targetDate?: string;
    percent: number;
    remaining: number;
  };
  averageProgress: number;
};

export type BudgetSummaryPoint = {
  activeCount: number;
  exceededCount: number;
  remainingSafeBudget: number;
};

export type DashboardAnalytics = {
  totalIncome: number;
  totalExpense: number;
  leftToSpend: number;
  savingsRate: number;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  liquidAssets: number;
  emergencyDesignatedAssets: number;
  debtRatio: number;
  monthlyCashflow: number;
  monthlyTrend: MonthlyPoint[];
  categoryBreakdown: CategoryPoint[];
  topCategories: CategoryPoint[];
  categoryTrendSeries: CategoryTrendSeries[];
  categoryTrendData: CategoryTrendPoint[];
  budgetProgress: BudgetPoint[];
  budgetSummary: BudgetSummaryPoint;
  goalSummary: GoalSummaryPoint;
  behaviorAnalysis: BehaviorPoint[];
  recurringTotal: number;
  recurringCount: number;
  previousMonthExpense: number;
  previousMonthIncome: number;
  expenseChangePercent: number;
  incomeChangePercent: number;
};

export function buildDashboardAnalytics(input: {
  period: string;
  accounts: Account[];
  assets?: Asset[];
  liabilities?: Liability[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals?: Goal[];
  recurringRules: RecurringRule[];
  referenceDate?: Date;
}): DashboardAnalytics {
  const referenceDate = input.referenceDate ?? new Date();
  const periodKey = toPeriodKey(input.period, referenceDate);
  const previousPeriodKey = shiftPeriod(periodKey, -1);
  const categoryMap = new Map(input.categories.map((category) => [category.id, category]));
  const activeTransactions = input.transactions.filter((transaction) => !transaction.deletedAt);
  const monthTransactions = activeTransactions.filter((transaction) => transaction.date.startsWith(periodKey));
  const previousMonthTransactions = activeTransactions.filter((transaction) => transaction.date.startsWith(previousPeriodKey));

  const totalIncome = sumByType(monthTransactions, "income");
  const totalExpense = sumByType(monthTransactions, "expense");
  const previousMonthIncome = sumByType(previousMonthTransactions, "income");
  const previousMonthExpense = sumByType(previousMonthTransactions, "expense");
  const financialModel = buildFinancialModel({ accounts: input.accounts, assets: input.assets, liabilities: input.liabilities, goals: input.goals });
  const categoryBreakdown = buildCategoryBreakdown(monthTransactions, categoryMap);
  const budgetProgress = buildBudgetProgress(input.budgets, monthTransactions, categoryMap, periodKey);
  const categoryTrends = buildCategorySpendingTrends(activeTransactions, categoryMap, referenceDate, 6);

  return {
    totalIncome,
    totalExpense,
    leftToSpend: totalIncome - totalExpense,
    savingsRate: totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0,
    netWorth: financialModel.netWorth,
    totalAssets: financialModel.totalAssets,
    totalLiabilities: financialModel.totalLiabilities,
    liquidAssets: financialModel.liquidAssets,
    emergencyDesignatedAssets: financialModel.emergencyDesignatedAssets,
    debtRatio: financialModel.debtRatio,
    monthlyCashflow: totalIncome - totalExpense,
    monthlyTrend: buildMonthlyTrend(activeTransactions, referenceDate, 6),
    categoryBreakdown,
    topCategories: categoryBreakdown.slice(0, 5),
    categoryTrendSeries: categoryTrends.series,
    categoryTrendData: categoryTrends.data,
    budgetProgress,
    budgetSummary: buildBudgetSummary(budgetProgress),
    goalSummary: buildGoalSummary(input.goals ?? []),
    behaviorAnalysis: buildBehaviorAnalysis(monthTransactions),
    recurringTotal: input.recurringRules
      .filter((rule) => rule.status === "active")
      .reduce((total, rule) => total + rule.transactionTemplate.amount, 0),
    recurringCount: input.recurringRules.filter((rule) => rule.status === "active").length,
    previousMonthExpense,
    previousMonthIncome,
    expenseChangePercent: percentChange(previousMonthExpense, totalExpense),
    incomeChangePercent: percentChange(previousMonthIncome, totalIncome)
  };
}

export function buildNetWorthModel(input: { accounts: Account[]; assets?: Asset[]; liabilities?: Liability[]; goals?: Goal[] }): FinancialModel {
  return buildFinancialModel(input);
}

export function toPeriodKey(period: string, fallbackDate = new Date()) {
  const normalizedPeriod = period.trim().toLowerCase();
  const monthIndex = indonesianMonths.indexOf(normalizedPeriod.split(/\s+/)[0]);
  const year = Number(normalizedPeriod.match(/\d{4}/)?.[0]);

  if (monthIndex >= 0 && year) {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  }

  const parsed = new Date(`1 ${period}`);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
  }

  return `${fallbackDate.getFullYear()}-${String(fallbackDate.getMonth() + 1).padStart(2, "0")}`;
}

const indonesianMonths = [
  "januari",
  "februari",
  "maret",
  "april",
  "mei",
  "juni",
  "juli",
  "agustus",
  "september",
  "oktober",
  "november",
  "desember"
];

function sumByType(transactions: Transaction[], type: Transaction["type"]) {
  return transactions.filter((transaction) => transaction.type === type).reduce((total, transaction) => total + transaction.amount, 0);
}

function buildMonthlyTrend(transactions: Transaction[], referenceDate: Date, monthCount: number) {
  return Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (monthCount - 1 - index), 1);
    const periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthTransactions = transactions.filter((transaction) => transaction.date.startsWith(periodKey));
    const income = sumByType(monthTransactions, "income");
    const expense = sumByType(monthTransactions, "expense");

    return {
      label: date.toLocaleDateString("id-ID", { month: "short" }),
      income,
      expense,
      cashflow: income - expense
    };
  });
}

function buildCategoryBreakdown(transactions: Transaction[], categoryMap: Map<string, Category>) {
  const expenseTransactions = transactions.filter((transaction) => transaction.type === "expense");
  const totalExpense = expenseTransactions.reduce((total, transaction) => total + transaction.amount, 0);
  const totals = new Map<string, number>();

  expenseTransactions.forEach((transaction) => {
    totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amount);
  });

  return Array.from(totals.entries())
    .map(([id, value]) => {
      const category = categoryMap.get(id);
      return {
        id,
        name: category?.name ?? "Uncategorized",
        value,
        color: category?.color ?? "#88B99A",
        percent: totalExpense > 0 ? Math.round((value / totalExpense) * 100) : 0
      };
    })
    .sort((left, right) => right.value - left.value);
}

function buildCategorySpendingTrends(
  transactions: Transaction[],
  categoryMap: Map<string, Category>,
  referenceDate: Date,
  monthCount: number
) {
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (monthCount - 1 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("id-ID", { month: "short" })
    };
  });
  const monthKeys = new Set(months.map((month) => month.key));
  const totals = new Map<string, number>();

  transactions
    .filter((transaction) => transaction.type === "expense" && monthKeys.has(transaction.date.slice(0, 7)))
    .forEach((transaction) => {
      totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amount);
    });

  const series = Array.from(totals.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([id, total]) => {
      const category = categoryMap.get(id);
      const first = sumCategoryForMonth(transactions, id, months[0]?.key ?? "");
      const last = sumCategoryForMonth(transactions, id, months[months.length - 1]?.key ?? "");
      return {
        id,
        name: category?.name ?? "Uncategorized",
        color: category?.color ?? "#88B99A",
        total,
        changePercent: percentChange(first, last)
      };
    });

  const data = months.map((month) => ({
    label: month.label,
    values: Object.fromEntries(series.map((item) => [item.id, sumCategoryForMonth(transactions, item.id, month.key)]))
  }));

  return { series, data };
}

function sumCategoryForMonth(transactions: Transaction[], categoryId: string, periodKey: string) {
  return transactions
    .filter((transaction) => transaction.type === "expense" && transaction.categoryId === categoryId && transaction.date.startsWith(periodKey))
    .reduce((total, transaction) => total + transaction.amount, 0);
}

function buildBudgetProgress(
  budgets: Budget[],
  transactions: Transaction[],
  categoryMap: Map<string, Category>,
  periodKey: string
) {
  return budgets
    .filter((budget) => budget.period === periodKey)
    .map((budget) => {
      const spent = transactions
        .filter((transaction) => {
          if (transaction.type !== "expense") return false;
          if (transaction.categoryId !== budget.categoryId) return false;
          if (budget.subcategoryId && transaction.subcategoryId !== budget.subcategoryId) return false;
          return true;
        })
        .reduce((total, transaction) => total + transaction.amount, 0);

      return {
        id: budget.id,
        name: budget.name || categoryMap.get(budget.categoryId)?.name || "Budget",
        limit: budget.limitAmount,
        spent,
        percent: budget.limitAmount > 0 ? Math.min(Math.round((spent / budget.limitAmount) * 100), 100) : 0,
        remaining: budget.limitAmount - spent
      };
    })
    .sort((left, right) => right.percent - left.percent);
}

function buildBudgetSummary(budgets: BudgetPoint[]): BudgetSummaryPoint {
  return {
    activeCount: budgets.length,
    exceededCount: budgets.filter((budget) => budget.spent > budget.limit).length,
    remainingSafeBudget: budgets.reduce((total, budget) => total + Math.max(budget.remaining, 0), 0)
  };
}

function buildGoalSummary(goals: Goal[]): GoalSummaryPoint {
  const activeGoals = goals.filter((goal) => !goal.deletedAt && goal.status === "active");
  const nearestGoal = [...activeGoals]
    .filter((goal) => goal.targetDate)
    .sort((left, right) => (left.targetDate ?? "").localeCompare(right.targetDate ?? ""))[0] ?? activeGoals[0];
  const averageProgress =
    activeGoals.length > 0
      ? Math.round(
          activeGoals.reduce((total, goal) => total + (goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0), 0) /
            activeGoals.length
        )
      : 0;

  return {
    activeCount: activeGoals.length,
    nearestGoal: nearestGoal
      ? {
          id: nearestGoal.id,
          name: nearestGoal.name,
          targetDate: nearestGoal.targetDate,
          percent: nearestGoal.targetAmount > 0 ? Math.min(Math.round((nearestGoal.currentAmount / nearestGoal.targetAmount) * 100), 100) : 0,
          remaining: Math.max(nearestGoal.targetAmount - nearestGoal.currentAmount, 0)
        }
      : undefined,
    averageProgress
  };
}

function buildBehaviorAnalysis(transactions: Transaction[]) {
  const totals = new Map<string, { amount: number; count: number }>();

  transactions
    .filter((transaction) => transaction.type === "expense")
    .forEach((transaction) => {
      const behavior = transaction.behavior ?? "unlabeled";
      const current = totals.get(behavior) ?? { amount: 0, count: 0 };
      totals.set(behavior, { amount: current.amount + transaction.amount, count: current.count + 1 });
    });

  return Array.from(totals.entries())
    .map(([behavior, value]) => ({ behavior, ...value }))
    .sort((left, right) => right.amount - left.amount);
}

function shiftPeriod(periodKey: string, offset: number) {
  const [year, month] = periodKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function percentChange(previous: number, current: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
