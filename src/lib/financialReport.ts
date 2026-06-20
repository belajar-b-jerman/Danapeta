import type { AppSetting, Goal, PlanningProfile } from "../db/schema";
import { tierDefinitions, type CommercialTier } from "./commercialTiers";
import { buildDashboardAnalytics, toPeriodKey } from "./dashboardAnalytics";
import type { PlannerBackup } from "./dataPortability";
import { emergencyFundGuideline } from "./emergencyFund";
import { buildFinancialModel, calculateEmergencyRunwayMonths, estimateMonthlyBurnRate } from "./financialModel";
import { generateInsights } from "./insightEngine";
import { formatCurrency } from "./money";
import { projectGoal, type GoalProjection } from "./planningEngine";
import { generateFinancialRecommendations } from "./recommendationEngine";
import { buildScenarioEngine } from "./scenarioEngine";

export function buildProfessionalReportHtml(backup: PlannerBackup, tier: CommercialTier) {
  const { tables } = backup;
  const referenceDate = new Date(backup.exportedAt);
  const period = toPeriodKey(referenceDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" }), referenceDate);
  const planningProfile = readSetting<PlanningProfile>(tables.appSettings, "planningProfile");
  const analytics = buildDashboardAnalytics({
    period,
    accounts: tables.accounts,
    assets: tables.assets,
    liabilities: tables.liabilities,
    categories: tables.categories,
    transactions: tables.transactions,
    budgets: tables.budgets,
    goals: tables.goals,
    recurringRules: tables.recurringRules,
    referenceDate
  });
  const financialModel = buildFinancialModel({ accounts: tables.accounts, assets: tables.assets, liabilities: tables.liabilities, goals: tables.goals });
  const activeTransactions = tables.transactions.filter((transaction) => !transaction.deletedAt);
  const burnRate = estimateMonthlyBurnRate(activeTransactions, analytics.totalExpense);
  const runwayMonths = calculateEmergencyRunwayMonths(financialModel, burnRate);
  const insights = generateInsights({
    period,
    accounts: tables.accounts,
    assets: tables.assets,
    liabilities: tables.liabilities,
    categories: tables.categories,
    transactions: tables.transactions,
    budgets: tables.budgets,
    goals: tables.goals,
    recurringRules: tables.recurringRules,
    planningProfile,
    referenceDate
  });
  const healthInsight = insights.find((insight) => insight.ruleId === "financial-health-score");
  const healthScore = Number(healthInsight?.evidence.find((item) => item.label === "Health score")?.value ?? 0);
  const recommendations = generateFinancialRecommendations({
    analytics,
    goals: tables.goals,
    accounts: tables.accounts,
    assets: tables.assets,
    liabilities: tables.liabilities,
    planningProfile
  });
  const goalRows = tables.goals
    .filter((goal) => !goal.deletedAt && goal.status !== "archived")
    .map((goal) => ({ goal, projection: projectGoal(goal, planningProfile, referenceDate) }));
  const assetAllocation = allocationRows(financialModel.assets.map((asset) => ({ label: asset.kind, value: asset.amount })));
  const liabilityRows = financialModel.liabilities.map((liability) => ({
    name: liability.name,
    type: liability.kind,
    amount: liability.amount,
    progress: liability.payoffProgress ?? 0
  }));
  const risks = insights.filter((insight) => insight.severity === "warning" || insight.severity === "critical").slice(0, 6);
  const projectionSummary = goalRows.reduce(
    (summary, row) => {
      summary.target += row.goal.targetAmount;
      summary.futureValue += row.projection.estimatedFutureValue;
      summary.gap += row.projection.fundingGap;
      return summary;
    },
    { target: 0, futureValue: 0, gap: 0 }
  );

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>Laporan Keuangan DANAPETA</title>
    <style>
      :root { color: #25313F; background: #F8F5EF; font-family: Inter, Arial, sans-serif; }
      body { margin: 0; color: #25313F; background: #F8F5EF; }
      main { max-width: 1080px; margin: 0 auto; padding: 40px; }
      section { break-inside: avoid; margin-top: 28px; }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 34px; line-height: 1.1; }
      h2 { font-size: 18px; margin-bottom: 12px; }
      h3 { font-size: 14px; margin-bottom: 6px; }
      p, li, td, th { font-size: 12px; line-height: 1.55; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border-bottom: 1px solid #DDE5DF; padding: 9px 8px; text-align: left; vertical-align: top; }
      th { color: #66756D; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
      .hero { background: #FFFFFF; border: 1px solid #E2E8E3; border-radius: 8px; padding: 26px; }
      .muted { color: #66756D; }
      .eyebrow { color: #5A9A78; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
      .card { background: #FFFFFF; border: 1px solid #E2E8E3; border-radius: 8px; padding: 15px; }
      .value { font-size: 23px; font-weight: 800; margin-top: 6px; }
      .pill { display: inline-block; border-radius: 999px; background: #E8F1EA; padding: 4px 8px; font-size: 11px; font-weight: 700; }
      .note { background: #EEF5F0; border-radius: 8px; padding: 12px; }
      .print-actions { display: flex; justify-content: flex-end; margin-bottom: 16px; }
      button { border: 0; border-radius: 8px; background: #7FAE93; color: white; font-weight: 800; padding: 10px 14px; }
      @media print {
        body { background: white; }
        main { padding: 0; max-width: none; }
        .print-actions { display: none; }
        .card, .hero { border-color: #DDE5DF; }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="print-actions"><button onclick="window.print()">Simpan sebagai PDF</button></div>
      <header class="hero">
        <p class="eyebrow">Laporan finansial lokal dan privat</p>
        <h1>Laporan Perencanaan Keuangan DANAPETA</h1>
        <p class="muted">Dibuat ${escapeHtml(new Date(backup.exportedAt).toLocaleString("id-ID"))} - Tier ${escapeHtml(tierDefinitions[tier].name)} - Semua kalkulasi berjalan lokal dari penyimpanan browser.</p>
      </header>

      ${section("Executive Summary", `
        <div class="grid">
          ${metricCard("Financial health score", `${healthScore}/100`, "Composite score from cashflow, savings, budget discipline, debt, emergency fund, and stability.")}
          ${metricCard("Net worth", formatCurrency(analytics.netWorth), "Assets minus liabilities from real accounts and manual asset/liability records.")}
          ${metricCard("Monthly cashflow", formatCurrency(analytics.monthlyCashflow), "Income minus expenses in the selected reporting period.")}
        </div>
        <p class="note">Interpretation: ${escapeHtml(executiveInterpretation(healthScore, analytics.savingsRate, analytics.debtRatio, runwayMonths))}</p>
      `)}

      ${section("Financial Health Score", `
        ${healthInsight ? healthBreakdownTable(healthInsight) : "<p>No score available yet.</p>"}
        ${explainBlock("Score logic", "Weighted local model: cashflow 25, savings 20, budget 15, debt 20, emergency 10, stability 10.", scoreInterpretation(healthScore), "Improve the lowest score component first because it has the fastest impact on the total score.")}
      `)}

      ${section("Cashflow Analysis", `
        <div class="grid">
          ${metricCard("Income", formatCurrency(analytics.totalIncome), "All income transactions in the report period.")}
          ${metricCard("Expense", formatCurrency(analytics.totalExpense), "All expense transactions in the report period.")}
          ${metricCard("Savings rate", `${analytics.savingsRate}%`, "(Income - expense) / income x 100.")}
        </div>
        ${explainBlock("Interpretation", "Monthly cashflow = income - expense.", `Cashflow is ${formatCurrency(analytics.monthlyCashflow)} with savings rate ${analytics.savingsRate}%.`, analytics.savingsRate >= 20 ? "Protect this surplus by assigning it to goals." : "Review flexible spending and recurring commitments before adding new goals.")}
      `)}

      ${section("Budget Analysis", `
        ${table(["Budget", "Limit", "Spent", "Used", "Remaining"], analytics.budgetProgress.slice(0, 8).map((budget) => [budget.name, formatCurrency(budget.limit), formatCurrency(budget.spent), `${budget.percent}%`, formatCurrency(budget.remaining)]))}
        ${explainBlock("Budget logic", "Budget used = category spending / budget limit x 100.", `${analytics.budgetSummary.exceededCount} budget(s) are over limit.`, "Treat overspent categories as review prompts, not failure labels.")}
      `)}

      ${section("Goal Progress", `
        ${table(["Goal", "Target", "Current", "Future value", "Funding gap", "Status"], goalRows.map(({ goal, projection }) => [goal.name, formatCurrency(goal.targetAmount), formatCurrency(goal.currentAmount), formatCurrency(projection.estimatedFutureValue), formatCurrency(projection.fundingGap), projection.feasibilityLabel]))}
        ${explainBlock("Projection logic", "FV = current x (1+r)^n + monthly contribution x annuity growth factor.", `Projected future value across goals is ${formatCurrency(projectionSummary.futureValue)} against ${formatCurrency(projectionSummary.target)} target.`, "Prioritize goals with deadlines and large funding gaps.")}
      `)}

      ${section("Net Worth Analysis", `
        <div class="grid">
          ${metricCard("Total assets", formatCurrency(analytics.totalAssets), "Real account balances plus manual assets included in net worth.")}
          ${metricCard("Total liabilities", formatCurrency(analytics.totalLiabilities), "Liability accounts plus manual liabilities included in net worth.")}
          ${metricCard("Debt ratio", `${analytics.debtRatio}%`, "Total liabilities / total assets x 100.")}
        </div>
        ${explainBlock("Net worth rule", "Net worth = accounts/assets - liabilities. Goals are planning objects and are not double-counted as assets.", `Current net worth is ${formatCurrency(analytics.netWorth)}.`, "Keep goals linked for planning context, but reconcile real balances through accounts.")}
      `)}

      ${section("Asset Allocation", `
        ${table(["Asset class", "Amount", "Share"], assetAllocation.map((row) => [row.label, formatCurrency(row.value), `${row.percent}%`]))}
        ${explainBlock("Allocation logic", "Asset class amount / total assets x 100.", "Allocation highlights concentration risk and liquidity quality.", "Keep emergency money liquid before increasing volatile allocations.")}
      `)}

      ${section("Liability Analysis", `
        ${table(["Liability", "Type", "Balance", "Payoff progress"], liabilityRows.map((row) => [row.name, row.type, formatCurrency(row.amount), `${row.progress}%`]))}
        ${explainBlock("Debt logic", "Debt pressure = total liabilities / total assets x 100.", `Debt ratio is ${analytics.debtRatio}%.`, analytics.debtRatio > 30 ? "Prioritize high-interest debt and avoid new fixed commitments." : "Maintain current repayment rhythm.")}
      `)}

      ${section("Financial Risks", `
        ${risks.length > 0 ? risks.map((risk) => `<div class="card"><h3>${escapeHtml(risk.title)}</h3><p>${escapeHtml(risk.body)}</p><p class="muted">Logic: ${escapeHtml(String(risk.evidence.find((item) => item.label === "Formula")?.value ?? "local rule"))}</p></div>`).join("") : "<p>No major warnings generated from current local rules.</p>"}
      `)}

      ${section("Key Recommendations", recommendations.map((item) => `
        <div class="card">
          <span class="pill">${escapeHtml(item.priority)} · ${escapeHtml(item.category)}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.explanation)}</p>
          <p class="muted">Formula: ${escapeHtml(item.formula)}</p>
          <p>Interpretation: ${escapeHtml(item.interpretation)}</p>
          <p><strong>Recommendation:</strong> ${escapeHtml(item.recommendation)}</p>
        </div>
      `).join(""))}

      ${section("Future Projections", `
        <div class="grid">
          ${metricCard("Projected goal value", formatCurrency(projectionSummary.futureValue), "Future value from current progress, monthly contribution, timeline, and expected return.")}
          ${metricCard("Funding gap", formatCurrency(projectionSummary.gap), "Remaining gap after projected future value.")}
          ${metricCard("Emergency runway", `${runwayMonths} months`, "max(liquid assets, emergency fund) / monthly burn rate.")}
        </div>
      `)}

      ${section("Planning Summary", `
        <div class="grid-2">
          ${metricCard("Profile", planningProfile ? `${planningProfile.currentAge} yrs · ${planningProfile.riskProfile}` : "Not set", "Planning profile drives risk-aware defaults.")}
          ${metricCard("Retirement target", planningProfile ? `${planningProfile.retirementTargetAge} yrs` : "Not set", "Used by retirement readiness rules.")}
        </div>
        <p class="note">Privacy note: this PDF is generated in the browser from local IndexedDB data. No account, transaction, or planning data is uploaded.</p>
      `)}
    </main>
  </body>
</html>`;
}

export function buildProfessionalReportPdfBlob(backup: PlannerBackup, tier: CommercialTier) {
  return new Blob([buildEditorialReportPdf(backup, tier)], { type: "application/pdf" });
}

function buildReportText(backup: PlannerBackup, tier: CommercialTier) {
  const { tables } = backup;
  const referenceDate = new Date(backup.exportedAt);
  const period = toPeriodKey(referenceDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" }), referenceDate);
  const planningProfile = readSetting<PlanningProfile>(tables.appSettings, "planningProfile");
  const analytics = buildDashboardAnalytics({
    period,
    accounts: tables.accounts,
    assets: tables.assets,
    liabilities: tables.liabilities,
    categories: tables.categories,
    transactions: tables.transactions,
    budgets: tables.budgets,
    goals: tables.goals,
    recurringRules: tables.recurringRules,
    referenceDate
  });
  const financialModel = buildFinancialModel({ accounts: tables.accounts, assets: tables.assets, liabilities: tables.liabilities, goals: tables.goals });
  const activeTransactions = tables.transactions.filter((transaction) => !transaction.deletedAt);
  const burnRate = estimateMonthlyBurnRate(activeTransactions, analytics.totalExpense);
  const emergencySource = resolveReportEmergencySource(tables.goals, financialModel.liquidAssets, burnRate);
  const insights = generateInsights({
    period,
    accounts: tables.accounts,
    assets: tables.assets,
    liabilities: tables.liabilities,
    categories: tables.categories,
    transactions: tables.transactions,
    budgets: tables.budgets,
    goals: tables.goals,
    recurringRules: tables.recurringRules,
    planningProfile,
    referenceDate
  });
  const healthInsight = insights.find((insight) => insight.ruleId === "financial-health-score");
  const healthScore = Number(healthInsight?.evidence.find((item) => item.label === "Health score")?.value ?? 0);
  const recommendations = generateFinancialRecommendations({
    analytics,
    goals: tables.goals,
    accounts: tables.accounts,
    assets: tables.assets,
    liabilities: tables.liabilities,
    planningProfile
  });
  const goalRows = tables.goals
    .filter((goal) => !goal.deletedAt && goal.status !== "archived")
    .map((goal) => ({ goal, projection: projectGoal(goal, planningProfile, referenceDate) }));
  const assetAllocation = allocationRows(financialModel.assets.map((asset) => ({ label: asset.kind, value: asset.amount })));
  const liabilityRows = financialModel.liabilities.map((liability) => `${liability.name}: ${formatCurrency(liability.amount)} (${liability.kind})`);
  const warningRows = insights.filter((insight) => insight.severity === "warning" || insight.severity === "critical").slice(0, 6);
  const prioritizedInsights = insights
    .filter((insight) => insight.ruleId !== "financial-health-score")
    .slice(0, 8)
    .map((insight) => `${severityRank(insight.severity)} - ${insight.title}. ${insight.body}`);
  const strongestFactor = healthInsight ? evidenceText(healthInsight, "Faktor terbesar") : "-";
  const weakestFactor = healthInsight ? evidenceText(healthInsight, "Faktor terlemah") : "-";
  const totalGoalTarget = goalRows.reduce((total, row) => total + row.goal.targetAmount, 0);
  const totalGoalProgress = goalRows.reduce((total, row) => total + row.goal.currentAmount, 0);
  const goalProgressPercent = totalGoalTarget > 0 ? Math.round((totalGoalProgress / totalGoalTarget) * 100) : 0;
  const fixedCommitmentRatio = analytics.totalIncome > 0 ? Math.round((analytics.totalExpense / analytics.totalIncome) * 100) : 0;
  const advisoryTone = reportTone(healthScore);
  const dynamicRecommendations = buildDynamicPriorityRecommendations({
    cashflow: analytics.monthlyCashflow,
    debtRatio: analytics.debtRatio,
    emergencyMonths: emergencySource.monthsCoverage,
    savingsRate: analytics.savingsRate,
    netWorth: analytics.netWorth,
    age: planningProfile?.currentAge,
    riskProfile: planningProfile?.riskProfile,
    goalCount: goalRows.length,
    goalProgressPercent,
    insights: prioritizedInsights,
    generatedRecommendations: recommendations.map((item) => `${item.priority.toUpperCase()} - ${item.title}: ${item.recommendation}`)
  });
  const emergencyGuideline = emergencyFundGuideline(planningProfile);

  const lines = [
    "DANAPETA",
    "Laporan Perencanaan Keuangan Pribadi",
    `Tanggal dibuat: ${new Date(backup.exportedAt).toLocaleString("id-ID")}`,
    `Tier: ${tierDefinitions[tier].name}`,
    "Disiapkan oleh: mesin perencanaan lokal berbasis aturan DANAPETA",
    "",
    "Disclaimer Penting",
    "Bantuan edukasi perencanaan keuangan, bukan nasihat keuangan berlisensi.",
    "Laporan ini dibuat dari data lokal yang tersimpan di perangkat ini. Analisis mengikuti prinsip",
    "perencanaan keuangan: cashflow lebih dulu, dana darurat memadai, beban utang terkendali,",
    "pendanaan tujuan realistis, dan asumsi yang transparan. Gunakan bersama penilaian pribadi Anda.",
    "",
    "Executive Summary",
    advisoryTone,
    `Faktor perencanaan terkuat saat ini adalah ${strongestFactor}. Area yang paling perlu diperhatikan`,
    `adalah ${weakestFactor}. Dalam perencanaan keuangan, tujuan pertama bukan mengejar return tertinggi,`,
    "tetapi membangun ketahanan finansial: cashflow positif, likuiditas, kontrol utang,",
    "dan tujuan yang bisa didanai tanpa melemahkan kebutuhan harian.",
    `Health score: ${healthScore}/100 - ${scoreInterpretation(healthScore)}`,
    `Net worth: ${formatCurrency(analytics.netWorth)}`,
    `Assets: ${formatCurrency(analytics.totalAssets)} | Liabilities: ${formatCurrency(analytics.totalLiabilities)} | Debt ratio: ${analytics.debtRatio}%`,
    `Monthly income: ${formatCurrency(analytics.totalIncome)} | Expense: ${formatCurrency(analytics.totalExpense)} | Cashflow: ${formatCurrency(analytics.monthlyCashflow)}`,
    `Savings rate: ${analytics.savingsRate}% | Emergency coverage: ${emergencySource.monthsCoverage} months`,
    "",
    "Visual Planning Dashboard",
    barLine("Health score", healthScore, 100),
    barLine("Savings rate", Math.max(0, Math.min(analytics.savingsRate, 100)), 100),
    barLine("Goal progress", goalProgressPercent, 100),
    barLine("Debt ratio", Math.max(0, Math.min(analytics.debtRatio, 100)), 100),
    barLine("Emergency months", Math.min(Math.round((emergencySource.monthsCoverage / 6) * 100), 100), 100),
    "",
    "Financial Goals",
    "Review tujuan melihat urgensi, funding gap, horizon waktu, dan apakah tujuan bisa didanai",
    "tanpa melemahkan dana darurat atau menciptakan cashflow negatif.",
    `Total active goal progress: ${formatCurrency(totalGoalProgress)} / ${formatCurrency(totalGoalTarget)} (${goalProgressPercent}%).`,
    ...goalRows.map(({ goal, projection }) => `${goal.name}: ${formatCurrency(goal.currentAmount)} / ${formatCurrency(goal.targetAmount)}. Status: ${projection.feasibilityLabel}. Funding gap: ${formatCurrency(projection.fundingGap)}. Expected return: ${formatPercent(projection.annualReturn)} per year.`),
    goalRows.length === 0 ? "No active goals yet. A practical first goal is a one-month emergency reserve." : "",
    goalFundingNarrative(goalRows.length, goalProgressPercent, analytics.monthlyCashflow, emergencySource.monthsCoverage),
    "",
    "Cashflow Analysis",
    "Dasar perencanaan: cashflow adalah fondasi rencana keuangan. Rencana baru berkelanjutan",
    "jika biaya rutin, cicilan, kebutuhan proteksi, dan kontribusi tujuan masih muat",
    "di dalam pemasukan realistis. Rumus: pemasukan - pengeluaran = cashflow bulanan.",
    `This period shows cashflow of ${formatCurrency(analytics.monthlyCashflow)} and a savings rate of ${analytics.savingsRate}%.`,
    cashflowGuidance(analytics.savingsRate, analytics.monthlyCashflow),
    `Expense-to-income ratio: ${fixedCommitmentRatio}%. A lower ratio creates more room for emergency`,
    "funding and long-term goals.",
    "",
    "Net Worth Analysis",
    "Dasar perencanaan: net worth dihitung dari akun, aset, dan liabilitas nyata.",
    "Goals adalah target perencanaan dan tidak dihitung sebagai aset kecuali dananya benar-benar ada",
    "di akun atau catatan aset manual. Rumus: aset - liabilitas.",
    `Current net worth is ${formatCurrency(analytics.netWorth)}.`,
    `Debt ratio is ${analytics.debtRatio}%.`,
    debtGuidance(analytics.debtRatio),
    ...(liabilityRows.length ? liabilityRows : ["No liabilities recorded. Keep this section updated if you add loans or credit balances."]),
    "",
    "Financial Ratios",
    `Savings ratio: ${analytics.savingsRate}%`,
    `Expense-to-income ratio: ${fixedCommitmentRatio}%`,
    `Debt ratio: ${analytics.debtRatio}%`,
    `Emergency fund coverage: ${emergencySource.monthsCoverage} months`,
    `Goal funding progress: ${goalProgressPercent}%`,
    ratioNarrative(analytics.savingsRate, fixedCommitmentRatio, analytics.debtRatio, emergencySource.monthsCoverage),
    "",
    "Risk Profile",
    riskProfileNarrative(planningProfile, analytics.monthlyCashflow, emergencySource.monthsCoverage, analytics.debtRatio),
    "",
    "Insurance & Protection",
    protectionNarrative(planningProfile, analytics.monthlyCashflow, emergencySource.monthsCoverage, analytics.debtRatio),
    "",
    "Investment Allocation",
    "Dasar perencanaan: alokasi investasi mengikuti kapasitas risiko, horizon waktu, kebutuhan",
    "likuiditas, dan prioritas tujuan. Laporan ini tidak merekomendasikan produk tertentu;",
    "laporan hanya membaca konsentrasi dan likuiditas dari data aset lokal.",
    ...(assetAllocation.length ? assetAllocation.map((row) => `${row.label}: ${formatCurrency(row.value)} (${row.percent}%).`) : ["No investment or manual asset allocation recorded yet."]),
    investmentNarrative(assetAllocation, planningProfile?.riskProfile, emergencySource.monthsCoverage, analytics.debtRatio),
    "",
    "Action Plan",
    ...buildActionPlan({
      cashflow: analytics.monthlyCashflow,
      savingsRate: analytics.savingsRate,
      emergencyMonths: emergencySource.monthsCoverage,
      debtRatio: analytics.debtRatio,
      goalProgressPercent
    }),
    "",
    "Financial Health Score",
    "Weights: cashflow 25, savings 20, budget 15, debt 20, emergency fund 10, stability 10.",
    `Strongest factor: ${strongestFactor}`,
    `Weakest factor: ${weakestFactor}`,
    "The score is not a moral judgment. It is a prioritization tool. A lower component points to the",
    "next area where small changes may improve the whole plan.",
    "",
    "Priority Recommendations",
    "The following priorities combine cashflow, debt ratio, emergency coverage, savings ratio, net",
    "worth, age, risk profile, and goal data. They are educational planning prompts, not absolute advice.",
    ...dynamicRecommendations,
    "",
    "Rule-Based Insight Signals",
    ...(warningRows.length ? warningRows.map((insight) => `${severityRank(insight.severity)} - ${insight.title}. ${insight.body}`) : ["No major warning generated by current local rules."]),
    "",
    "Education Notes",
    "A healthy personal finance plan usually moves in sequence: stabilize cashflow, build emergency",
    "liquidity, manage debt, protect essential risks, then fund goals and investments. When cashflow",
    "is tight, reduce decision fatigue by choosing one lever: lower a flexible category, reschedule a",
    "goal, or redirect surplus to the weakest planning component.",
    "For goal planning, use conservative assumptions. A goal that requires an unrealistic monthly",
    "contribution should be adjusted by changing the deadline, target amount, or contribution rhythm.",
    "",
    "Planning Profile and Assumptions",
    planningProfile
      ? `Age ${planningProfile.currentAge}, retirement target ${planningProfile.retirementTargetAge}, ${planningProfile.maritalStatus}, dependents ${planningProfile.dependentsCount}, risk ${planningProfile.riskProfile}.`
      : "Planning profile is not set.",
    "This profile is used for planning assumptions and financial recommendations.",
    "",
    "Next Review Checklist",
    "1. Reconcile account balances so net worth remains the source of truth.",
    "2. Review budget categories that exceed 80% usage before the month ends.",
    "3. Confirm emergency fund progress and keep it liquid.",
    "4. Update goal deadlines or contributions when life assumptions change.",
    "5. Regenerate this report after material changes in income, debt, or goals."
  ].filter((line) => line !== "");

  return { lines };
}

type PlannerDiagnosis = {
  phase: string;
  opening: string;
  phaseBody: string;
  mainRisk: string;
  mainPriority: string;
  thirtyDayFocus: string;
};

function plannerDiagnosis(model: ReturnType<typeof buildReportModel>): PlannerDiagnosis {
  const cashflow = model.analytics.monthlyCashflow;
  const emergencyMonths = model.emergencySource.monthsCoverage;
  const debtRatio = model.analytics.debtRatio;
  const savingsRate = model.analytics.savingsRate;
  const foundationStressed = cashflow < 0 || emergencyMonths < 1 || debtRatio >= 50;
  const foundationBuilding = !foundationStressed && (savingsRate < 10 || emergencyMonths < 3 || debtRatio >= 30);
  const growthReady = cashflow > 0 && savingsRate >= 20 && emergencyMonths >= 3 && debtRatio < 30;

  if (foundationStressed) {
    return {
      phase: "Stabilisasi",
      opening: "Berdasarkan data yang tercatat, kondisi keuangan saat ini berada di fase stabilisasi. Fokus utama fase ini adalah menjaga kebutuhan wajib, mengurangi tekanan cashflow, dan menghindari keputusan besar yang menambah kewajiban tetap.",
      phaseBody: "Fase stabilisasi biasanya terjadi ketika cashflow negatif, dana darurat sangat tipis, atau debt ratio terlalu tinggi. Tujuan utamanya bukan terlihat agresif, tetapi membuat rencana kembali punya ruang napas.",
      mainRisk: "Risiko utama adalah keputusan jangka panjang dipaksakan sebelum fondasi bulanan cukup stabil. Bila ini terjadi, tujuan baik seperti investasi, rumah, atau pendidikan bisa ikut menekan cashflow.",
      mainPriority: "Prioritas planner adalah memilih satu kebocoran terbesar, menahan komitmen opsional, lalu membangun bantalan kas awal sebelum memperbesar target lain.",
      thirtyDayFocus: "Selama 30 hari, fokus pada satu hal yang paling bisa dikendalikan: kurangi satu kategori fleksibel, pastikan cicilan minimum aman, dan sisihkan dana darurat awal walau nominalnya kecil."
    };
  }

  if (foundationBuilding) {
    return {
      phase: "Pembangunan Fondasi",
      opening: "Kondisi keuangan sudah memiliki beberapa sinyal positif, tetapi fondasinya masih perlu diperkuat. Ini fase yang cocok untuk menata prioritas, bukan menambah terlalu banyak tujuan baru.",
      phaseBody: "Fase pembangunan fondasi berarti cashflow mulai terbaca, tetapi dana darurat, debt ratio, atau savings rate masih membutuhkan margin lebih besar. Keputusan terbaik biasanya sederhana dan konsisten.",
      mainRisk: "Risiko utama adalah surplus kecil terserap belanja spontan atau tujuan yang terlalu banyak. Jika prioritas tidak dibatasi, progress terasa ramai tetapi tidak cukup dalam.",
      mainPriority: "Prioritas planner adalah memperbesar bantalan, mengunci kontribusi otomatis, dan membuat urutan goal yang jelas agar surplus punya arah.",
      thirtyDayFocus: "Selama 30 hari, arahkan surplus ke dana darurat atau debt payoff terlebih dahulu. Setelah itu baru naikkan kontribusi goal yang deadline-nya paling dekat."
    };
  }

  if (growthReady) {
    return {
      phase: "Optimasi dan Growth",
      opening: "Kondisi keuangan terlihat cukup sehat untuk masuk ke fase optimasi. Fokusnya bukan lagi hanya menghemat, tetapi memastikan surplus bekerja sesuai tujuan jangka panjang.",
      phaseBody: "Fase growth muncul ketika cashflow positif, dana darurat sudah terbaca, dan tekanan debt relatif terkendali. Pada fase ini, perencanaan bisa bergerak ke investasi bertahap, pensiun, pendidikan, atau tujuan besar lain.",
      mainRisk: "Risiko utama adalah merasa terlalu aman lalu membiarkan surplus tidak punya tugas. Wealth building membutuhkan alokasi yang disiplin, bukan hanya saldo akhir bulan yang terlihat positif.",
      mainPriority: "Prioritas planner adalah membagi surplus ke tiga jalur: proteksi, goal jangka menengah, dan growth jangka panjang sesuai risk capacity.",
      thirtyDayFocus: "Selama 30 hari, tetapkan persentase surplus untuk growth dan goal prioritas. Review apakah alokasi aset masih seimbang dengan dana darurat dan horizon tujuan."
    };
  }

  return {
    phase: "Pemeliharaan Terarah",
    opening: "Kondisi keuangan berada di area menengah: tidak terlihat sangat tertekan, tetapi masih ada komponen yang perlu diarahkan lebih jelas.",
    phaseBody: "Fase ini cocok untuk memperbaiki satu rasio terlemah tanpa merombak seluruh kebiasaan. Perubahan kecil tetapi konsisten biasanya lebih efektif dibanding banyak target sekaligus.",
    mainRisk: "Risiko utama adalah rencana berjalan tanpa prioritas. Ketika semua tujuan terasa penting, kontribusi sering tersebar tipis dan sulit menghasilkan perubahan nyata.",
    mainPriority: "Prioritas planner adalah memilih satu rasio utama untuk diperbaiki selama 30-90 hari, lalu mengukur ulang sebelum menambah komitmen baru.",
    thirtyDayFocus: "Selama 30 hari, pilih satu fokus: naikkan savings rate, tambah dana darurat, turunkan debt ratio, atau rapikan goal yang paling dekat deadline-nya."
  };
}

function buildEditorialReportPdf(backup: PlannerBackup, tier: CommercialTier) {
  const model = buildReportModel(backup, tier);
  const diagnosis = plannerDiagnosis(model);
  const pdf = new ModernPdf();

  pdf.cover(model);

  pdf.chapter("RINGKASAN", "Ringkasan Planner", "Memo singkat tentang kondisi, risiko utama, dan prioritas tindakan.");
  pdf.plannerMemo(model, diagnosis);
  pdf.disclaimer();

  pdf.chapter("SNAPSHOT", "Angka Utama", "Metrik inti sebagai bukti pendukung, bukan pengganti interpretasi.");
  pdf.proseSection(
    "Cara membaca halaman ini",
    "Angka di bawah memberi gambaran cepat tentang posisi keuangan saat laporan dibuat. Net Worth menunjukkan posisi neraca, Cashflow menunjukkan ruang napas bulanan, Dana darurat menunjukkan ketahanan, dan Debt ratio menunjukkan tekanan kewajiban."
  );
  pdf.summaryCards([
    ["Health Score", `${model.healthScore}/100`, model.healthStatus],
    ["Net Worth", money(model.analytics.netWorth), model.analytics.netWorth < 0 ? "critical" : "healthy"],
    ["Cashflow", money(model.analytics.monthlyCashflow), model.analytics.monthlyCashflow < 0 ? "critical" : "healthy"],
    ["Dana darurat", `${model.emergencySource.monthsCoverage} bulan`, model.emergencySource.monthsCoverage < model.emergencyGuideline.minimumMonths ? "warning" : "healthy"]
  ]);
  pdf.summaryCards([
    ["Savings rate", `${model.analytics.savingsRate}%`, ratioStatus(model.analytics.savingsRate, 20, 10, false)],
    ["Debt ratio", `${model.analytics.debtRatio}%`, ratioStatus(model.analytics.debtRatio, 30, 50, true)],
    ["Expense-to-income", `${model.expenseIncomeRatio}%`, ratioStatus(model.expenseIncomeRatio, 70, 85, true)]
  ]);

  pdf.chapter("BAB 1", "Diagnosis Keuangan", "Fase finansial, rasio utama, dan area yang paling perlu diprioritaskan.");
  pdf.proseSection("Fase saat ini", diagnosis.phaseBody);
  pdf.proseSection("Makna skor", `Financial Health Score berada di ${model.healthScore}/100. Faktor terkuat: ${model.strongestFactor}. Faktor yang paling perlu dibenahi: ${model.weakestFactor}. ${scoreInterpretation(model.healthScore)}`);
  pdf.ratioComparisonTable([
    ["Rasio menabung", `${model.analytics.savingsRate}%`, ">= 20%", ratioStatus(model.analytics.savingsRate, 20, 10, false), "Kemampuan membentuk surplus"],
    ["Expense-to-income", `${model.expenseIncomeRatio}%`, "<= 70%", ratioStatus(model.expenseIncomeRatio, 70, 85, true), "Tekanan biaya hidup"],
    ["Debt ratio", `${model.analytics.debtRatio}%`, "<= 30%", ratioStatus(model.analytics.debtRatio, 30, 50, true), "Beban neraca dan solvabilitas"],
    ["Dana darurat", `${model.emergencySource.monthsCoverage} bulan`, `${model.emergencyGuideline.minimumMonths}-${model.emergencyGuideline.idealMonths} bulan`, ratioStatus(model.emergencySource.monthsCoverage, model.emergencyGuideline.idealMonths, model.emergencyGuideline.minimumMonths, false), "Ketahanan likuiditas"],
    ["Progress tujuan", `${model.goalProgressPercent}%`, ">= 70%", ratioStatus(model.goalProgressPercent, 70, 30, false), "Kesiapan pendanaan tujuan"]
  ]);
  pdf.miniBars([
    ["Rasio menabung", Math.max(0, Math.min(model.analytics.savingsRate, 40)), 40, colors.success],
    ["Tekanan expense", Math.max(0, Math.min(model.expenseIncomeRatio, 100)), 100, model.expenseIncomeRatio > 85 ? colors.danger : colors.warning],
    ["Tekanan debt", Math.max(0, Math.min(model.analytics.debtRatio, 100)), 100, model.analytics.debtRatio > 50 ? colors.danger : colors.sage],
    ["Dana darurat", Math.max(0, Math.min(model.emergencySource.monthsCoverage, model.emergencyGuideline.idealMonths)), model.emergencyGuideline.idealMonths, colors.sky]
  ]);

  pdf.chapter("BAB 2", "Cashflow & Budget", "Apakah kehidupan bulanan masih memberi ruang napas untuk tujuan.");
  pdf.proseSection(
    "Apa yang terlihat",
    `Cashflow bulanan saat ini ${money(model.analytics.monthlyCashflow)} dengan savings rate ${model.analytics.savingsRate}% dan expense-to-income ${model.expenseIncomeRatio}%. ${cashflowGuidance(model.analytics.savingsRate, model.analytics.monthlyCashflow)} Tren belanja ${model.spendingTrendLabel} dibanding bulan sebelumnya.`
  );
  pdf.proseSection(
    "Yang perlu dijaga",
    model.analytics.monthlyCashflow < 0
      ? "Prioritas utama bukan mencari return investasi, tetapi menutup kebocoran cashflow dan memastikan kebutuhan wajib tetap aman. Setelah cashflow kembali positif, tujuan dan investasi baru lebih masuk akal untuk dipercepat."
      : "Cashflow positif adalah ruang gerak. Agar tidak habis tanpa arah, surplus sebaiknya langsung diberi tugas: dana darurat, debt payoff, goal prioritas, atau investasi bertahap."
  );
  pdf.trendBars("Tren Cashflow 6 Bulan", model.analytics.monthlyTrend);
  pdf.donutLegendChart("Konsentrasi Pengeluaran", "Top kategori belanja pada periode laporan.", model.analytics.topCategories.slice(0, 5).map((row) => ({ label: row.name, value: row.value, percent: row.percent })));

  pdf.chapter("BAB 3", "Net Worth & Liquidity", "Kekayaan bersih, aset likuid, dan risiko konsentrasi aset.");
  pdf.proseSection(
    "Bukan cuma besar, tapi bisa dipakai",
    `Net Worth saat ini ${money(model.analytics.netWorth)}. Bagian yang perlu diperhatikan adalah kualitas likuiditas: dana darurat setara ${model.emergencySource.monthsCoverage} bulan dan total aset tercatat ${money(model.analytics.totalAssets)}. Aset seperti properti dan kendaraan penting untuk kekayaan bersih, tetapi tidak bisa disamakan dengan kas saat kondisi mendesak.`
  );
  pdf.proseSection("Konsentrasi aset", investmentNarrative(model.assetAllocation, model.planningProfile?.riskProfile, model.emergencySource.monthsCoverage, model.analytics.debtRatio));
  pdf.summaryCards([
    ["Total aset", money(model.analytics.totalAssets), "healthy"],
    ["Liabilitas", money(model.analytics.totalLiabilities), model.analytics.totalLiabilities > 0 ? "warning" : "healthy"],
    ["Aset likuid", money(model.analytics.liquidAssets), model.emergencySource.monthsCoverage < model.emergencyGuideline.minimumMonths ? "warning" : "healthy"]
  ]);
  pdf.assetAllocationChart(model.assetAllocation);
  pdf.donutLegendChart("Alokasi Aset", "Komposisi aset tercatat dan potensi konsentrasi.", model.assetAllocation);

  pdf.chapter("BAB 4", "Debt & Protection", "Kemampuan bayar, tanggungan, dan kebutuhan proteksi dasar.");
  pdf.proseSection("Mengapa debt dan proteksi dibaca bersama", protectionNarrative(model.planningProfile, model.analytics.monthlyCashflow, model.emergencySource.monthsCoverage, model.analytics.debtRatio));
  pdf.proseSection("Panduan debt", debtGuidance(model.analytics.debtRatio));
  pdf.summaryCards([
    ["Dana darurat", `${model.emergencySource.monthsCoverage} bulan`, model.emergencySource.monthsCoverage < 1 ? "critical" : model.emergencySource.monthsCoverage < model.emergencyGuideline.minimumMonths ? "warning" : "healthy"],
    ["Tanggungan", model.dependencyLabel, model.dependencyStatus],
    ["Debt ratio", `${model.analytics.debtRatio}%`, model.analytics.debtRatio > 50 ? "critical" : model.analytics.debtRatio > 30 ? "warning" : "healthy"]
  ]);
  pdf.insightBoxes(model);

  pdf.chapter("BAB 5", "Goals & Future Planning", "Kelayakan tujuan, funding gap, dan urutan prioritas kontribusi.");
  pdf.proseSection("Arah tujuan", `${goalFundingNarrative(model.goalRows.length, model.goalProgressPercent, model.analytics.monthlyCashflow, model.emergencySource.monthsCoverage)} Progress agregat tujuan tercatat ${model.goalProgressPercent}% dengan ${model.goalRows.length} tujuan aktif. Proyeksi memakai expected return efektif yang sama dengan halaman Goals dan Insight.`);
  pdf.proseSection("Urutan prioritas", "Secara praktis, tujuan sebaiknya diurutkan dari yang menjaga ketahanan keuangan lebih dulu: dana darurat, kewajiban keluarga, pendidikan atau rumah bila sudah dekat, pensiun, lalu tujuan gaya hidup atau aspiratif. Khusus pensiun, target nominal sebaiknya divalidasi dari biaya hidup bulanan saat pensiun, inflasi, lama masa pensiun, dan asumsi return investasi.");
  pdf.goalProgressChart(model);
  pdf.table(
    ["Tujuan", "Progress", "Target", "Status", "Penjelasan"],
    model.goalRows.slice(0, 8).map(({ goal, projection }) => [
      goal.name,
      `${goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0}%`,
      money(goal.targetAmount),
      projection.feasibilityLabel,
      goalProjectionExplanation(goal, projection)
    ]),
    "Belum ada tujuan aktif. Mulai dari dana darurat satu bulan pengeluaran."
  );

  pdf.chapter("BAB 6", "Scenario Engine", "Simulasi lokal untuk melihat dampak keputusan kecil terhadap rencana.");
  pdf.proseSection("Cara memakai skenario", "Skenario di bawah bukan prediksi pasti, tetapi alat bantu untuk membandingkan keputusan. Pilih satu skenario yang paling realistis untuk 30 hari ke depan, jalankan, lalu ukur ulang dampaknya.");
  if (model.scenarios.length > 0) {
    model.scenarios.slice(0, 4).forEach((scenario, index) => {
      pdf.priorityCard(index + 1, `${scenarioPriorityLabel(scenario.priority)} - ${scenario.title}. ${scenario.summary} ${scenario.projectedImpact}`);
    });
  } else {
    pdf.card("Scenario belum tersedia", "Tambahkan transaksi, goals, aset, atau debt agar simulasi lokal bisa memberi opsi tindakan yang lebih presisi.", "warning");
  }

  pdf.chapter("BAB 7", "Action Plan 30/90 Hari", "Langkah praktis yang bisa ditinjau ulang secara berkala.");
  pdf.proseSection("Prioritas utama", model.dynamicRecommendations[0] ?? "Belum ada prioritas kritis dari rule engine pada data saat ini. Pertahankan ritme dan lakukan review berkala.");
  pdf.proseSection("Prinsip eksekusi", "Action plan disusun dengan urutan stabilisasi, proteksi, optimasi, lalu akselerasi tujuan. Urutan ini membantu agar keputusan investasi atau tujuan besar tidak mendahului fondasi cashflow.");
  model.dynamicRecommendations.slice(0, 6).forEach((item, index) => pdf.priorityCard(index + 1, item));
  pdf.ensure(160);
  pdf.y += 10;
  pdf.sectionTitle("Checklist Implementasi", "Langkah praktis untuk review berikutnya.");
  model.actionPlan.forEach((action, index) => pdf.checklist(index + 1, action));
  pdf.appendix(model);

  return pdf.output();
}

function buildModernReportPdf(backup: PlannerBackup, tier: CommercialTier) {
  const model = buildReportModel(backup, tier);
  const pdf = new ModernPdf();

  pdf.cover(model);
  pdf.executiveSummary(model);
  pdf.chapter("BAB 1", "Pendahuluan & Ruang Lingkup", "Dasar penyusunan, cakupan data, dan batasan interpretasi perencanaan.");
  pdf.reportSection({
    title: "Ringkasan",
    summary: "Laporan ini disusun sebagai ringkasan perencanaan keuangan komprehensif berbasis data lokal DANAPETA. Cakupan analisis meliputi cashflow, utang, likuiditas, alokasi aset, kesiapan tujuan, profil risiko, kebutuhan proteksi, dan rencana tindakan.",
    interpretation: "Data yang digunakan berasal dari transaksi, akun, aset, liabilitas, budget, goals, recurring rules, serta profil perencanaan yang tersedia saat laporan dibuat.",
    risk: "Kualitas rekomendasi bergantung pada kelengkapan data. Jika akun, utang, atau tanggungan belum dicatat, beberapa risiko dapat terlihat lebih rendah dari kondisi sebenarnya.",
    recommendation: "Lengkapi profil keluarga, target pensiun, aset, liabilitas, dan tujuan prioritas sebelum menjadikan laporan ini sebagai bahan diskusi finansial lanjutan."
  });
  pdf.summaryCards([
    ["Periode", new Date(model.exportedAt).toLocaleDateString("id-ID", { month: "long", year: "numeric" }), "healthy"],
    ["Tier laporan", tierDefinitions[model.tier].name, "healthy"],
    ["Sumber data", "Lokal saja", "healthy"]
  ]);
  pdf.insightBox("Ruang lingkup laporan", "Struktur laporan mengikuti alur perencanaan keuangan: memahami kondisi awal, menetapkan tujuan, membaca rasio utama, menilai risiko, lalu menyusun action plan prioritas.", "healthy");
  pdf.disclaimer();

  pdf.chapter("BAB 2", "Tujuan Keuangan", "Evaluasi tujuan, progress pendanaan, funding gap, dan prioritas kontribusi.");
  pdf.reportSection({
    title: "Ringkasan tujuan",
    summary: goalFundingNarrative(model.goalRows.length, model.goalProgressPercent, model.analytics.monthlyCashflow, model.emergencySource.monthsCoverage),
    interpretation: `Progress agregat tujuan tercatat ${model.goalProgressPercent}% dengan ${model.goalRows.length} tujuan aktif. Kelayakan tujuan dibaca dari progress, deadline, kontribusi bulanan, dan expected return efektif.`,
    risk: model.goalProgressPercent < 30 ? "Progress tujuan masih rendah sehingga target dengan deadline dekat berpotensi membutuhkan kontribusi lebih besar atau timeline yang diperpanjang." : "Progress tujuan sudah terlihat, namun tetap perlu dipisahkan antara tujuan wajib dan aspiratif.",
    recommendation: "Urutkan tujuan berdasarkan urgensi: dana darurat, kewajiban keluarga, pendidikan, pensiun, lalu tujuan gaya hidup atau aspiratif. Untuk pensiun, gunakan target nominal saat ini sebagai tracking awal dan validasi ulang dari kebutuhan biaya hidup pensiun."
  });
  pdf.goalProgressChart(model);
  pdf.table(
    ["Tujuan", "Progress", "Target", "Status"],
    model.goalRows.slice(0, 8).map(({ goal, projection }) => [
      goal.name,
      `${goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0}%`,
      money(goal.targetAmount),
      projection.feasibilityLabel
    ]),
    "Belum ada tujuan aktif. Mulai dari dana darurat satu bulan pengeluaran."
  );

  pdf.chapter("BAB 3", "Kondisi Keuangan Aktual", "Cashflow, kekayaan bersih, tren belanja, utang, likuiditas, dan konsentrasi aset.");
  pdf.summaryCards([
    ["Pemasukan", money(model.analytics.totalIncome), "healthy"],
    ["Pengeluaran", money(model.analytics.totalExpense), model.expenseIncomeRatio > 85 ? "critical" : model.expenseIncomeRatio > 70 ? "warning" : "healthy"],
    ["Cashflow", money(model.analytics.monthlyCashflow), model.analytics.monthlyCashflow < 0 ? "critical" : "healthy"],
    ["Net worth", money(model.analytics.netWorth), model.analytics.netWorth < 0 ? "critical" : "healthy"]
  ]);
  pdf.trendBars("Tren Cashflow 6 Bulan", model.analytics.monthlyTrend);
  pdf.reportSection({
    title: "Interpretasi kondisi aktual",
    summary: `Cashflow bulanan saat ini ${money(model.analytics.monthlyCashflow)} dengan savings rate ${model.analytics.savingsRate}% dan expense-to-income ${model.expenseIncomeRatio}%.`,
    interpretation: `${cashflowGuidance(model.analytics.savingsRate, model.analytics.monthlyCashflow)} Tren belanja ${model.spendingTrendLabel} dibanding bulan sebelumnya.`,
    risk: model.analytics.monthlyCashflow < 0 ? "Cashflow negatif mengurangi kemampuan membangun dana darurat, membayar utang lebih cepat, dan mendanai tujuan jangka panjang." : "Cashflow positif memberi ruang alokasi, tetapi surplus perlu diarahkan agar tidak terserap belanja spontan.",
    recommendation: "Pisahkan surplus bulanan ke pos dana darurat, pembayaran utang, dan tujuan prioritas sejak awal bulan."
  });
  pdf.donutLegendChart("Konsentrasi Pengeluaran", "Top kategori belanja pada periode laporan.", model.analytics.topCategories.slice(0, 5).map((row) => ({ label: row.name, value: row.value, percent: row.percent })));
  pdf.assetAllocationChart(model.assetAllocation);

  pdf.chapter("BAB 4", "Analisis Rasio Keuangan", "Perbandingan rasio utama terhadap guardrail perencanaan pribadi.");
  pdf.ratioComparisonTable([
    ["Rasio menabung", `${model.analytics.savingsRate}%`, ">= 20%", ratioStatus(model.analytics.savingsRate, 20, 10, false), "Kemampuan membentuk surplus"],
    ["Expense-to-income", `${model.expenseIncomeRatio}%`, "<= 70%", ratioStatus(model.expenseIncomeRatio, 70, 85, true), "Tekanan biaya hidup"],
    ["Debt ratio", `${model.analytics.debtRatio}%`, "<= 30%", ratioStatus(model.analytics.debtRatio, 30, 50, true), "Beban neraca dan solvabilitas"],
    ["Dana darurat", `${model.emergencySource.monthsCoverage} bulan`, `${model.emergencyGuideline.minimumMonths}-${model.emergencyGuideline.idealMonths} bulan`, ratioStatus(model.emergencySource.monthsCoverage, model.emergencyGuideline.idealMonths, model.emergencyGuideline.minimumMonths, false), "Ketahanan likuiditas"],
    ["Progress tujuan", `${model.goalProgressPercent}%`, ">= 70%", ratioStatus(model.goalProgressPercent, 70, 30, false), "Kesiapan pendanaan tujuan"]
  ]);
  pdf.miniBars([
    ["Rasio menabung", Math.max(0, Math.min(model.analytics.savingsRate, 40)), 40, colors.success],
    ["Tekanan expense", Math.max(0, Math.min(model.expenseIncomeRatio, 100)), 100, model.expenseIncomeRatio > 85 ? colors.danger : colors.warning],
    ["Tekanan debt", Math.max(0, Math.min(model.analytics.debtRatio, 100)), 100, model.analytics.debtRatio > 50 ? colors.danger : colors.sage],
    ["Dana darurat", Math.max(0, Math.min(model.emergencySource.monthsCoverage, model.emergencyGuideline.idealMonths)), model.emergencyGuideline.idealMonths, colors.sky]
  ]);
  pdf.reportSection({
    title: "Interpretasi rasio",
    summary: ratioNarrative(model.analytics.savingsRate, model.expenseIncomeRatio, model.analytics.debtRatio, model.emergencySource.monthsCoverage),
    interpretation: `Financial Health Score berada di ${model.healthScore}/100. Faktor terkuat: ${model.strongestFactor}. Faktor terlemah: ${model.weakestFactor}.`,
    risk: "Rasio yang lemah biasanya saling berkaitan: cashflow tipis memperlambat dana darurat, dana darurat rendah meningkatkan risiko utang, dan utang tinggi menekan kontribusi tujuan.",
    recommendation: "Perbaiki satu rasio paling kritis terlebih dahulu selama 30-90 hari, lalu ukur ulang sebelum menambah komitmen baru."
  });

  pdf.chapter("BAB 5", "Profil Risiko", "Kesesuaian risk preference dengan risk capacity, likuiditas, utang, dan konsentrasi investasi.");
  pdf.chartCard("Financial Health Score", "Skor kesehatan finansial dari cashflow, rasio menabung, budget, debt, dana darurat, dan stabilitas.", () => {
    pdf.donut(142, pdf.y + 54, 40, model.healthScore, statusColor(model.healthStatus as ReportStatus));
    pdf.text(`${model.healthScore}`, 129, pdf.y + 59, { size: 22, bold: true, color: colors.ink });
    pdf.text("/100", 134, pdf.y + 76, { size: 9, color: colors.secondary });
    pdf.statusBadge(model.healthStatus as ReportStatus, 215, pdf.y + 38);
    pdf.text(wrapOneLine(scoreInterpretation(model.healthScore), 52), 215, pdf.y + 67, { size: 10, color: colors.secondary });
  }, 130);
  pdf.reportSection({
    title: "Kesesuaian profil risiko",
    summary: riskProfileNarrative(model.planningProfile, model.analytics.monthlyCashflow, model.emergencySource.monthsCoverage, model.analytics.debtRatio),
    interpretation: investmentNarrative(model.assetAllocation, model.planningProfile?.riskProfile, model.emergencySource.monthsCoverage, model.analytics.debtRatio),
    risk: model.concentrationStatus === "critical" ? "Konsentrasi aset tinggi dapat membuat rencana terlalu bergantung pada satu kelas aset atau instrumen." : "Konsentrasi aset masih perlu dipantau karena alokasi aktual dapat berubah setelah nilai aset diperbarui.",
    recommendation: "Pastikan risk profile, horizon tujuan, dan kapasitas menanggung risiko dibaca bersama, bukan hanya dari preferensi investasi."
  });
  pdf.donutLegendChart("Alokasi Aset", "Komposisi aset tercatat dan potensi konsentrasi.", model.assetAllocation);

  pdf.chapter("BAB 6", "Manajemen Risiko & Proteksi", "Kebutuhan proteksi keluarga, utang, pendapatan, dan likuiditas darurat.");
  pdf.summaryCards([
    ["Dana darurat", `${model.emergencySource.monthsCoverage} bulan`, model.emergencySource.monthsCoverage < 1 ? "critical" : model.emergencySource.monthsCoverage < model.emergencyGuideline.minimumMonths ? "warning" : "healthy"],
    ["Tanggungan", model.dependencyLabel, model.dependencyStatus],
    ["Debt ratio", `${model.analytics.debtRatio}%`, model.analytics.debtRatio > 50 ? "critical" : model.analytics.debtRatio > 30 ? "warning" : "healthy"]
  ]);
  pdf.reportSection({
    title: "Proteksi dan ketahanan",
    summary: protectionNarrative(model.planningProfile, model.analytics.monthlyCashflow, model.emergencySource.monthsCoverage, model.analytics.debtRatio),
    interpretation: emergencyGuidance(model.emergencySource.monthsCoverage, model.emergencyGuideline),
    risk: model.protectionStatus === "critical" ? "Kombinasi tanggungan, likuiditas rendah, dan utang dapat membuat keluarga rentan saat pendapatan terganggu." : "Proteksi tetap perlu ditinjau agar risiko kesehatan, kehilangan pendapatan, dan kewajiban keluarga tidak seluruhnya ditanggung cashflow bulanan.",
    recommendation: "Review kebutuhan asuransi jiwa, kesehatan, proteksi penghasilan, dan pelunasan utang sesuai jumlah tanggungan serta nilai kewajiban."
  });
  pdf.insightBoxes(model);

  pdf.chapter("BAB 7", "Financial Action Plan", "Rencana tindakan finansial yang dapat ditinjau ulang secara berkala.");
  pdf.sectionTitle("Scenario Engine", "Simulasi lokal untuk melihat dampak keputusan kecil terhadap rencana.");
  if (model.scenarios.length > 0) {
    model.scenarios.slice(0, 4).forEach((scenario, index) => {
      pdf.priorityCard(index + 1, `${scenarioPriorityLabel(scenario.priority)} - ${scenario.title}. ${scenario.summary} ${scenario.projectedImpact}`);
    });
  } else {
    pdf.card("Scenario belum tersedia", "Tambahkan transaksi, goals, aset, atau debt agar simulasi lokal bisa memberi opsi tindakan yang lebih presisi.", "warning");
  }
  pdf.reportSection({
    title: "Prioritas planner",
    summary: "Action plan disusun dengan urutan stabilisasi, proteksi, optimasi, lalu akselerasi tujuan. Urutan ini membantu agar keputusan investasi atau tujuan besar tidak mendahului fondasi cashflow.",
    interpretation: model.dynamicRecommendations[0] ?? "Tidak ada prioritas kritis dari rule engine pada data saat ini.",
    risk: "Tanpa action plan yang spesifik, insight laporan mudah berhenti sebagai informasi dan tidak berubah menjadi keputusan finansial sehari-hari.",
    recommendation: "Gunakan checklist 30 hari, 90 hari, dan kuartalan untuk menjaga momentum review."
  });
  model.dynamicRecommendations.slice(0, 6).forEach((item, index) => pdf.priorityCard(index + 1, item));
  pdf.sectionTitle("Checklist Implementasi", "Langkah praktis untuk review berikutnya.");
  model.actionPlan.forEach((action, index) => pdf.checklist(index + 1, action));
  pdf.appendix(model);

  return pdf.output();
}

function buildReportModel(backup: PlannerBackup, tier: CommercialTier) {
  const { tables } = backup;
  const referenceDate = new Date(backup.exportedAt);
  const period = toPeriodKey(referenceDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" }), referenceDate);
  const planningProfile = readSetting<PlanningProfile>(tables.appSettings, "planningProfile");
  const analytics = buildDashboardAnalytics({
    period,
    accounts: tables.accounts,
    assets: tables.assets,
    liabilities: tables.liabilities,
    categories: tables.categories,
    transactions: tables.transactions,
    budgets: tables.budgets,
    goals: tables.goals,
    recurringRules: tables.recurringRules,
    referenceDate
  });
  const financialModel = buildFinancialModel({ accounts: tables.accounts, assets: tables.assets, liabilities: tables.liabilities, goals: tables.goals });
  const burnRate = estimateMonthlyBurnRate(tables.transactions.filter((transaction) => !transaction.deletedAt), analytics.totalExpense);
  const emergencySource = resolveReportEmergencySource(tables.goals, financialModel.liquidAssets, burnRate);
  const insights = generateInsights({
    period,
    accounts: tables.accounts,
    assets: tables.assets,
    liabilities: tables.liabilities,
    categories: tables.categories,
    transactions: tables.transactions,
    budgets: tables.budgets,
    goals: tables.goals,
    recurringRules: tables.recurringRules,
    planningProfile,
    referenceDate
  });
  const healthInsight = insights.find((insight) => insight.ruleId === "financial-health-score");
  const healthScore = Number(healthInsight?.evidence.find((item) => item.label === "Health score")?.value ?? 0);
  const goalRows = tables.goals
    .filter((goal) => !goal.deletedAt && goal.status !== "archived")
    .map((goal) => ({ goal, projection: projectGoal(goal, planningProfile, referenceDate) }));
  const totalGoalTarget = goalRows.reduce((total, row) => total + row.goal.targetAmount, 0);
  const totalGoalProgress = goalRows.reduce((total, row) => total + row.goal.currentAmount, 0);
  const goalProgressPercent = totalGoalTarget > 0 ? Math.round((totalGoalProgress / totalGoalTarget) * 100) : 0;
  const recommendations = generateFinancialRecommendations({
    analytics,
    goals: tables.goals,
    accounts: tables.accounts,
    assets: tables.assets,
    liabilities: tables.liabilities,
    planningProfile
  });
  const prioritizedInsights = insights
    .filter((insight) => insight.ruleId !== "financial-health-score")
    .slice(0, 8)
    .map((insight) => `${severityRank(insight.severity)} - ${insight.title}. ${insight.body}`);
  const dynamicRecommendations = buildDynamicPriorityRecommendations({
    cashflow: analytics.monthlyCashflow,
    debtRatio: analytics.debtRatio,
    emergencyMonths: emergencySource.monthsCoverage,
    savingsRate: analytics.savingsRate,
    netWorth: analytics.netWorth,
    age: planningProfile?.currentAge,
    riskProfile: planningProfile?.riskProfile,
    goalCount: goalRows.length,
    goalProgressPercent,
    insights: prioritizedInsights,
    generatedRecommendations: recommendations.map((item) => `${priorityLabel(item.priority)} - ${item.title}: ${item.recommendation}`)
  });
  const scenarios = buildScenarioEngine({
    income: analytics.totalIncome,
    expense: analytics.totalExpense,
    monthlyBurnRate: burnRate,
    financialModel,
    goals: goalRows.map((row) => row.goal),
    planningProfile
  });
  const assetAllocation = allocationRows(financialModel.assets.map((asset) => ({ label: asset.kind, value: asset.amount })));
  const expenseIncomeRatio = analytics.totalIncome > 0 ? Math.round((analytics.totalExpense / analytics.totalIncome) * 100) : 0;
  const largestAllocation = assetAllocation[0];
  const concentrationStatus: ReportStatus = largestAllocation && largestAllocation.percent >= 75 ? "critical" : largestAllocation && largestAllocation.percent >= 60 ? "warning" : "healthy";
  const dependencyStatus: ReportStatus = (planningProfile?.dependentsCount ?? 0) > 0 || planningProfile?.maritalStatus === "married" ? "warning" : "healthy";
  const emergencyGuideline = emergencyFundGuideline(planningProfile);
  const protectionStatus: ReportStatus =
    dependencyStatus === "warning" && (emergencySource.monthsCoverage < emergencyGuideline.minimumMonths || analytics.debtRatio > 30)
      ? "critical"
      : emergencySource.monthsCoverage < emergencyGuideline.minimumMonths || analytics.debtRatio > 30
        ? "warning"
        : "healthy";
  const spendingTrendLabel =
    analytics.expenseChangePercent > 15
      ? "meningkat signifikan"
      : analytics.expenseChangePercent < -15
        ? "menurun signifikan"
        : "relatif stabil";
  const actionPlan = buildActionPlan({
    cashflow: analytics.monthlyCashflow,
    savingsRate: analytics.savingsRate,
    emergencyMonths: emergencySource.monthsCoverage,
    debtRatio: analytics.debtRatio,
    goalProgressPercent
  });

  return {
    tier,
    exportedAt: backup.exportedAt,
    analytics,
    planningProfile,
    insights,
    healthScore,
    healthStatus: healthScore >= 70 ? "healthy" : healthScore >= 50 ? "warning" : "critical",
    riskStatus: emergencySource.monthsCoverage < emergencyGuideline.minimumMonths || analytics.debtRatio > 30 ? "warning" : "healthy",
    investmentStatus: emergencySource.monthsCoverage < emergencyGuideline.minimumMonths || analytics.debtRatio > 50 ? "warning" : "healthy",
    emergencySource,
    emergencyGuideline,
    goalRows,
    goalProgressPercent,
    assetAllocation,
    expenseIncomeRatio,
    concentrationStatus,
    dependencyStatus,
    protectionStatus,
    dependencyLabel: planningProfile ? `${planningProfile.dependentsCount} tanggungan` : "Belum diisi",
    spendingTrendLabel,
    actionPlan,
    dynamicRecommendations,
    scenarios,
    strongestFactor: healthInsight ? evidenceText(healthInsight, "Faktor terbesar") : "-",
    weakestFactor: healthInsight ? evidenceText(healthInsight, "Faktor terlemah") : "-"
  };
}

function readSetting<T>(settings: AppSetting[], key: string) {
  return settings.find((setting) => setting.key === key)?.value as T | undefined;
}

function allocationRows(rows: Array<{ label: string; value: number }>) {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const label = assetKindLabel(row.label);
    totals.set(label, (totals.get(label) ?? 0) + row.value);
  });
  const total = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value, percent: total > 0 ? Math.round((value / total) * 100) : 0 }))
    .sort((left, right) => right.value - left.value);
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

function section(title: string, body: string) {
  return `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function metricCard(label: string, value: string, explanation: string) {
  return `<div class="card"><p class="muted">${escapeHtml(label)}</p><p class="value">${escapeHtml(value)}</p><p>${escapeHtml(explanation)}</p></div>`;
}

function explainBlock(title: string, formula: string, interpretation: string, recommendation: string) {
  return `<div class="card"><h3>${escapeHtml(title)}</h3><p><strong>Formula/logic:</strong> ${escapeHtml(formula)}</p><p><strong>Interpretation:</strong> ${escapeHtml(interpretation)}</p><p><strong>Recommendation:</strong> ${escapeHtml(recommendation)}</p></div>`;
}

function table(headers: string[], rows: Array<Array<string | number>>) {
  if (rows.length === 0) return "<p class=\"muted\">No data available for this section yet.</p>";
  return `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function healthBreakdownTable(healthInsight: NonNullable<ReturnType<typeof generateInsights>[number]>) {
  const rows = [
    ["Cashflow", "Poin cashflow", "Bobot cashflow"],
    ["Savings", "Poin menabung", "Bobot menabung"],
    ["Budget", "Poin budget", "Bobot budget"],
    ["Debt", "Poin utang", "Bobot utang"],
    ["Emergency", "Poin dana darurat", "Bobot dana darurat"],
    ["Stability", "Poin stabilitas", "Bobot stabilitas"]
  ].map(([label, score, max]) => [label, evidenceText(healthInsight, score), evidenceText(healthInsight, max)]);
  return table(["Component", "Score", "Max"], rows);
}

function evidenceText(insight: ReturnType<typeof generateInsights>[number], label: string) {
  return String(insight.evidence.find((item) => item.label === label)?.value ?? "-");
}

function executiveInterpretation(score: number, savingsRate: number, debtRatio: number, runwayMonths: number) {
  if (score >= 80) return `Strong foundation. Savings rate ${savingsRate}%, debt ratio ${debtRatio}%, emergency runway ${runwayMonths} months.`;
  if (score >= 65) return `Stable but still worth tuning. Savings rate ${savingsRate}%, debt ratio ${debtRatio}%, emergency runway ${runwayMonths} months.`;
  return `Needs focused improvement. Savings rate ${savingsRate}%, debt ratio ${debtRatio}%, emergency runway ${runwayMonths} months.`;
}

function scoreInterpretation(score: number) {
  if (score >= 80) return "Kuat: fondasi perencanaan utama berada dalam kondisi sehat.";
  if (score >= 65) return "Stabil: sebagian besar fondasi berjalan, dengan beberapa tuas perbaikan yang jelas.";
  if (score >= 50) return "Perlu perhatian: perbaiki komponen terlemah sebelum menambah kompleksitas.";
  return "Risiko tinggi: stabilkan cashflow, dana darurat, dan tekanan utang terlebih dahulu.";
}

function reportTone(score: number) {
  if (score >= 80) {
    return "Secara umum, rencana memiliki fondasi kuat. Fokus utama saat ini adalah menjaga cashflow positif, menghindari komitmen tetap yang tidak perlu, dan mengarahkan surplus ke tujuan secara sengaja.";
  }
  if (score >= 65) {
    return "Secara umum, rencana masih layak dijalankan dan memiliki basis yang jelas. Langkah terbaik adalah memperbaiki komponen terlemah sebelum masuk ke keputusan planning yang lebih kompleks.";
  }
  if (score >= 50) {
    return "Secara umum, rencana membutuhkan perbaikan terarah, tetapi jalurnya masih terbaca. Mulai dari cashflow, dana darurat, dan tekanan utang sebelum menambah komitmen jangka panjang.";
  }
  return "Secara umum, rencana perlu distabilkan terlebih dahulu. Dalam urutan perencanaan keuangan, likuiditas dan ketahanan cashflow didahulukan sebelum pendanaan tujuan agresif atau risiko investasi.";
}

function cashflowGuidance(savingsRate: number, cashflow: number) {
  if (cashflow < 0) return "Panduan: tunda tujuan diskresioner baru dan pilih satu atau dua kategori fleksibel untuk dikurangi lebih dulu.";
  if (savingsRate >= 20) return "Panduan: savings rate sudah sehat. Arahkan surplus ke dana darurat, pelunasan utang, atau tujuan prioritas sebelum berubah menjadi belanja menganggur.";
  if (savingsRate >= 10) return "Panduan: cashflow positif, tetapi bantalan masih moderat. Pengeluaran rutin kecil perlu ditinjau sebelum komitmen dinaikkan.";
  return "Panduan: bangun bantalan lebih besar. Target praktis pertama adalah menaikkan savings rate ke 10%, lalu 20% saat sudah stabil.";
}

function emergencyGuidance(months: number, guideline = emergencyFundGuideline()) {
  if (months >= guideline.idealMonths) return `Panduan: dana darurat terlihat kuat untuk status ${guideline.label}. Jaga agar tetap likuid dan tidak tercampur dengan risiko investasi.`;
  if (months >= guideline.minimumMonths) return `Panduan: dana darurat sudah melewati minimum ${guideline.minimumMonths} bulan. Lanjutkan menuju ${guideline.idealMonths} bulan agar lebih aman.`;
  if (months >= 1) return `Panduan: prioritaskan menambah dana darurat sebelum mengambil tujuan opsional baru. Minimum untuk status ${guideline.label} adalah ${guideline.minimumMonths} bulan.`;
  return "Panduan: mulai dari dana darurat awal dulu. Bantalan kecil yang likuid dapat mengurangi ketergantungan pada utang saat ada kejutan.";
}

function debtGuidance(debtRatio: number) {
  if (debtRatio >= 50) return "Panduan: tekanan debt tinggi. Review cicilan minimum, biaya bunga, dan urutan pelunasan sebelum menambah kewajiban tetap.";
  if (debtRatio >= 30) return "Panduan: debt perlu dipantau. Buat jadwal pelunasan tetap terlihat dan hindari mengubah belanja fleksibel menjadi cicilan baru.";
  if (debtRatio > 0) return "Panduan: debt terlihat masih terkendali dari data saat ini. Pertahankan ritme pembayaran dan hindari keterlambatan.";
  return "Panduan: belum terlihat tekanan liabilitas. Jaga posisi ini dengan memastikan pinjaman baru selalu punya tujuan yang jelas.";
}

function barLine(label: string, value: number, max: number) {
  const safeValue = Math.max(0, Math.min(value, max));
  const filled = Math.round((safeValue / max) * 20);
  return `${label.padEnd(18)} [${"#".repeat(filled)}${"-".repeat(20 - filled)}] ${safeValue}/${max}`;
}

function goalFundingNarrative(goalCount: number, goalProgressPercent: number, cashflow: number, emergencyMonths: number) {
  if (goalCount === 0) return "Interpretasi: perencanaan tujuan belum terlihat. Mulai dari tujuan ketahanan seperti dana darurat sebelum target diskresioner.";
  if (cashflow < 0 && goalProgressPercent < 30) return "Interpretasi: tujuan sudah ada, tetapi cashflow saat ini mungkin belum mendukung pendanaan agresif. Urutkan ulang tujuan sebelum menaikkan kontribusi.";
  if (emergencyMonths < 3) return "Interpretasi: tujuan sudah aktif, tetapi dana darurat masih di bawah guardrail umum tiga bulan.";
  return "Interpretasi: tracking tujuan sudah terlihat. Jaga asumsi kontribusi tetap realistis dan perbarui timeline saat pendapatan atau prioritas berubah.";
}

function ratioNarrative(savingsRate: number, expenseIncomeRatio: number, debtRatio: number, emergencyMonths: number) {
  const concerns = [
    savingsRate < 10 ? "rasio menabung masih tipis" : "",
    expenseIncomeRatio > 85 ? "tekanan expense-to-income tinggi" : "",
    debtRatio > 30 ? "debt ratio perlu dipantau" : "",
    emergencyMonths < 3 ? "dana darurat masih di bawah cadangan umum" : ""
  ].filter(Boolean);
  if (concerns.length === 0) return "Interpretasi: rasio utama terlihat cukup seimbang dari data lokal saat ini.";
  return `Interpretasi: ${concerns.join(", ")}. Perbaiki rasio yang paling sempit sebelum memperbesar komitmen opsional.`;
}

function riskProfileNarrative(profile: PlanningProfile | undefined, cashflow: number, emergencyMonths: number, debtRatio: number) {
  const riskProfile = profile?.riskProfile ?? "moderate";
  const ageText = profile ? `Usia ${profile.currentAge} dengan target pensiun ${profile.retirementTargetAge}.` : "Planning profile belum diisi.";
  const capacity =
    cashflow > 0 && emergencyMonths >= 3 && debtRatio < 30
      ? "Risk capacity terlihat cukup layak karena cashflow, likuiditas, dan tekanan debt tidak sedang tertekan bersamaan."
      : "Risk capacity sebaiknya dibaca konservatif sampai cashflow, likuiditas, atau tekanan debt membaik.";
  return `${ageText} Risk profile tercatat: ${riskProfile}. ${capacity}`;
}

function protectionNarrative(profile: PlanningProfile | undefined, cashflow: number, emergencyMonths: number, debtRatio: number) {
  const hasDependents = (profile?.dependentsCount ?? 0) > 0 || profile?.maritalStatus === "married";
  const protectionNeed = hasDependents ? "Karena ada tanggungan atau kewajiban rumah tangga, proteksi perlu direview secara eksplisit." : "Proteksi tetap perlu direview, terutama untuk kesehatan, gangguan pendapatan, dan kewajiban debt.";
  const liquidityNote = emergencyMonths < 3 ? "Likuiditas darurat masih terbatas, jadi risiko biaya kesehatan dan gangguan pendapatan menjadi lebih penting." : "Likuiditas darurat memberi ketahanan jangka pendek, tetapi tidak menggantikan proteksi.";
  const debtNote = debtRatio > 30 ? "Tekanan debt membuat perlindungan kemampuan bayar menjadi lebih penting." : "Tekanan debt belum terlihat dominan dari data saat ini.";
  const cashflowNote = cashflow < 0 ? "Cashflow negatif dapat membuat premi atau gap proteksi lebih sulit dikelola, jadi affordability perlu dicek hati-hati." : "Cashflow positif dapat mendukung review proteksi tanpa menekan semua tujuan.";
  return `${protectionNeed} ${liquidityNote} ${debtNote} ${cashflowNote}`;
}

function investmentNarrative(
  allocation: Array<{ label: string; value: number; percent: number }>,
  riskProfile: PlanningProfile["riskProfile"] | undefined,
  emergencyMonths: number,
  debtRatio: number
) {
  const largest = [...allocation].sort((left, right) => right.percent - left.percent)[0];
  const concentration = largest && largest.percent > 60 ? `Alokasi terbesar adalah ${largest.label} sebesar ${largest.percent}%, sehingga risiko konsentrasi perlu direview.` : "Belum ada satu alokasi tercatat yang terlalu dominan dari data saat ini.";
  const readiness = emergencyMonths >= 3 && debtRatio < 30 ? "Kondisi likuiditas dan debt lebih mendukung investasi bertahap." : "Perkuat likuiditas dan posisi debt sebelum menambah risiko investasi.";
  return `Risk profile tercatat: ${riskProfile ?? "belum diisi"}. ${concentration} ${readiness}`;
}

function buildActionPlan(input: { cashflow: number; savingsRate: number; emergencyMonths: number; debtRatio: number; goalProgressPercent: number }) {
  const actions: string[] = [];
  if (input.cashflow < 0) actions.push("0-30 hari: stabilkan cashflow dengan mengurangi satu kategori fleksibel dan menunda komitmen opsional baru.");
  if (input.emergencyMonths < 1) actions.push("0-30 hari: bentuk dana darurat awal sebelum mempercepat tujuan diskresioner.");
  else if (input.emergencyMonths < 3) actions.push("30-90 hari: naikkan dana darurat menuju tiga bulan pengeluaran.");
  if (input.debtRatio > 30) actions.push("30-90 hari: petakan saldo debt, cicilan minimum, bunga, dan prioritas pelunasan.");
  if (input.savingsRate < 10 && input.cashflow >= 0) actions.push("30-90 hari: naikkan rasio menabung menuju 10% lewat kontribusi otomatis kecil.");
  if (input.goalProgressPercent < 50) actions.push("Kuartalan: review deadline dan kebutuhan kontribusi bulanan agar target tetap realistis.");
  if (actions.length === 0) actions.push("Kuartalan: pertahankan ritme saat ini, rekonsiliasi saldo akun, dan pastikan surplus sudah diberi tujuan.");
  return actions;
}

function buildDynamicPriorityRecommendations(input: {
  cashflow: number;
  debtRatio: number;
  emergencyMonths: number;
  savingsRate: number;
  netWorth: number;
  age?: number;
  riskProfile?: PlanningProfile["riskProfile"];
  goalCount: number;
  goalProgressPercent: number;
  insights: string[];
  generatedRecommendations: string[];
}) {
  const rows: string[] = [];
  const stressedFoundation = input.cashflow < 0 || input.emergencyMonths < 1 || input.debtRatio >= 50;
  const thinButRecoverable = input.cashflow >= 0 && (input.savingsRate < 10 || input.emergencyMonths < 3 || input.debtRatio >= 30);
  const growthReady = input.cashflow > 0 && input.savingsRate >= 20 && input.emergencyMonths >= 3 && input.debtRatio < 30;

  if (stressedFoundation) {
    rows.push("KRITIS - Stabilkan fondasi dulu. Cashflow, dana darurat, atau tekanan debt menunjukkan bahwa ketahanan perlu didahulukan sebelum pendanaan tujuan agresif atau risiko investasi.");
  }
  if (thinButRecoverable) {
    rows.push("TINGGI - Perkuat bantalan terlemah. Cashflow masih positif, tetapi rasio menabung, dana darurat, atau debt ratio menunjukkan rencana butuh margin lebih besar.");
  }
  if (growthReady) {
    rows.push("SEDANG - Arahkan surplus secara sengaja. Rasio saat ini mendukung pendanaan tujuan yang lebih terstruktur selama likuiditas tetap aman.");
  }
  if ((input.age ?? 0) >= 45 && input.goalCount === 0) {
    rows.push("TINGGI - Tambahkan tujuan jangka panjang. Dengan runway pensiun yang lebih pendek, ketiadaan target membuat kualitas proyeksi melemah.");
  }
  if (input.riskProfile === "aggressive" && input.emergencyMonths < 3) {
    rows.push("TINGGI - Selaraskan risk preference dengan risk capacity. Profil agresif kurang berkelanjutan bila likuiditas masih di bawah tiga bulan.");
  }
  if (input.netWorth < 0 && input.cashflow <= 0) {
    rows.push("KRITIS - Fokus pada perbaikan neraca. Net Worth negatif ditambah cashflow lemah perlu memprioritaskan kontrol debt dan struktur belanja.");
  }
  if (input.goalCount > 0 && input.goalProgressPercent < 25 && input.savingsRate < 10) {
    rows.push("SEDANG - Kalibrasi ulang tujuan. Progress pendanaan dan rasio menabung menunjukkan target mungkin butuh timeline lebih panjang atau kebutuhan bulanan lebih kecil.");
  }

  rows.push(...input.insights.slice(0, 3));
  rows.push(...input.generatedRecommendations.slice(0, 3));
  return rows.length ? rows : ["RENDAH - Pertahankan rencana dan review kuartalan. Belum ada prioritas besar dari rule engine berdasarkan data lokal saat ini."];
}

function severityRank(severity: ReturnType<typeof generateInsights>[number]["severity"]) {
  if (severity === "critical") return "KRITIS";
  if (severity === "warning") return "TINGGI";
  if (severity === "info") return "SEDANG";
  return "RENDAH";
}

function priorityLabel(priority: "low" | "medium" | "high") {
  if (priority === "high") return "TINGGI";
  if (priority === "medium") return "SEDANG";
  return "RENDAH";
}

function scenarioPriorityLabel(priority: "stabilization" | "resilience" | "debt" | "goals" | "growth") {
  if (priority === "stabilization") return "KRITIS";
  if (priority === "resilience" || priority === "debt") return "TINGGI";
  if (priority === "goals") return "SEDANG";
  return "RENDAH";
}

function goalProjectionExplanation(goal: Goal, projection: GoalProjection) {
  const contribution = goal.monthlyContribution ?? 0;
  const required = projection.requiredMonthlyContribution ?? 0;
  const completion = projection.projectedCompletionLabel;
  const returnText = ` Asumsi return ${formatPercent(projection.annualReturn)} per tahun.`;
  if (projection.feasibilityStatus === "complete") return `Target sudah tercapai dari nominal saat ini.${returnText}`;
  if (!contribution) {
    return required > 0
      ? `Belum ada kontribusi bulanan. Agar sesuai target, estimasi kontribusi perlu sekitar ${money(required)} per bulan.${returnText}`
      : `Belum ada kontribusi bulanan, sehingga target perlu diberi rencana pendanaan terlebih dahulu.${returnText}`;
  }
  if (projection.feasibilityStatus === "on_track") {
    return required > 0
      ? `Kontribusi ${money(contribution)} per bulan memenuhi kebutuhan estimasi ${money(required)}. Proyeksi selesai ${completion}.${returnText}`
      : `Kontribusi ${money(contribution)} per bulan membuat target masih terbaca layak. Proyeksi selesai ${completion}.${returnText}`;
  }
  if (projection.feasibilityStatus === "watch") {
    return required > 0
      ? `Kontribusi ${money(contribution)} mendekati kebutuhan ${money(required)} per bulan, tetapi masih perlu dipantau agar tidak tertinggal.${returnText}`
      : `Kontribusi ${money(contribution)} sudah ada, tetapi target belum punya tenggat jelas untuk validasi kebutuhan bulanan.${returnText}`;
  }
  return required > 0
    ? `Kontribusi perlu dinaikkan dari ${money(contribution)} menjadi sekitar ${money(required)} per bulan agar target sesuai jadwal.${returnText}`
    : `Dengan kontribusi ${money(contribution)}, target belum cukup kuat. Pertimbangkan menaikkan kontribusi atau memperpanjang deadline.${returnText}`;
}

const colors = {
  ink: "#25313F",
  secondary: "#68746E",
  muted: "#EFF4EE",
  surface: "#FFFDF8",
  sage: "#7FAE93",
  success: "#4F9D69",
  sky: "#B1CEDA",
  warning: "#D99145",
  danger: "#C94C4C",
  line: "#DDE7DE",
  canvas: "#F8F5EF"
};

type ReportStatus = "healthy" | "warning" | "critical";

function money(value: number) {
  return formatCurrency(value).replace(/\s+/g, " ");
}

function formatPercent(value: number) {
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
}

function statusColor(status: ReportStatus) {
  if (status === "critical") return colors.danger;
  if (status === "warning") return colors.warning;
  return colors.success;
}

function ratioStatus(value: number, healthyThreshold: number, warningThreshold: number, lowerIsBetter: boolean): ReportStatus {
  if (lowerIsBetter) {
    if (value <= healthyThreshold) return "healthy";
    if (value <= warningThreshold) return "warning";
    return "critical";
  }
  if (value >= healthyThreshold) return "healthy";
  if (value >= warningThreshold) return "warning";
  return "critical";
}

function rgb(hex: string) {
  const normalized = hex.replace("#", "");
  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;
  return `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)}`;
}

function pdfTextCommand(value: string, x: number, y: number, options: { size?: number; bold?: boolean; color?: string } = {}) {
  const font = options.bold ? "F2" : "F1";
  return `BT /${font} ${options.size ?? 10} Tf ${rgb(options.color ?? colors.ink)} rg ${x.toFixed(2)} ${(842 - y).toFixed(2)} Td (${escapePdfText(toPdfSafeText(value))}) Tj ET`;
}

function pdfLineCommand(x1: number, y1: number, x2: number, y2: number, color: string) {
  return `${rgb(color)} RG 1 w ${x1} ${842 - y1} m ${x2} ${842 - y2} l S`;
}

function wrapText(value: string, maxLength: number) {
  const words = toPdfSafeText(value).split(" ");
  const rows: string[] = [];
  let current = "";
  words.forEach((word) => {
    if (`${current} ${word}`.trim().length > maxLength) {
      if (current) rows.push(current);
      current = word;
      return;
    }
    current = `${current} ${word}`.trim();
  });
  if (current) rows.push(current);
  return rows;
}

function wrapOneLine(value: string, maxLength: number) {
  const safe = toPdfSafeText(value);
  return safe.length > maxLength ? `${safe.slice(0, Math.max(maxLength - 3, 1))}...` : safe;
}

function tableColumnWidths(headers: string[]) {
  if (headers.join("|") === "Tujuan|Progress|Target|Status|Penjelasan") return [100, 70, 100, 100, 141];
  return Array.from({ length: headers.length }, () => 511 / headers.length);
}

function buildPdfObjects(objects: string[]) {
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

class ModernPdf {
  private pages: string[][] = [[]];
  y = 56;

  cover(model: ReturnType<typeof buildReportModel>) {
    const x = 156;
    this.rect(0, 0, 595, 842, colors.canvas);
    this.text("DANAPETA", x, 245, { size: 38, bold: true, color: colors.ink });
    this.text("PETA FINANSIALMU", x + 2, 286, { size: 13, bold: true, color: colors.sage });
    this.line(x + 2, 314, x + 338, 314, colors.line);
    this.text("Laporan Perencanaan Keuangan", x, 374, { size: 23, bold: true, color: colors.ink });
    this.text("Analisis berbasis data lokal dan rule-based insight engine", x, 402, { size: 10.5, color: colors.secondary });
    this.text(`Tanggal: ${new Date(model.exportedAt).toLocaleString("id-ID")}  |  Tier: ${tierDefinitions[model.tier].name}`, x, 430, { size: 9, color: colors.secondary });
    this.text("Privat, lokal, dan dibuat sebagai bahan review mandiri.", x, 462, { size: 9, color: colors.secondary });
    this.y = 560;
  }

  executiveSummary(model: ReturnType<typeof buildReportModel>) {
    this.sectionTitle("Ringkasan Eksekutif", "Ringkasan kondisi yang perlu dipahami dalam beberapa detik.");
    this.summaryCards([
      ["Health Score", `${model.healthScore}/100`, model.healthStatus],
      ["Net Worth", money(model.analytics.netWorth), model.analytics.netWorth < 0 ? "critical" : "healthy"],
      ["Cashflow", money(model.analytics.monthlyCashflow), model.analytics.monthlyCashflow < 0 ? "critical" : "healthy"],
      ["Dana Darurat", `${model.emergencySource.monthsCoverage} bulan`, model.emergencySource.monthsCoverage < 1 ? "critical" : model.emergencySource.monthsCoverage < 3 ? "warning" : "healthy"]
    ]);
    this.card(
      "Catatan Planner",
      `${reportTone(model.healthScore)} Faktor terkuat saat ini adalah ${model.strongestFactor}. Area yang paling perlu diprioritaskan adalah ${model.weakestFactor}.`,
      model.healthStatus
    );
  }

  plannerMemo(model: ReturnType<typeof buildReportModel>, diagnosis: PlannerDiagnosis) {
    this.ensure(430);
    this.text("Kepada pengguna DANAPETA,", 42, this.y, { size: 10, bold: true, color: colors.ink });
    this.y += 24;
    [
      diagnosis.opening,
      diagnosis.phaseBody,
      `Kekuatan utama yang terlihat adalah ${model.strongestFactor}. Area yang paling perlu diberi perhatian adalah ${model.weakestFactor}. Ini bukan label baik atau buruk, tetapi cara untuk menentukan urutan keputusan yang lebih sehat.`,
      diagnosis.mainRisk,
      diagnosis.mainPriority
    ].forEach((paragraph) => this.paragraph(paragraph, 42, 92, 9.2, colors.ink));
    this.y += 6;
    this.rect(42, this.y, 511, 72, colors.muted, colors.line);
    this.text("Prioritas 30 hari", 60, this.y + 22, { size: 11, bold: true, color: colors.ink });
    wrapText(diagnosis.thirtyDayFocus, 88).forEach((line, index) => this.text(line, 60, this.y + 42 + index * 11, { size: 8.5, color: colors.secondary }));
    this.y += 96;
  }

  proseSection(title: string, body: string) {
    const lines = wrapText(body, 92);
    this.ensure(36 + lines.length * 12);
    this.text(title, 42, this.y, { size: 13, bold: true, color: colors.ink });
    this.line(42, this.y + 10, 553, this.y + 10, colors.line);
    this.y += 25;
    lines.forEach((line, index) => this.text(line, 42, this.y + index * 12, { size: 9, color: colors.secondary }));
    this.y += lines.length * 12 + 16;
  }

  paragraph(body: string, x: number, maxLength: number, size: number, color: string) {
    const lines = wrapText(body, maxLength);
    this.ensure(lines.length * 12 + 12);
    lines.forEach((line, index) => this.text(line, x, this.y + index * 12, { size, color }));
    this.y += lines.length * 12 + 12;
  }

  chapter(kicker: string, title: string, subtitle: string) {
    this.newPage();
    this.rect(0, 0, 595, 842, colors.canvas);
    this.rect(42, 56, 511, 92, colors.ink);
    this.text(kicker, 62, 88, { size: 10, bold: true, color: "#D7E9DD" });
    this.text(title, 62, 116, { size: 21, bold: true, color: "#FFFFFF" });
    this.text(subtitle, 62, 136, { size: 9, color: "#E8F1EA" });
    this.y = 178;
  }

  sectionTitle(title: string, subtitle: string) {
    this.ensure(70);
    this.text(title, 42, this.y, { size: 18, bold: true, color: colors.ink });
    this.text(subtitle, 42, this.y + 18, { size: 9, color: colors.secondary });
    this.line(42, this.y + 30, 553, this.y + 30, colors.line);
    this.y += 48;
  }

  reportSection(input: { title: string; summary: string; interpretation: string; risk: string; recommendation: string }) {
    const blocks = [
      ["Ringkasan", input.summary, "healthy"],
      ["Interpretasi", input.interpretation, "healthy"],
      ["Implikasi Risiko", input.risk, "warning"],
      ["Rekomendasi", input.recommendation, "healthy"]
    ] as Array<[string, string, ReportStatus]>;
    this.ensure(58);
    this.text(input.title, 42, this.y, { size: 14, bold: true, color: colors.ink });
    this.line(42, this.y + 10, 553, this.y + 10, colors.line);
    this.y += 24;
    blocks.forEach(([label, body, status]) => this.insightBox(label, body, status));
  }

  summaryCards(items: Array<[string, string, string]>) {
    const columns = Math.min(3, items.length);
    const width = (511 - 14 * (columns - 1)) / columns;
    const height = 88;
    items.forEach(([label, value, status], index) => {
      if (index % columns === 0) this.ensure(height + 20);
      const column = index % columns;
      const x = 42 + column * (width + 14);
      const y = this.y;
      this.rect(x, y, width, height, colors.surface, colors.line);
      this.rect(x, y, 4, height, statusColor(status as ReportStatus));
      this.text(label, x + 14, y + 24, { size: 8, color: colors.secondary });
      this.statusBadge(status as ReportStatus, x + width - 66, y + 16);
      wrapText(value, width > 155 ? 22 : 18).slice(0, 2).forEach((line, lineIndex) =>
        this.text(line, x + 14, y + 58 + lineIndex * 12, { size: line.length > 18 ? 9 : 11, bold: true, color: colors.ink })
      );
      if (column === columns - 1 || index === items.length - 1) this.y += height + 18;
    });
  }

  insightBox(title: string, body: string, status: ReportStatus) {
    const lines = wrapText(body, 82);
    const height = 34 + lines.length * 11;
    this.ensure(height + 10);
    this.rect(42, this.y, 511, height, colors.surface, colors.line);
    this.rect(42, this.y, 5, height, statusColor(status));
    this.text(title, 60, this.y + 19, { size: 10.5, bold: true, color: colors.ink });
    lines.forEach((line, index) => this.text(line, 60, this.y + 35 + index * 11, { size: 8, color: colors.secondary }));
    this.y += height + 10;
  }

  metricTable(title: string, rows: Array<[string, string, ReportStatus]>) {
    this.ensure(44 + rows.length * 24);
    this.text(title, 42, this.y, { size: 13, bold: true, color: colors.ink });
    this.y += 18;
    this.rect(42, this.y, 511, 24, colors.muted);
    this.text("Rasio", 56, this.y + 16, { size: 8, bold: true, color: colors.secondary });
    this.text("Nilai", 300, this.y + 16, { size: 8, bold: true, color: colors.secondary });
    this.text("Status", 430, this.y + 16, { size: 8, bold: true, color: colors.secondary });
    this.y += 24;
    rows.forEach(([label, value, status]) => {
      this.rect(42, this.y, 511, 24, colors.surface, colors.line);
      this.text(label, 56, this.y + 16, { size: 9, color: colors.ink });
      this.text(value, 300, this.y + 16, { size: 9, bold: true, color: colors.ink });
      this.statusBadge(status, 430, this.y + 6);
      this.y += 24;
    });
    this.y += 18;
  }

  ratioComparisonTable(rows: Array<[string, string, string, ReportStatus, string]>) {
    const widths = [128, 78, 78, 78, 149];
    const renderedRows = rows.map((row) => ({
      row,
      meaningLines: wrapText(row[4], 28),
      ratioLines: wrapText(row[0], 24)
    }));
    this.ensure(46 + renderedRows.reduce((total, item) => total + Math.max(30, Math.max(item.meaningLines.length, item.ratioLines.length) * 11 + 16), 0));
    this.text("Tabel Perbandingan Rasio", 42, this.y, { size: 13, bold: true, color: colors.ink });
    this.y += 18;
    let x = 42;
    this.rect(42, this.y, 511, 26, colors.ink);
    ["Rasio", "Aktual", "Guardrail", "Status", "Makna"].forEach((header, index) => {
      this.text(header, x + 8, this.y + 17, { size: 7.5, bold: true, color: "#FFFFFF" });
      x += widths[index];
    });
    this.y += 26;
    renderedRows.forEach(({ row, meaningLines, ratioLines }) => {
      const rowHeight = Math.max(30, Math.max(meaningLines.length, ratioLines.length) * 11 + 16);
      this.ensure(rowHeight + 18);
      x = 42;
      this.rect(42, this.y, 511, rowHeight, colors.surface, colors.line);
      row.slice(0, 3).forEach((cell, index) => {
        const lines = index === 0 ? ratioLines : wrapText(String(cell), 13);
        lines.slice(0, 2).forEach((line, lineIndex) => this.text(line, x + 8, this.y + 16 + lineIndex * 10, { size: 8, color: colors.ink, bold: index === 1 }));
        x += widths[index];
      });
      this.statusBadge(row[3], x + 8, this.y + 6);
      x += widths[3];
      meaningLines.slice(0, 3).forEach((line, lineIndex) => this.text(line, x + 8, this.y + 16 + lineIndex * 10, { size: 7.5, color: colors.secondary }));
      this.y += rowHeight;
    });
    this.y += 18;
  }

  table(headers: string[], rows: string[][], emptyText: string) {
    if (rows.length === 0) {
      this.card("Tabel", emptyText, "warning");
      return;
    }
    const colWidths = tableColumnWidths(headers);
    const renderedRows = rows.map((row) =>
      row.map((cell, index) => wrapText(cell, Math.max(10, Math.floor((colWidths[index] ?? 80) / 4.8))))
    );
    this.ensure(42 + renderedRows.reduce((total, row) => total + Math.max(34, Math.max(...row.map((cell) => Math.min(cell.length, 12))) * 10 + 18), 0));
    this.rect(42, this.y, 511, 26, colors.ink);
    let headerX = 52;
    headers.forEach((header, index) => {
      const colWidth = colWidths[index] ?? 80;
      this.text(wrapOneLine(header, Math.max(10, Math.floor(colWidth / 5.2))), headerX, this.y + 17, { size: 8, bold: true, color: "#FFFFFF" });
      headerX += colWidth;
    });
    this.y += 26;
    renderedRows.forEach((row) => {
      const rowHeight = Math.max(34, Math.max(...row.map((cell) => Math.min(cell.length, 12))) * 10 + 18);
      this.ensure(rowHeight + 18);
      this.rect(42, this.y, 511, rowHeight, colors.surface, colors.line);
      let cellX = 52;
      row.forEach((cellLines, index) => {
        const maxLines = headers[index] === "Penjelasan" ? 12 : 7;
        cellLines.slice(0, maxLines).forEach((line, lineIndex) => this.text(line, cellX, this.y + 16 + lineIndex * 10, { size: 7.5, color: colors.ink }));
        cellX += colWidths[index] ?? 80;
      });
      this.y += rowHeight;
    });
    this.y += 18;
  }

  chartCard(title: string, subtitle: string, draw: () => void, height: number) {
    this.ensure(height + 30);
    this.rect(42, this.y, 511, height, colors.surface, colors.line);
    this.text(title, 60, this.y + 24, { size: 13, bold: true, color: colors.ink });
    const startY = this.y;
    const subtitleLines = wrapText(subtitle, 86).slice(0, 2);
    subtitleLines.forEach((line, index) => this.text(line, 60, startY + 40 + index * 10, { size: 8, color: colors.secondary }));
    this.y = startY + Math.max(0, subtitleLines.length - 1) * 10;
    draw();
    this.y = startY;
    this.y = startY + height + 18;
  }

  miniBars(rows: Array<[string, number, number, string]>) {
    this.chartCard("Visual Rasio Utama", "Progress bar dibaca terhadap ambang guardrail masing-masing.", () => {
      rows.forEach(([label, value, max, color], index) => {
        const y = this.y + 62 + index * 24;
        this.text(label, 70, y + 8, { size: 8.5, color: colors.secondary });
        this.progress(190, y, 250, 9, value, max, color);
        this.text(`${Number(value).toLocaleString("id-ID")} / ${max}`, 455, y + 8, { size: 8, color: colors.secondary });
      });
    }, 166);
  }

  trendBars(title: string, rows: Array<{ label: string; income: number; expense: number; cashflow: number }>) {
    this.chartCard(title, "Perbandingan pemasukan, pengeluaran, dan cashflow bulanan.", () => {
      if (rows.length === 0) {
        this.text("Belum ada tren transaksi yang cukup.", 70, this.y + 70, { size: 10, color: colors.secondary });
        return;
      }
      const maxValue = Math.max(...rows.flatMap((row) => [row.income, row.expense, Math.abs(row.cashflow)]), 1);
      const colWidth = 420 / rows.length;
      rows.forEach((row, index) => {
        const x = 78 + index * colWidth;
        const incomeHeight = Math.max(2, (row.income / maxValue) * 58);
        const expenseHeight = Math.max(2, (row.expense / maxValue) * 58);
        const cashflowColor = row.cashflow >= 0 ? colors.success : colors.danger;
        this.rect(x, this.y + 96 - incomeHeight, 12, incomeHeight, colors.success);
        this.rect(x + 15, this.y + 96 - expenseHeight, 12, expenseHeight, colors.warning);
        this.rect(x + 30, this.y + 92, 12, 4, cashflowColor);
        this.text(row.label, x - 2, this.y + 116, { size: 7, color: colors.secondary });
      });
      this.rect(72, this.y + 128, 8, 8, colors.success);
      this.text("Pemasukan", 86, this.y + 136, { size: 7.5, color: colors.secondary });
      this.rect(142, this.y + 128, 8, 8, colors.warning);
      this.text("Pengeluaran", 156, this.y + 136, { size: 7.5, color: colors.secondary });
      this.rect(242, this.y + 128, 8, 8, colors.danger);
      this.text("Cashflow negatif", 256, this.y + 136, { size: 7.5, color: colors.secondary });
    }, 158);
  }

  donutLegendChart(title: string, subtitle: string, rows: Array<{ label: string; value: number; percent: number }>) {
    this.chartCard(title, subtitle, () => {
      if (rows.length === 0) {
        this.text("Belum ada data yang dapat divisualisasikan.", 70, this.y + 70, { size: 10, color: colors.secondary });
        return;
      }
      const palette = [colors.success, colors.sky, colors.warning, "#8A6FB8", colors.sage];
      const top = rows[0];
      this.donut(132, this.y + 88, 38, top.percent, palette[0]);
      this.text(`${top.percent}%`, 121, this.y + 92, { size: 15, bold: true, color: colors.ink });
      rows.slice(0, 5).forEach((row, index) => {
        const y = this.y + 62 + index * 22;
        this.rect(270, y - 8, 9, 9, palette[index % palette.length]);
        this.text(wrapOneLine(row.label.replace(/_/g, " "), 24), 288, y, { size: 8.5, color: colors.ink });
        this.progress(410, y - 8, 82, 8, row.percent, 100, palette[index % palette.length]);
        this.text(`${row.percent}%`, 504, y, { size: 8, color: colors.secondary });
      });
    }, 178);
  }

  goalProgressChart(model: ReturnType<typeof buildReportModel>) {
    this.chartCard("Progress Tujuan", "Progress agregat dan tiga tujuan teratas.", () => {
      this.progress(70, this.y + 56, 420, 14, model.goalProgressPercent, 100, colors.success);
      this.text(`${model.goalProgressPercent}%`, 502, this.y + 67, { size: 12, bold: true, color: colors.ink });
      model.goalRows.slice(0, 3).forEach(({ goal }, index) => {
        const percent = goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0;
        const rowY = this.y + 86 + index * 22;
        this.text(wrapOneLine(goal.name, 22), 70, rowY + 8, { size: 8, color: colors.secondary });
        this.progress(210, rowY, 250, 8, percent, 100, percent >= 70 ? colors.success : percent >= 30 ? colors.warning : colors.danger);
        this.text(`${percent}%`, 475, rowY + 8, { size: 8, color: colors.ink });
      });
    }, 165);
  }

  assetAllocationChart(rows: Array<{ label: string; value: number; percent: number }>) {
    this.chartCard("Alokasi Aset", "Komposisi aset berdasarkan data akun dan aset manual.", () => {
      if (rows.length === 0) {
        this.text("Belum ada data alokasi aset.", 70, this.y + 70, { size: 10, color: colors.secondary });
        return;
      }
      let offset = 0;
      const palette = [colors.success, colors.sky, colors.warning, "#9B8EDB", "#8A9A5B"];
      rows.slice(0, 5).forEach((row, index) => {
        const width = Math.max(8, (row.percent / 100) * 420);
        this.rect(70 + offset, this.y + 58, width, 18, palette[index % palette.length]);
        offset += width;
      });
      rows.slice(0, 5).forEach((row, index) => {
        const y = this.y + 96 + index * 18;
        this.rect(70, y - 8, 8, 8, palette[index % palette.length]);
        this.text(`${row.label.replace(/_/g, " ")} - ${row.percent}% (${money(row.value)})`, 88, y, { size: 8, color: colors.ink });
      });
    }, 178);
  }

  insightBoxes(model: ReturnType<typeof buildReportModel>) {
    const rows = model.insights.filter((insight) => insight.severity !== "positive").slice(0, 3);
    if (rows.length === 0) {
      this.card("Indikator Positif", "Tidak ada sinyal risiko besar dari rule engine pada data saat ini.", "healthy");
      return;
    }
    rows.forEach((insight) => this.card(insight.title, insight.body, insight.severity === "critical" ? "critical" : "warning"));
  }

  card(title: string, body: string, status: string) {
    const lines = wrapText(body, 86);
    const titleLines = wrapText(title, 58);
    const height = 36 + titleLines.length * 12 + lines.length * 12;
    this.ensure(height + 14);
    this.rect(42, this.y, 511, height, colors.surface, colors.line);
    this.rect(42, this.y, 5, height, statusColor(status as ReportStatus));
    titleLines.slice(0, 2).forEach((line, index) => this.text(line, 60, this.y + 22 + index * 12, { size: 12, bold: true, color: colors.ink }));
    this.statusBadge(status as ReportStatus, 465, this.y + 10);
    const bodyStart = this.y + 30 + Math.min(titleLines.length, 2) * 12;
    lines.forEach((line, index) => this.text(line, 60, bodyStart + index * 12, { size: 8.5, color: colors.secondary }));
    this.y += height + 14;
  }

  priorityCard(index: number, text: string) {
    const status: ReportStatus = text.startsWith("KRITIS") ? "critical" : text.startsWith("TINGGI") ? "warning" : "healthy";
    const lines = wrapText(text, 82);
    const height = 34 + lines.length * 12;
    this.ensure(height + 12);
    this.rect(42, this.y, 511, height, colors.surface, colors.line);
    this.circle(64, this.y + 22, 10, statusColor(status));
    this.text(String(index), 60.5, this.y + 26, { size: 9, bold: true, color: "#FFFFFF" });
    lines.forEach((line, lineIndex) => this.text(line, 86, this.y + 20 + lineIndex * 12, { size: 8.5, color: colors.ink }));
    this.y += height + 12;
  }

  checklist(index: number, text: string) {
    const lines = wrapText(text, 78);
    const height = Math.max(28, lines.length * 11 + 12);
    this.ensure(height + 6);
    this.rect(48, this.y + 2, 12, 12, colors.muted, colors.line);
    this.text(`${index}.`, 70, this.y + 13, { size: 9, bold: true, color: colors.sage });
    lines.forEach((line, lineIndex) => this.text(line, 90, this.y + 13 + lineIndex * 11, { size: 8.5, color: colors.ink }));
    this.y += height;
  }

  disclaimer() {
    const disclaimerText =
      "Laporan ini adalah alat bantu edukasi dan review mandiri berdasarkan data yang tersimpan di perangkat Anda. Dokumen ini bukan nasihat keuangan berlisensi, bukan rekomendasi produk, dan tidak menggantikan peran pengelola keuangan atau penasihat keuangan profesional yang dapat menilai kondisi lengkap, toleransi risiko, pajak, hukum, keluarga, dan kebutuhan proteksi Anda.";
    const lines = wrapText(disclaimerText, 88);
    const height = 42 + lines.length * 11;
    this.ensure(height + 16);
    this.rect(42, this.y, 511, height, colors.muted, colors.line);
    this.text("Disclaimer", 60, this.y + 22, { size: 11, bold: true, color: colors.ink });
    lines.forEach((line, index) => this.text(line, 60, this.y + 40 + index * 11, { size: 8, color: colors.secondary }));
    this.y += height + 16;
  }

  appendix(model: ReturnType<typeof buildReportModel>) {
    this.chapter("LAMPIRAN", "Metodologi & Disclaimer", "Lampiran metodologi ringkas, sumber data, dan batasan penggunaan laporan.");
    this.ratioComparisonTable([
      ["Health score", `${model.healthScore}/100`, ">= 70", model.healthStatus as ReportStatus, "Skor komposit"],
      ["Rasio menabung", `${model.analytics.savingsRate}%`, ">= 20%", ratioStatus(model.analytics.savingsRate, 20, 10, false), "Surplus bulanan"],
      ["Debt", `${model.analytics.debtRatio}%`, "<= 30%", ratioStatus(model.analytics.debtRatio, 30, 50, true), "Tekanan utang"],
      ["Dana darurat", `${model.emergencySource.monthsCoverage} bln`, "3-6 bln", ratioStatus(model.emergencySource.monthsCoverage, 6, 3, false), "Likuiditas"]
    ]);
    this.insightBox("Metodologi", "Perhitungan memakai data lokal: akun, transaksi, aset, liabilitas, budget, tujuan, recurring rules, dan profil perencanaan. Analisis bersifat rule-based dan dirancang sebagai bahan edukasi serta review mandiri.", "healthy");
    this.educationGuide();
    this.disclaimer();
  }

  educationGuide() {
    this.chapter("LAMPIRAN", "Panduan Edukasi Dasar", "Prinsip umum pengelolaan keuangan pribadi yang tidak bergantung pada data pengguna.");
    this.proseSection(
      "Cara memakai panduan ini",
      "Bagian ini berisi guardrail umum untuk membaca kesehatan keuangan pribadi. Angkanya bukan hukum mutlak, tetapi patokan awal agar keputusan sehari-hari punya urutan: menjaga cashflow, membangun likuiditas, mengendalikan utang, melindungi risiko besar, lalu menumbuhkan aset sesuai tujuan."
    );
    [
      [
        "Rasio menabung ideal",
        "Target awal yang sehat adalah menyisihkan minimal 10% dari pemasukan, lalu naik bertahap menuju 20% atau lebih. Bila rasio masih negatif atau di bawah 10%, fokus utamanya bukan investasi agresif, tetapi mencari ruang cashflow dari biaya fleksibel, langganan, dan komitmen yang bisa dinegosiasikan."
      ],
      [
        "Expense-to-income",
        "Pengeluaran bulanan sebaiknya berada di bawah 70% pemasukan agar masih ada ruang untuk dana darurat, utang, proteksi, dan tujuan. Bila mendekati 85%, kondisi biasanya mulai rapuh: satu pengeluaran mendadak dapat mengganggu cicilan, tabungan, atau kebutuhan wajib."
      ],
      [
        "Debt ratio dan cicilan",
        "Debt ratio pribadi lebih nyaman bila berada di bawah 30% aset. Selain itu, total cicilan bulanan idealnya tidak menekan kebutuhan pokok. Utang konsumtif berbunga tinggi biasanya diprioritaskan lebih dulu daripada investasi karena bunganya sering lebih mahal daripada return yang realistis."
      ],
      [
        "Dana darurat",
        "Dana darurat minimum adalah tiga bulan pengeluaran wajib. Enam bulan lebih aman untuk pekerja lepas, pemasukan tidak stabil, keluarga dengan tanggungan, atau orang dengan risiko pekerjaan tinggi. Simpan dana ini di instrumen likuid dan rendah risiko, bukan di aset yang sulit dicairkan."
      ],
      [
        "Proteksi dasar",
        "Proteksi bukan selalu membeli produk baru. Mulailah dari memetakan risiko terbesar: kesehatan, kehilangan pendapatan, kewajiban utang, dan keluarga yang bergantung pada pemasukan. Jika ada tanggungan, proteksi jiwa dan kesehatan perlu direview sebelum menambah komitmen jangka panjang."
      ],
      [
        "Tujuan keuangan",
        "Tujuan yang baik punya nama, nominal target, tenggat, kontribusi bulanan, dan prioritas. Urutkan dari fondasi ke aspirasi: dana darurat, kewajiban keluarga, pendidikan atau rumah yang dekat waktunya, pensiun, lalu tujuan gaya hidup. Target tanpa deadline tetap boleh, tetapi evaluasinya lebih cocok sebagai arah, bukan janji pasti."
      ],
      [
        "Investasi dan growth",
        "Investasi sebaiknya dimulai setelah cashflow positif, dana darurat awal terbentuk, dan utang mahal terkendali. Cocokkan risiko dengan horizon: kebutuhan di bawah tiga tahun sebaiknya lebih konservatif, sedangkan tujuan panjang bisa memakai aset growth secara bertahap dan terdiversifikasi."
      ],
      [
        "Review berkala",
        "Lakukan review bulanan untuk cashflow dan budget, review kuartalan untuk goal dan utang, serta review tahunan untuk proteksi, aset, dan target besar. Perencanaan keuangan yang baik bukan sekali jadi; ia mengikuti perubahan pendapatan, keluarga, pekerjaan, dan prioritas hidup."
      ]
    ].forEach(([title, body]) => this.insightBox(title, body, "healthy"));
  }

  statusBadge(status: ReportStatus, x: number, y: number) {
    const label = status === "healthy" ? "SEHAT" : status === "warning" ? "PERHATIAN" : "KRITIS";
    this.rect(x, y, 58, 16, statusColor(status));
    this.text(label, x + 7, y + 11, { size: 6.5, bold: true, color: "#FFFFFF" });
  }

  donut(cx: number, cy: number, radius: number, value: number, color: string) {
    this.circle(cx, cy, radius, colors.muted);
    this.circle(cx, cy, radius * 0.72, colors.surface);
    this.progress(cx - radius, cy + radius + 12, radius * 2, 8, value, 100, color);
  }

  progress(x: number, y: number, width: number, height: number, value: number, max: number, color: string) {
    const pct = max > 0 ? Math.max(0, Math.min(value / max, 1)) : 0;
    this.rect(x, y, width, height, colors.muted);
    this.rect(x, y, width * pct, height, color);
  }

  text(value: string, x: number, y: number, options: { size?: number; bold?: boolean; color?: string } = {}) {
    const font = options.bold ? "F2" : "F1";
    this.commands().push(`BT /${font} ${options.size ?? 10} Tf ${rgb(options.color ?? colors.ink)} rg ${x.toFixed(2)} ${(842 - y).toFixed(2)} Td (${escapePdfText(toPdfSafeText(value))}) Tj ET`);
  }

  centerText(value: string, y: number, options: { size?: number; bold?: boolean; color?: string } = {}) {
    const size = options.size ?? 10;
    const estimatedWidth = toPdfSafeText(value).length * size * 0.55;
    this.text(value, Math.max(42, (595 - estimatedWidth) / 2), y, options);
  }

  rect(x: number, y: number, width: number, height: number, fill: string, stroke?: string) {
    const cmd = `${rgb(fill)} rg ${stroke ? `${rgb(stroke)} RG` : ""} ${x.toFixed(2)} ${(842 - y - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${stroke ? "B" : "f"}`;
    this.commands().push(cmd);
  }

  circle(cx: number, cy: number, r: number, fill: string) {
    const k = 0.5522847498;
    const y = 842 - cy;
    this.commands().push(`${rgb(fill)} rg ${cx} ${y + r} m ${cx + k * r} ${y + r} ${cx + r} ${y + k * r} ${cx + r} ${y} c ${cx + r} ${y - k * r} ${cx + k * r} ${y - r} ${cx} ${y - r} c ${cx - k * r} ${y - r} ${cx - r} ${y - k * r} ${cx - r} ${y} c ${cx - r} ${y + k * r} ${cx - k * r} ${y + r} ${cx} ${y + r} c f`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string) {
    this.commands().push(`${rgb(color)} RG 1 w ${x1} ${842 - y1} m ${x2} ${842 - y2} l S`);
  }

  newPage() {
    if (this.pages[this.pages.length - 1].length === 0) {
      this.y = 54;
      return;
    }
    this.pages.push([]);
    this.y = 54;
  }

  ensure(height: number) {
    if (this.y + height <= 800) return;
    this.pages.push([]);
    this.rect(0, 0, 595, 842, colors.canvas);
    this.y = 54;
  }

  output() {
    const objects: string[] = [];
    const pageObjectIds: number[] = [];
    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    objects.push("<< /Type /Pages /Kids [] /Count 0 >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    this.pages.forEach((commands, pageIndex) => {
      const content = this.decoratePage(commands, pageIndex, this.pages.length).join("\n");
      const pageObjectId = objects.length + 1;
      const contentObjectId = objects.length + 2;
      pageObjectIds.push(pageObjectId);
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>`);
      objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });
    objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;
    return buildPdfObjects(objects);
  }

  private commands() {
    return this.pages[this.pages.length - 1];
  }

  private decoratePage(commands: string[], pageIndex: number, totalPages: number) {
    if (pageIndex === 0) return commands;
    const pageNumber = pageIndex + 1;
    return [
      pdfTextCommand("DANAPETA", 42, 28, { size: 8, bold: true, color: colors.sage }),
      pdfTextCommand("Peta Finansialmu", 96, 28, { size: 7.5, color: colors.secondary }),
      ...commands,
      pdfLineCommand(42, 808, 553, 808, colors.line),
      pdfTextCommand(`Halaman ${pageNumber} dari ${totalPages}`, 478, 827, { size: 7.5, color: colors.secondary })
    ];
  }
}

function resolveReportEmergencySource(goals: PlannerBackup["tables"]["goals"], liquidAssets: number, monthlyBurnRate: number) {
  const emergencyGoal = goals
    .filter((goal) => !goal.deletedAt && goal.status !== "archived")
    .filter((goal) => goal.type === "emergency_fund" || /dana darurat|emergency/i.test(goal.name))
    .sort((left, right) => right.currentAmount - left.currentAmount)[0];
  const amount = emergencyGoal ? Math.max(emergencyGoal.currentAmount, 0) : Math.max(liquidAssets, 0);
  const monthsCoverage = monthlyBurnRate <= 0 ? (amount > 0 ? 6 : 0) : Number((amount / monthlyBurnRate).toFixed(1));
  return emergencyGoal
    ? { label: `goal ${emergencyGoal.name}`, amount, monthsCoverage, formula: "progress goal Dana Darurat / monthly burn rate" }
    : { label: "liquid assets", amount, monthsCoverage, formula: "liquid assets / monthly burn rate" };
}

function buildSimplePdf(lines: string[]) {
  const pages = paginateLines(lines.flatMap((line) => wrapLine(toPdfSafeText(line), 92)), 44);
  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [] /Count 0 >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pages.forEach((pageLines) => {
    const content = pageToContent(pageLines);
    const contentObjectId = objects.length + 2;
    const pageObjectId = objects.length + 1;
    pageObjectIds.push(pageObjectId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function pageToContent(lines: string[]) {
  const commands = ["BT", "/F1 10 Tf", "50 795 Td"];
  lines.forEach((line, index) => {
    if (index > 0) commands.push("0 -16 Td");
    commands.push(`(${escapePdfText(line)}) Tj`);
  });
  commands.push("ET");
  return commands.join("\n");
}

function paginateLines(lines: string[], pageSize: number) {
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += pageSize) {
    pages.push(lines.slice(index, index + pageSize));
  }
  return pages.length ? pages : [["DANAPETA report"]];
}

function wrapLine(line: string, maxLength: number) {
  if (line.length <= maxLength) return [line];
  const words = line.split(" ");
  const rows: string[] = [];
  let current = "";
  words.forEach((word) => {
    if (`${current} ${word}`.trim().length > maxLength) {
      rows.push(current);
      current = word;
      return;
    }
    current = `${current} ${word}`.trim();
  });
  if (current) rows.push(current);
  return rows;
}

function toPdfSafeText(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
