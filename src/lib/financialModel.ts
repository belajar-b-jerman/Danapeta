import type { Account, Asset, Goal, Liability } from "../db/schema";
import { getAccountType, isLiabilityAccount } from "./accounts";

export type AssetKind =
  | "cash"
  | "bank_balance"
  | "savings_allocation"
  | "emergency_fund"
  | "goal_linked_savings"
  | "investment"
  | "property"
  | "vehicle"
  | "business"
  | "collectible"
  | "other_asset";

export type LiabilityKind = "debt" | "credit" | "mortgage" | "installment" | "loan";

export type GoalFinancialRole = "asset_accumulation" | "liability_reduction" | "growth_projection" | "planning_only";

export type AssetItem = {
  id: string;
  source: "account" | "asset" | "goal";
  sourceId: string;
  name: string;
  kind: AssetKind;
  amount: number;
  countsTowardNetWorth: boolean;
  isLiquid: boolean;
  isEmergencyDesignated: boolean;
  isGoalLinked: boolean;
};

export type LiabilityItem = {
  id: string;
  source: "account" | "liability" | "goal";
  sourceId: string;
  name: string;
  kind: LiabilityKind;
  amount: number;
  payoffProgress?: number;
  linkedGoalId?: string;
};

export type GoalRelationship = {
  goalId: string;
  role: GoalFinancialRole;
  contributesToAssets: boolean;
  contributesToLiabilityReduction: boolean;
  linkedAccountId?: string;
  assetAmount: number;
  liabilityAmount: number;
  projectedAnnualReturn: number;
};

export type FinancialModel = {
  assets: AssetItem[];
  liabilities: LiabilityItem[];
  goalRelationships: GoalRelationship[];
  totalAssets: number;
  liquidAssets: number;
  emergencyDesignatedAssets: number;
  totalLiabilities: number;
  netWorth: number;
  debtRatio: number;
};

const liquidAccountTypes: Account["type"][] = ["cash", "bank", "ewallet", "savings"];

export function buildFinancialModel(input: { accounts: Account[]; goals?: Goal[]; assets?: Asset[]; liabilities?: Liability[] }): FinancialModel {
  const accounts = input.accounts.filter((account) => !account.deletedAt && !account.isArchived);
  const goals = (input.goals ?? []).filter((goal) => !goal.deletedAt && goal.status !== "archived");
  const explicitAssets = (input.assets ?? []).filter((asset) => !asset.deletedAt && !asset.isArchived && asset.includeInNetWorth);
  const explicitLiabilities = (input.liabilities ?? []).filter(
    (liability) => !liability.deletedAt && !liability.isArchived && liability.includeInNetWorth
  );
  const accountIds = new Set(accounts.map((account) => account.id));
  const goalRelationships = goals.map((goal) => buildGoalRelationship(goal, accountIds));
  const assets = [
    ...accounts.flatMap(accountToAssets),
    ...explicitAssets.map(assetToAssetItem)
  ];
  const liabilities = [
    ...accounts.flatMap((account) => accountToLiabilities(account, goals)),
    ...explicitLiabilities.map(liabilityToLiabilityItem)
  ];
  const netWorthAssets = assets.filter((asset) => asset.countsTowardNetWorth);
  const totalAssets = sumAmounts(netWorthAssets);
  const liquidAssets = sumAmounts(netWorthAssets.filter((asset) => asset.isLiquid));
  const emergencyDesignatedAssets = sumAmounts(assets.filter((asset) => asset.isEmergencyDesignated));
  const totalLiabilities = sumAmounts(liabilities);

  return {
    assets,
    liabilities,
    goalRelationships,
    totalAssets,
    liquidAssets,
    emergencyDesignatedAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    debtRatio: calculateDebtRatio(totalLiabilities, totalAssets)
  };
}

export function estimateMonthlyBurnRate(transactions: Array<{ type: "income" | "expense" | "transfer"; amount: number; date: string }>, fallbackExpense = 0) {
  const expenseByMonth = new Map<string, number>();

  transactions
    .filter((transaction) => transaction.type === "expense")
    .forEach((transaction) => {
      const month = transaction.date.slice(0, 7);
      expenseByMonth.set(month, (expenseByMonth.get(month) ?? 0) + transaction.amount);
    });

  const monthlyExpenses = Array.from(expenseByMonth.values()).filter((amount) => amount > 0);
  if (monthlyExpenses.length === 0) return fallbackExpense;
  return Math.round(monthlyExpenses.reduce((total, amount) => total + amount, 0) / monthlyExpenses.length);
}

export function calculateEmergencyRunwayMonths(financialModel: FinancialModel, monthlyBurnRate: number) {
  if (monthlyBurnRate <= 0) return financialModel.liquidAssets > 0 || financialModel.emergencyDesignatedAssets > 0 ? 6 : 0;
  const emergencyBase = Math.max(financialModel.liquidAssets, financialModel.emergencyDesignatedAssets);
  return Number((emergencyBase / monthlyBurnRate).toFixed(1));
}

function accountToAssets(account: Account): AssetItem[] {
  if (getAccountType(account) !== "asset" || account.currentBalance <= 0) return [];

  return [
    {
      id: `asset-account-${account.id}`,
      source: "account",
      sourceId: account.id,
      name: account.name,
      kind: account.type === "investment" ? "investment" : account.type === "savings" ? "savings_allocation" : account.type === "cash" ? "cash" : "bank_balance",
      amount: account.currentBalance,
      countsTowardNetWorth: true,
      isLiquid: liquidAccountTypes.includes(account.type),
      isEmergencyDesignated: false,
      isGoalLinked: false
    }
  ];
}

function assetToAssetItem(asset: Asset): AssetItem {
  return {
    id: `asset-${asset.id}`,
    source: "asset",
    sourceId: asset.id,
    name: asset.name,
    kind: manualAssetKind(asset),
    amount: Math.max(asset.currentValue, 0),
    countsTowardNetWorth: asset.includeInNetWorth,
    isLiquid: asset.liquidity === "liquid",
    isEmergencyDesignated: false,
    isGoalLinked: Boolean(asset.linkedGoalId)
  };
}

function manualAssetKind(asset: Asset): AssetKind {
  if (asset.type === "investment") return "investment";
  if (asset.type === "cash") return "cash";
  if (asset.type === "bank" || asset.type === "ewallet") return "bank_balance";
  if (asset.type === "savings") return "savings_allocation";
  if (asset.type === "property") return "property";
  if (asset.type === "vehicle") return "vehicle";
  if (asset.type === "business") return "business";
  if (asset.type === "collectible") return "collectible";
  return "other_asset";
}

function accountToLiabilities(account: Account, goals: Goal[]): LiabilityItem[] {
  const amount = isLiabilityAccount(account) ? Math.abs(account.currentBalance) : Math.abs(Math.min(account.currentBalance, 0));
  if (amount <= 0) return [];

  const linkedGoal = goals.find((goal) => goal.type === "debt_payoff" && goal.linkedAccountId === account.id);

  return [
    {
      id: `liability-account-${account.id}`,
      source: "account",
      sourceId: account.id,
      name: account.name,
      kind: account.type === "mortgage" ? "mortgage" : account.type === "installment" ? "installment" : account.type === "loan" ? "loan" : account.type === "credit" ? "credit" : "debt",
      amount,
      payoffProgress: linkedGoal ? goalPercent(linkedGoal) : undefined,
      linkedGoalId: linkedGoal?.id
    }
  ];
}

function liabilityToLiabilityItem(liability: Liability): LiabilityItem {
  return {
    id: `liability-${liability.id}`,
    source: "liability",
    sourceId: liability.id,
    name: liability.name,
    kind:
      liability.type === "mortgage"
        ? "mortgage"
        : liability.type === "installment"
          ? "installment"
          : liability.type === "loan"
            ? "loan"
            : liability.type === "credit"
              ? "credit"
              : "debt",
    amount: Math.abs(liability.currentBalance),
    linkedGoalId: liability.linkedGoalId
  };
}

function buildGoalRelationship(goal: Goal, accountIds: Set<string>): GoalRelationship {
  const linkedAccountExists = Boolean(goal.linkedAccountId && accountIds.has(goal.linkedAccountId));
  const isAssetGoal =
    goal.type === "savings" ||
    goal.type === "emergency_fund" ||
    goal.type === "investment" ||
    goal.type === "house_purchase" ||
    goal.type === "retirement" ||
    goal.type === "education" ||
    goal.type === "vehicle";
  const isDebtGoal = goal.type === "debt_payoff";
  const contributesToAssets = false;
  const contributesToLiabilityReduction = isDebtGoal && linkedAccountExists;

  return {
    goalId: goal.id,
    role: goal.type === "investment" ? "growth_projection" : isAssetGoal ? "asset_accumulation" : isDebtGoal ? "liability_reduction" : "planning_only",
    contributesToAssets,
    contributesToLiabilityReduction,
    linkedAccountId: goal.linkedAccountId,
    assetAmount: 0,
    liabilityAmount: 0,
    projectedAnnualReturn: goal.type === "investment" ? Math.max(goal.expectedAnnualReturn ?? 0, 0) : 0
  };
}

function goalPercent(goal: Goal) {
  return goal.targetAmount > 0 ? Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100) : 0;
}

function sumAmounts(items: Array<{ amount: number }>) {
  return items.reduce((total, item) => total + item.amount, 0);
}

function calculateDebtRatio(totalLiabilities: number, totalAssets: number) {
  if (totalLiabilities <= 0) return 0;
  if (totalAssets <= 0) return 100;
  return Math.round((totalLiabilities / totalAssets) * 100);
}
