export type SyncStatus = "local" | "pending" | "synced" | "conflict";
export type SpendingBehavior = "fixed" | "variable" | "planned" | "impulse" | "mandatory";
export type SpendingFrequency = "routine" | "non_routine";

export type EntityMeta = {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  syncStatus: SyncStatus;
  remoteId?: string;
  version: number;
};

export type PlanningProfile = {
  currentAge: number;
  maritalStatus: "single" | "married" | "divorced" | "widowed";
  dependentsCount: number;
  retirementTargetAge: number;
  riskProfile: "conservative" | "moderate" | "aggressive";
};

export type PlanningGoalType = "house_purchase" | "retirement" | "education" | "vehicle" | "custom_future";

export type Account = EntityMeta & {
  name: string;
  accountType: "asset" | "liability";
  type: "cash" | "bank" | "ewallet" | "credit" | "savings" | "investment" | "loan" | "mortgage" | "installment" | "other";
  currency: "IDR";
  openingBalance: number;
  currentBalance: number;
  color: string;
  icon: string;
  isArchived: boolean;
};

export type Category = EntityMeta & {
  name: string;
  normalizedName?: string;
  kind: "income" | "expense" | "transfer";
  defaultBehavior?: SpendingBehavior;
  budgetGroup?: "daily" | "commitment" | "sinking_fund" | "flexible" | "giving" | "work";
  color: string;
  icon: string;
  sortOrder: number;
  isSystem: boolean;
  isArchived: boolean;
};

export type Subcategory = EntityMeta & {
  categoryId: string;
  name: string;
  normalizedName?: string;
  defaultBehavior?: SpendingBehavior;
  color?: string;
  icon?: string;
  sortOrder: number;
  isSystem: boolean;
  isArchived: boolean;
};

export type Transaction = EntityMeta & {
  type: "income" | "expense" | "transfer";
  accountId: string;
  transferAccountId?: string;
  goalId?: string;
  categoryId: string;
  subcategoryId?: string;
  amount: number;
  currency: "IDR";
  date: string;
  merchant?: string;
  note?: string;
  tags: string[];
  behavior?: SpendingBehavior;
  frequency?: SpendingFrequency;
  source: "manual" | "import" | "recurring" | "adjustment";
  importBatchId?: string;
};

export type Budget = EntityMeta & {
  name: string;
  period: string;
  categoryId: string;
  subcategoryId?: string;
  limitAmount: number;
  spentAmountSnapshot?: number;
  rolloverEnabled: boolean;
  rolloverAmount: number;
  alertThresholds: number[];
};

export type Goal = EntityMeta & {
  name: string;
  type:
    | "savings"
    | "debt_payoff"
    | "emergency_fund"
    | "investment"
    | "custom"
    | "house_purchase"
    | "retirement"
    | "education"
    | "vehicle"
    | "custom_future";
  planningGoalType?: PlanningGoalType;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  linkedAccountId?: string;
  linkedAccountIds?: string[];
  linkedAssetIds?: string[];
  linkedLiabilityIds?: string[];
  contributesToAssets?: boolean;
  monthlyContribution?: number;
  expectedAnnualReturn?: number;
  status: "active" | "paused" | "completed" | "archived";
};

export type Asset = EntityMeta & {
  name: string;
  type: "cash" | "bank" | "ewallet" | "savings" | "investment" | "property" | "vehicle" | "business" | "collectible" | "other";
  category?: "home" | "land" | "vehicle" | "gold" | "electronics" | "business" | "collectible" | "investment_property" | "stock" | "mutual_fund" | "crypto" | "deposit" | "other";
  currentValue: number;
  estimatedValue?: number;
  appreciationRate?: number;
  notes?: string;
  currency: "IDR";
  linkedAccountId?: string;
  linkedGoalId?: string;
  liquidity: "liquid" | "semi_liquid" | "illiquid";
  includeInNetWorth: boolean;
  isArchived: boolean;
};

export type Liability = EntityMeta & {
  name: string;
  type: "credit" | "loan" | "mortgage" | "installment" | "tax" | "other";
  currentBalance: number;
  currency: "IDR";
  linkedAccountId?: string;
  linkedGoalId?: string;
  interestRate?: number;
  minimumPayment?: number;
  includeInNetWorth: boolean;
  isArchived: boolean;
};

export type RecurringRule = EntityMeta & {
  name: string;
  sourceTransactionId?: string;
  transactionTemplate: Omit<Transaction, keyof EntityMeta | "date" | "source">;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  nextRunAt: string;
  lastRunAt?: string;
  status: "active" | "paused" | "ended";
};

export type Insight = EntityMeta & {
  period: string;
  ruleId: string;
  title: string;
  body: string;
  severity: "info" | "positive" | "warning" | "critical";
  evidence: Array<{ label: string; value: number | string; unit?: "IDR" | "percent" | "count" | "date" }>;
  action?: { label: string; route: string; params?: Record<string, string> };
  status: "new" | "seen" | "dismissed" | "pinned";
};

export type ImportBatch = EntityMeta & {
  fileName: string;
  rowCount: number;
  mappedColumns: Record<string, string>;
  status: "draft" | "imported" | "failed" | "reverted";
  summary: Record<string, number | string>;
};

export type AppSetting = {
  key: string;
  value: unknown;
  updatedAt: string;
};
