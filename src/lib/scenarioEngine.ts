import type { Goal, PlanningProfile } from "../db/schema";
import { emergencyFundGuideline } from "./emergencyFund";
import type { FinancialModel } from "./financialModel";

export type ScenarioPriority = "stabilization" | "resilience" | "debt" | "goals" | "growth";

export type ScenarioResult = {
  id: string;
  title: string;
  priority: ScenarioPriority;
  summary: string;
  monthlyAction: number;
  projectedImpact: string;
  evidence: Array<{ label: string; value: number | string; unit?: "IDR" | "percent" | "count" }>;
};

export function buildScenarioEngine(input: {
  income: number;
  expense: number;
  monthlyBurnRate: number;
  financialModel: FinancialModel;
  goals: Goal[];
  planningProfile?: PlanningProfile;
}) {
  const scenarios: ScenarioResult[] = [];
  const monthlyCashflow = input.income - input.expense;
  const savingsRate = input.income > 0 ? Math.round((monthlyCashflow / input.income) * 100) : 0;
  const emergencyMonths = input.monthlyBurnRate > 0 ? Number((input.financialModel.liquidAssets / input.monthlyBurnRate).toFixed(1)) : 0;
  const activeGoals = input.goals.filter((goal) => !goal.deletedAt && goal.status === "active");
  const totalGoalGap = activeGoals.reduce((total, goal) => total + Math.max(goal.targetAmount - goal.currentAmount, 0), 0);
  const positiveCashflow = Math.max(monthlyCashflow, 0);
  const emergencyGuideline = emergencyFundGuideline(input.planningProfile);
  const foundationStressed = monthlyCashflow < 0 || emergencyMonths < 1 || input.financialModel.debtRatio >= 50;
  const foundationReady = monthlyCashflow > 0 && savingsRate >= 20 && emergencyMonths >= emergencyGuideline.minimumMonths && input.financialModel.debtRatio < 30;
  const smallDebtThreshold = Math.max(500000, monthlyCashflow * 0.05);
  const hasMeaningfulDebt = input.financialModel.totalLiabilities > smallDebtThreshold || input.financialModel.debtRatio >= 10;

  if (monthlyCashflow < 0) {
    const recoveryTarget = Math.abs(monthlyCashflow);
    scenarios.push({
      id: "cashflow-recovery",
      title: "Skenario pulihkan cashflow negatif",
      priority: "stabilization",
      summary: "Dalam urutan perencanaan keuangan, cashflow negatif perlu distabilkan sebelum mengejar goal agresif atau investasi baru. Fokusnya mencari kombinasi pengurangan biaya fleksibel dan penyesuaian komitmen yang paling realistis.",
      monthlyAction: recoveryTarget,
      projectedImpact: `Butuh ruang sekitar ${formatScenarioCurrency(recoveryTarget)} per bulan agar cashflow kembali minimal impas.`,
      evidence: [
        { label: "Cashflow sekarang", value: monthlyCashflow, unit: "IDR" },
        { label: "Ruang pemulihan", value: recoveryTarget, unit: "IDR" },
        { label: "Savings rate", value: savingsRate, unit: "percent" }
      ]
    });
  }

  if (input.expense > 0) {
    const reduction = Math.round(input.expense * 0.05);
    const newCashflow = monthlyCashflow + reduction;
    scenarios.push({
      id: "reduce-expense-5",
      title: "Skenario hemat 5% pengeluaran",
      priority: monthlyCashflow < 0 ? "stabilization" : foundationReady ? "growth" : "resilience",
      summary: monthlyCashflow < 0
        ? "Ini skenario stabilisasi paling ringan: bukan memangkas semua hal, tetapi memilih satu-dua kategori fleksibel agar cashflow kembali punya ruang napas."
        : foundationReady
          ? "Ini bukan prioritas tinggi pada kondisi cashflow yang sudah longgar. Gunakan hanya sebagai optimasi ringan bila ada pos fleksibel yang memang terasa boros, bukan target penghematan wajib."
        : "Ini skenario optimasi kebiasaan: surplus yang sudah ada diperbesar sedikit agar bisa dialihkan ke dana darurat, debt payoff, atau goal prioritas.",
      monthlyAction: reduction,
      projectedImpact: `Cashflow bulanan berpotensi menjadi ${formatScenarioCurrency(newCashflow)}.`,
      evidence: [
        { label: "Pengurangan bulanan", value: reduction, unit: "IDR" },
        { label: "Cashflow baru", value: newCashflow, unit: "IDR" },
        { label: "Savings rate baru", value: input.income > 0 ? Math.round((newCashflow / input.income) * 100) : 0, unit: "percent" }
      ]
    });
  }

  if (emergencyMonths < emergencyGuideline.idealMonths && input.monthlyBurnRate > 0) {
    const targetMonths = emergencyMonths < emergencyGuideline.minimumMonths ? emergencyGuideline.minimumMonths : emergencyGuideline.idealMonths;
    const targetAmount = Math.round(input.monthlyBurnRate * targetMonths);
    const gap = Math.max(targetAmount - input.financialModel.liquidAssets, 0);
    const monthlyAction = Math.ceil(gap / (targetMonths === emergencyGuideline.minimumMonths ? 12 : 18));
    scenarios.push({
      id: `emergency-${targetMonths}-months`,
      title: `Skenario dana darurat ${targetMonths} bulan`,
      priority: "resilience",
      summary: emergencyMonths < 1
        ? "Dana darurat awal berfungsi sebagai rem darurat agar kejadian kecil tidak langsung berubah menjadi utang baru."
        : "Dana darurat yang jelas membuat keputusan debt, investasi, dan goal lebih tenang karena kebutuhan mendadak tidak seluruhnya menekan cashflow.",
      monthlyAction,
      projectedImpact: `Butuh sekitar ${formatScenarioCurrency(gap)} untuk mencapai ${targetMonths} bulan pengeluaran sesuai guardrail ${emergencyGuideline.label}.`,
      evidence: [
        { label: "Coverage sekarang", value: emergencyMonths, unit: "count" },
        { label: "Target coverage", value: targetMonths, unit: "count" },
        { label: "Kebutuhan tambahan", value: gap, unit: "IDR" },
        { label: "Estimasi kontribusi", value: monthlyAction, unit: "IDR" }
      ]
    });
  }

  if (hasMeaningfulDebt && monthlyCashflow >= 0) {
    const rawExtraPayment = Math.max(Math.round(Math.max(positiveCashflow, input.income * 0.03, 250000) * (foundationStressed ? 0.2 : 0.35)), 100000);
    const extraPayment = Math.min(rawExtraPayment, input.financialModel.totalLiabilities);
    const monthsSavedProxy = Math.max(1, Math.round(input.financialModel.totalLiabilities / extraPayment));
    scenarios.push({
      id: "debt-extra-payment",
      title: "Skenario percepat pelunasan debt",
      priority: "debt",
      summary: input.financialModel.debtRatio >= 30
        ? "Debt ratio berada di zona pantau, jadi pembayaran tambahan membantu memperbaiki neraca sekaligus mengurangi risiko cashflow jangka menengah."
        : "Debt masih terlihat terkendali, tetapi pembayaran tambahan kecil bisa mempercepat kebebasan cashflow tanpa mengorbankan semua surplus.",
      monthlyAction: extraPayment,
      projectedImpact: `Tambahan ${formatScenarioCurrency(extraPayment)} per bulan memberi jalur pelunasan kasar sekitar ${monthsSavedProxy} bulan sebelum bunga.`,
      evidence: [
        { label: "Total debt", value: input.financialModel.totalLiabilities, unit: "IDR" },
        { label: "Tambahan bayar", value: extraPayment, unit: "IDR" },
        { label: "Debt ratio", value: input.financialModel.debtRatio, unit: "percent" }
      ]
    });
  }

  if (activeGoals.length > 0 && totalGoalGap > 0 && monthlyCashflow > 0 && emergencyMonths >= 1) {
    const allocationShare = emergencyMonths < emergencyGuideline.minimumMonths || input.financialModel.debtRatio >= 30 ? 0.18 : 0.3;
    const monthlyContribution = Math.max(Math.round(Math.max(positiveCashflow, input.income * 0.05, 300000) * allocationShare), 100000);
    scenarios.push({
      id: "goal-top-up",
      title: "Skenario tambah kontribusi goals",
      priority: "goals",
      summary:
        emergencyMonths < emergencyGuideline.minimumMonths || input.financialModel.debtRatio >= 30
          ? "Goal tetap bisa berjalan, tetapi porsinya dibuat ringan dulu karena dana darurat atau debt masih perlu ruang. Ini menjaga target tetap hidup tanpa mendahului fondasi."
          : "Surplus kecil yang diberi nama tujuan biasanya lebih bertahan dibanding surplus yang dibiarkan mengambang. Skenario ini cocok bila fondasi sudah cukup aman dan goal punya deadline jelas.",
      monthlyAction: monthlyContribution,
      projectedImpact: `Dalam 12 bulan, kontribusi ini menambah sekitar ${formatScenarioCurrency(monthlyContribution * 12)} ke goals prioritas.`,
      evidence: [
        { label: "Jumlah goal aktif", value: activeGoals.length, unit: "count" },
        { label: "Total funding gap", value: totalGoalGap, unit: "IDR" },
        { label: "Top up bulanan", value: monthlyContribution, unit: "IDR" }
      ]
    });
  }

  if (foundationReady) {
    const investable = Math.max(Math.round(monthlyCashflow * 0.4), 0);
    scenarios.push({
      id: "growth-allocation",
      title: "Skenario alokasi surplus untuk growth",
      priority: "growth",
      summary: "Fondasi yang cukup sehat membuka ruang untuk membagi surplus ke investasi dan tujuan jangka panjang secara bertahap.",
      monthlyAction: investable,
      projectedImpact: `Alokasi growth 40% dari surplus setara ${formatScenarioCurrency(investable)} per bulan.`,
      evidence: [
        { label: "Savings rate", value: savingsRate, unit: "percent" },
        { label: "Dana darurat", value: emergencyMonths, unit: "count" },
        { label: "Debt ratio", value: input.financialModel.debtRatio, unit: "percent" }
      ]
    });
  }

  const hasDependents = (input.planningProfile?.dependentsCount ?? 0) > 0 || input.planningProfile?.maritalStatus === "married";
  if (hasDependents || hasMeaningfulDebt) {
    const protectionBudget = Math.max(Math.round(Math.max(input.income, 0) * 0.03), 100000);
    scenarios.push({
      id: "protection-review",
      title: "Skenario review proteksi",
      priority: hasDependents ? "resilience" : "debt",
      summary: "Proteksi tidak selalu berarti menambah produk baru. Intinya adalah memetakan risiko: kesehatan, kehilangan pendapatan, kewajiban debt, dan kebutuhan keluarga jika cashflow utama terganggu.",
      monthlyAction: protectionBudget,
      projectedImpact: `Gunakan batas simulasi ${formatScenarioCurrency(protectionBudget)} per bulan sebagai ruang review affordability, bukan angka wajib.`,
      evidence: [
        { label: "Tanggungan", value: input.planningProfile?.dependentsCount ?? 0, unit: "count" },
        { label: "Total debt", value: input.financialModel.totalLiabilities, unit: "IDR" },
        { label: "Batas simulasi", value: protectionBudget, unit: "IDR" }
      ]
    });
  }

  if (monthlyCashflow > 0) {
    const emergencyPart = Math.round(monthlyCashflow * (emergencyMonths < emergencyGuideline.minimumMonths ? 0.5 : 0.25));
    const debtPart = input.financialModel.debtRatio >= 30 ? Math.round(monthlyCashflow * 0.25) : 0;
    const goalPart = Math.round(monthlyCashflow * (emergencyMonths < emergencyGuideline.minimumMonths ? 0.25 : 0.35));
    const growthPart = Math.max(monthlyCashflow - emergencyPart - debtPart - goalPart, 0);
    scenarios.push({
      id: "surplus-split",
      title: "Skenario pembagian surplus",
      priority: emergencyMonths < emergencyGuideline.minimumMonths ? "resilience" : "growth",
      summary: "Ketika cashflow positif, keputusan terpenting adalah memberi tugas pada surplus sebelum uangnya terserap belanja spontan.",
      monthlyAction: monthlyCashflow,
      projectedImpact:
        debtPart > 0
          ? `Contoh pembagian: ${formatScenarioCurrency(emergencyPart)} untuk ketahanan, ${formatScenarioCurrency(debtPart)} untuk debt, ${formatScenarioCurrency(goalPart)} untuk goals, dan sisanya untuk growth.`
          : `Contoh pembagian: ${formatScenarioCurrency(emergencyPart)} untuk ketahanan, ${formatScenarioCurrency(goalPart)} untuk goals, dan ${formatScenarioCurrency(growthPart)} untuk growth atau investasi.`,
      evidence: [
        { label: "Surplus bulanan", value: monthlyCashflow, unit: "IDR" },
        { label: "Ketahanan", value: emergencyPart, unit: "IDR" },
        { label: "Debt", value: debtPart, unit: "IDR" },
        { label: "Goals", value: goalPart, unit: "IDR" },
        { label: "Growth", value: growthPart, unit: "IDR" }
      ]
    });
  }

  return scenarios.sort((left, right) => scenarioWeight(right.priority) - scenarioWeight(left.priority));
}

function scenarioWeight(priority: ScenarioPriority) {
  return { stabilization: 5, resilience: 4, debt: 3, goals: 2, growth: 1 }[priority];
}

function formatScenarioCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}
