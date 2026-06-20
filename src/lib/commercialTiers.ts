export type CommercialTier = "inactive" | "basic" | "pro" | "elite";

export type FeatureKey =
  | "transaction_tracker"
  | "basic_dashboard"
  | "monthly_budgeting"
  | "simple_analytics"
  | "advanced_analytics"
  | "savings_goals"
  | "debt_tracker"
  | "recurring_transactions"
  | "export_features"
  | "advanced_charts"
  | "net_worth_tracking"
  | "multi_account"
  | "smart_insights"
  | "advanced_forecasting"
  | "financial_planning"
  | "investment_tracker"
  | "retirement_simulation"
  | "advanced_insight_engine"
  | "premium_reports"
  | "advanced_financial_scoring"
  | "advanced_projections";

export type LimitKey = "account_count";

export type TierDefinition = {
  id: CommercialTier;
  name: string;
  tagline: string;
  features: FeatureKey[];
  limits: Record<LimitKey, number>;
};

const basicFeatures: FeatureKey[] = ["transaction_tracker", "basic_dashboard", "simple_analytics"];

const proFeatures: FeatureKey[] = [
  ...basicFeatures,
  "monthly_budgeting",
  "advanced_analytics",
  "savings_goals",
  "debt_tracker",
  "recurring_transactions",
  "export_features",
  "advanced_charts",
  "net_worth_tracking"
];

const eliteFeatures: FeatureKey[] = [
  ...proFeatures,
  "smart_insights",
  "advanced_forecasting",
  "financial_planning",
  "investment_tracker",
  "retirement_simulation",
  "advanced_insight_engine",
  "premium_reports",
  "advanced_financial_scoring",
  "advanced_projections"
];

export const tierDefinitions: Record<CommercialTier, TierDefinition> = {
  inactive: {
    id: "inactive",
    name: "BELUM AKTIF",
    tagline: "Aktivasi lisensi BASIC gratis untuk mulai memakai data finansial real.",
    features: ["basic_dashboard", "simple_analytics"],
    limits: { account_count: 0 }
  },
  basic: {
    id: "basic",
    name: "BASIC",
    tagline: "Gratis untuk pencatatan transaksi, dashboard dasar, dan 1 akun aktif.",
    features: basicFeatures,
    limits: { account_count: 1 }
  },
  pro: {
    id: "pro",
    name: "PRO",
    tagline: "Akun tanpa batas, budget, goals, ekspor data, dan net worth.",
    features: proFeatures,
    limits: { account_count: Number.POSITIVE_INFINITY }
  },
  elite: {
    id: "elite",
    name: "ELITE",
    tagline: "Semua fitur Pro ditambah insight lanjutan, proyeksi, dan laporan Financial Planner.",
    features: eliteFeatures,
    limits: { account_count: Number.POSITIVE_INFINITY }
  }
};

export const featureLabels: Record<FeatureKey, string> = {
  transaction_tracker: "Pencatat transaksi",
  basic_dashboard: "Dashboard dasar",
  monthly_budgeting: "Budget bulanan",
  simple_analytics: "Analitik sederhana",
  advanced_analytics: "Analitik lanjutan",
  savings_goals: "Tujuan tabungan",
  debt_tracker: "Pelacak utang",
  recurring_transactions: "Transaksi rutin",
  export_features: "Ekspor data",
  advanced_charts: "Chart lanjutan",
  net_worth_tracking: "Pelacak kekayaan bersih",
  multi_account: "Multi-akun",
  smart_insights: "Insight pintar",
  advanced_forecasting: "Forecasting lanjutan",
  financial_planning: "Perencanaan keuangan",
  investment_tracker: "Pelacak investasi",
  retirement_simulation: "Simulasi pensiun",
  advanced_insight_engine: "Mesin insight lanjutan",
  premium_reports: "Laporan premium",
  advanced_financial_scoring: "Skor keuangan lanjutan",
  advanced_projections: "Proyeksi lanjutan"
};

export function canUseFeature(tier: CommercialTier, feature: FeatureKey) {
  return tierDefinitions[tier].features.includes(feature);
}

export function getTierLimit(tier: CommercialTier, limit: LimitKey) {
  return tierDefinitions[tier].limits[limit];
}

export function requiredTierFor(feature: FeatureKey): CommercialTier {
  if (tierDefinitions.basic.features.includes(feature)) return "basic";
  if (tierDefinitions.pro.features.includes(feature)) return "pro";
  return "elite";
}

export function getLockedFeatureCopy(feature: FeatureKey) {
  const tier = requiredTierFor(feature);
  return `${featureLabels[feature]} tersedia di ${tierDefinitions[tier].name}.`;
}

export function normalizeTier(value: unknown): CommercialTier {
  if (value === "demo" || value === "free") return "inactive";
  return value === "inactive" || value === "basic" || value === "pro" || value === "elite" ? value : "inactive";
}
