import type { Goal, PlanningProfile } from "../db/schema";
import type { DashboardAnalytics } from "./dashboardAnalytics";
import { emergencyFundGuideline } from "./emergencyFund";
import { buildFinancialModel } from "./financialModel";
import { projectGoal } from "./planningEngine";

export type FinancialRecommendation = {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  category: "cashflow" | "debt" | "emergency" | "goals" | "investment" | "stability";
  explanation: string;
  formula: string;
  interpretation: string;
  recommendation: string;
};

export function generateFinancialRecommendations(input: {
  analytics: DashboardAnalytics;
  goals: Goal[];
  accounts: Parameters<typeof buildFinancialModel>[0]["accounts"];
  assets?: Parameters<typeof buildFinancialModel>[0]["assets"];
  liabilities?: Parameters<typeof buildFinancialModel>[0]["liabilities"];
  planningProfile?: PlanningProfile;
}): FinancialRecommendation[] {
  const recommendations: FinancialRecommendation[] = [];
  const model = buildFinancialModel({ accounts: input.accounts, assets: input.assets, liabilities: input.liabilities, goals: input.goals });
  const savingsRate = input.analytics.savingsRate;
  const emergencyMonths =
    input.analytics.totalExpense > 0 ? Number((Math.max(input.analytics.liquidAssets, input.analytics.emergencyDesignatedAssets) / input.analytics.totalExpense).toFixed(1)) : 0;
  const emergencyGuideline = emergencyFundGuideline(input.planningProfile);
  const investmentAssets = model.assets.filter((asset) => asset.kind === "investment").reduce((total, asset) => total + asset.amount, 0);
  const investmentAllocation = input.analytics.totalAssets > 0 ? Math.round((investmentAssets / input.analytics.totalAssets) * 100) : 0;
  const unstableCashflow = input.analytics.previousMonthIncome > 0 && Math.abs(input.analytics.incomeChangePercent) >= 30;

  if (input.analytics.debtRatio >= 50) {
    recommendations.push({
      id: "debt-pressure-high",
      title: "Prioritaskan penurunan tekanan utang",
      priority: "high",
      category: "debt",
      explanation: "Rasio utang sudah mengambil porsi besar dari aset yang tercatat.",
      formula: "total liabilities / total assets x 100",
      interpretation: `Rasio utang saat ini ${input.analytics.debtRatio}%. Di atas 50% berarti ruang manuver keuangan lebih sempit.`,
      recommendation: "Fokuskan surplus pada utang berbunga tinggi dan hindari menambah cicilan baru sampai rasio turun."
    });
  } else if (input.analytics.debtRatio >= 30) {
    recommendations.push({
      id: "debt-pressure-watch",
      title: "Pantau rasio utang sebelum ekspansi target",
      priority: "medium",
      category: "debt",
      explanation: "Utang masih wajar tetapi cukup besar untuk dipantau sebelum mengambil target besar baru.",
      formula: "total liabilities / total assets x 100",
      interpretation: `Rasio utang ${input.analytics.debtRatio}% berada di zona pantau.`,
      recommendation: "Jaga pembayaran minimum lancar dan arahkan sebagian cashflow ke pelunasan tambahan."
    });
  }

  if (emergencyMonths < emergencyGuideline.minimumMonths) {
    recommendations.push({
      id: "emergency-fund-gap",
      title: "Bangun dana darurat minimum",
      priority: "high",
      category: "emergency",
      explanation: "Aset likuid belum cukup menutup minimum dana darurat sesuai status keluarga.",
      formula: "max(liquid assets, emergency fund) / monthly expense",
      interpretation: `Coverage dana darurat sekitar ${emergencyMonths} bulan. Guardrail ${emergencyGuideline.label}: ${emergencyGuideline.minimumMonths}-${emergencyGuideline.idealMonths} bulan pengeluaran.`,
      recommendation: `Buat target dana darurat minimum ${emergencyGuideline.minimumMonths} bulan dulu, lalu naikkan ke ${emergencyGuideline.idealMonths} bulan setelah cashflow stabil.`
    });
  }

  if (savingsRate < 10) {
    recommendations.push({
      id: "savings-rate-low",
      title: "Beri ruang menabung yang lebih konsisten",
      priority: savingsRate < 0 ? "high" : "medium",
      category: "cashflow",
      explanation: "Rasio menabung rendah membuat tujuan masa depan sulit dikejar.",
      formula: "(income - expense) / income x 100",
      interpretation: `Rasio menabung periode ini ${savingsRate}%. Patokan sehat awal adalah 10-20%.`,
      recommendation: "Cari satu kategori fleksibel untuk dikurangi dan jadwalkan kontribusi otomatis ke tujuan utama."
    });
  }

  const weakGoals = input.goals
    .filter((goal) => !goal.deletedAt && goal.status === "active")
    .map((goal) => ({ goal, projection: projectGoal(goal, input.planningProfile) }))
    .filter(({ projection }) => projection.feasibilityStatus === "behind" || projection.feasibilityStatus === "unfunded");

  if (weakGoals.length > 0) {
    recommendations.push({
      id: "goal-feasibility-gap",
      title: "Sesuaikan tujuan yang belum realistis",
      priority: "medium",
      category: "goals",
      explanation: "Beberapa goal belum punya kontribusi cukup terhadap target dan tenggatnya.",
      formula: "projected future value compared with target amount",
      interpretation: `${weakGoals.length} tujuan membutuhkan kontribusi tambahan atau revisi target.`,
      recommendation: "Naikkan kontribusi untuk target prioritas, geser target date, atau pecah tujuan besar menjadi tahap yang lebih kecil."
    });
  }

  if (investmentAllocation > 70) {
    recommendations.push({
      id: "investment-concentration-high",
      title: "Kurangi konsentrasi investasi",
      priority: "medium",
      category: "investment",
      explanation: "Porsi investasi terlalu dominan terhadap total aset yang tercatat.",
      formula: "investment assets / total assets x 100",
      interpretation: `Alokasi investasi sekitar ${investmentAllocation}% dari aset.`,
      recommendation: "Pastikan dana darurat dan kebutuhan 12 bulan ke depan tetap berada di instrumen likuid."
    });
  }

  if (unstableCashflow) {
    recommendations.push({
      id: "cashflow-stability",
      title: "Gunakan asumsi pemasukan konservatif",
      priority: "medium",
      category: "stability",
      explanation: "Pemasukan berubah cukup besar dari bulan sebelumnya.",
      formula: "(income this month - income last month) / income last month x 100",
      interpretation: `Perubahan pemasukan ${input.analytics.incomeChangePercent}%.`,
      recommendation: "Gunakan rata-rata pemasukan konservatif untuk budget dan jadwal kontribusi bulan depan."
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "foundation-stable",
      title: "Fondasi keuangan terlihat stabil",
      priority: "low",
      category: "stability",
      explanation: "Tidak ada tekanan besar dari rasio utang, dana darurat, savings rate, atau cashflow.",
      formula: "local rule checks across debt, cashflow, emergency fund, goals, and allocation",
      interpretation: "Sinyal utama berada dalam zona aman awal.",
      recommendation: "Pertahankan ritme dan evaluasi tujuan jangka panjang setiap bulan."
    });
  }

  return recommendations.slice(0, 8);
}
