import type { InsightCategory } from "./insightEngine";

export type PlanningSeverity = "info" | "positive" | "warning" | "critical";

export type PlanningRuleDefinition = {
  id: string;
  title: string;
  category: InsightCategory;
  description: string;
  threshold: string;
  severity: PlanningSeverity;
  formula: string;
  recommendation: string;
  dataSources: string[];
};

const planningRuleDefinitions = [
  {
    id: "financial-health-score",
    title: "Financial health score",
    category: "financial stability",
    description: "Ringkasan kualitas fondasi keuangan dari beberapa sinyal lokal.",
    threshold: "0-49 high risk, 50-64 needs attention, 65-79 stable, 80+ strong",
    severity: "info",
    formula: "(cashflow 25 + savings 20 + budget 15 + debt 20 + emergency 10 + stability 10) / 100 x 100",
    recommendation: "Perbaiki komponen dengan poin terendah terlebih dahulu."
  },
  {
    id: "cashflow-run-rate",
    title: "Cashflow run-rate",
    category: "future cashflow prediction",
    description: "Memproyeksikan akhir bulan dari ritme pengeluaran berjalan.",
    threshold: "Muncul saat proyeksi cashflow akhir bulan di bawah nol.",
    severity: "warning",
    formula: "(expense berjalan / hari berjalan x hari bulan ini) + recurring - income",
    recommendation: "Tahan pengeluaran fleksibel atau revisi budget sampai cashflow kembali positif."
  },
  {
    id: "savings-rate-strong",
    title: "Savings rate kuat",
    category: "positive achievements",
    description: "Menandai bulan saat sisa pemasukan berada di atas patokan menabung sehat.",
    threshold: "Savings rate >= 20%",
    severity: "positive",
    formula: "(income - expense) / income x 100",
    recommendation: "Pertahankan ritme ini dan alokasikan surplus ke tujuan prioritas."
  },
  {
    id: "savings-rate-low",
    title: "Savings rate rendah",
    category: "savings health",
    description: "Membaca apakah pemasukan bulan ini masih menyisakan ruang menabung.",
    threshold: "Savings rate < 10%",
    severity: "warning",
    formula: "(income - expense) / income x 100",
    recommendation: "Cari satu kategori fleksibel yang bisa dipangkas tanpa mengganggu kewajiban."
  },
  {
    id: "budget-risk",
    title: "Budget risk",
    category: "budgeting quality",
    description: "Mendeteksi budget yang sering mendekati atau melewati batas.",
    threshold: "Budget used >= 80%",
    severity: "warning",
    formula: "spent / effective budget limit x 100",
    recommendation: "Cek transaksi di kategori ini dan ubah batas jika kebutuhan memang berubah."
  },
  {
    id: "category-spike",
    title: "Category spending spike",
    category: "spending anomaly",
    description: "Menandai kenaikan kategori yang cukup besar dari bulan sebelumnya.",
    threshold: "Bulan lalu >= Rp100.000 dan bulan ini >= 135% dari bulan lalu.",
    severity: "warning",
    formula: "current category spend / previous category spend x 100",
    recommendation: "Pastikan kenaikan ini direncanakan, bukan kebiasaan baru yang tidak sengaja."
  },
  {
    id: "emergency-runway-ready",
    title: "Emergency fund ready",
    category: "positive achievements",
    description: "Mengukur berapa bulan pengeluaran yang bisa ditutup aset likuid.",
    threshold: "Coverage memenuhi minimum berbasis status keluarga: lajang 3-6 bulan, menikah 6-9 bulan, menikah dengan anak/tanggungan 9-12 bulan",
    severity: "positive",
    formula: "max(liquid assets, emergency fund) / average monthly expense",
    recommendation: "Pertahankan coverage sesuai status keluarga sebelum mengejar risiko yang lebih tinggi."
  },
  {
    id: "emergency-runway-low",
    title: "Emergency fund low",
    category: "emergency fund readiness",
    description: "Mengukur berapa bulan pengeluaran yang bisa ditutup aset likuid.",
    threshold: "Coverage di bawah minimum berbasis status keluarga",
    severity: "warning",
    formula: "max(liquid assets, emergency fund) / average monthly expense",
    recommendation: "Bangun dana darurat bertahap sampai minimum status keluarga, lalu naikkan menuju angka ideal."
  },
  {
    id: "recurring-load",
    title: "Recurring spending load",
    category: "recurring expense analysis",
    description: "Membaca porsi komitmen rutin terhadap pemasukan bulan ini.",
    threshold: "Recurring commitments >= 30% income",
    severity: "warning",
    formula: "monthly recurring total / income x 100",
    recommendation: "Review langganan dan komitmen tetap yang tidak lagi bernilai tinggi."
  },
  {
    id: "debt-ratio",
    title: "Debt ratio",
    category: "debt health",
    description: "Membandingkan total kewajiban dengan total aset.",
    threshold: "Debt ratio >= 30%",
    severity: "warning",
    formula: "total liabilities / total assets x 100",
    recommendation: "Prioritaskan utang berbunga tinggi dan pantau progres pelunasan."
  },
  {
    id: "subscription-candidate",
    title: "Subscription candidate",
    category: "subscription detection",
    description: "Mencari merchant expense yang berulang beberapa kali.",
    threshold: "Merchant muncul minimal 3 kali.",
    severity: "info",
    formula: "count expense transactions grouped by merchant",
    recommendation: "Ubah menjadi recurring rule jika memang tagihan rutin."
  },
  {
    id: "cashflow-surplus",
    title: "Unallocated cashflow surplus",
    category: "planning suggestions",
    description: "Mencari sisa cashflow yang belum diarahkan ke tujuan aktif.",
    threshold: "Cashflow positif dan kontribusi tujuan kurang dari 50% surplus.",
    severity: "info",
    formula: "income - expense - recurring commitments - planned goal contributions",
    recommendation: "Arahkan sebagian surplus ke dana darurat, utang, atau tujuan terdekat."
  },
  {
    id: "income-volatility",
    title: "Income volatility",
    category: "income dependency",
    description: "Membaca perubahan pemasukan bulan ini terhadap bulan lalu.",
    threshold: "Perubahan income >= 30%",
    severity: "warning",
    formula: "(income this month - income last month) / income last month x 100",
    recommendation: "Gunakan rata-rata pemasukan konservatif untuk budget bulan berikutnya."
  },
  {
    id: "goal-contribution-low",
    title: "Goal contribution gap",
    category: "recommendations",
    description: "Mendeteksi tujuan yang kontribusi bulanannya belum mengejar target waktu.",
    threshold: "Monthly contribution < 75% kontribusi yang dibutuhkan.",
    severity: "warning",
    formula: "monthly contribution / required monthly contribution x 100",
    recommendation: "Naikkan kontribusi, geser target date, atau turunkan target agar realistis."
  },
  {
    id: "retirement-readiness",
    title: "Retirement readiness",
    category: "retirement readiness",
    description: "Membandingkan target pensiun, usia, kontribusi bulanan, dan proyeksi future value.",
    threshold: "Muncul saat retirement goal belum on track atau sudah selaras.",
    severity: "warning",
    formula: "projected FV versus retirement target; horizon = target retirement age - current age",
    recommendation: "Naikkan kontribusi, revisi target, atau sesuaikan usia pensiun agar rencana realistis."
  },
  {
    id: "house-affordability",
    title: "House affordability",
    category: "house affordability",
    description: "Menguji apakah kontribusi target rumah realistis terhadap income dan target date.",
    threshold: "Muncul saat kontribusi rumah > 30% income atau proyeksi belum on track.",
    severity: "warning",
    formula: "monthly house contribution / income x 100 plus goal funding gap",
    recommendation: "Jaga kontribusi rumah pada level yang tidak menekan kebutuhan pokok dan dana darurat."
  },
  {
    id: "education-funding",
    title: "Education funding readiness",
    category: "education funding readiness",
    description: "Membaca kesiapan tujuan pendidikan terhadap tenggat dan kontribusi bulanan.",
    threshold: "Muncul saat education goal belum on track.",
    severity: "warning",
    formula: "projected FV versus education target amount",
    recommendation: "Tambahkan kontribusi lebih awal atau revisi target supaya gap tidak menumpuk mendekati tenggat."
  }
] satisfies Array<Omit<PlanningRuleDefinition, "dataSources">>;

export const planningRuleRegistry: PlanningRuleDefinition[] = planningRuleDefinitions.map((rule) => ({
  ...rule,
  dataSources: inferDataSources(rule.category)
}));

export function findPlanningRuleDefinition(ruleId: string) {
  return planningRuleRegistry.find((rule) => rule.id === ruleId) ?? planningRuleRegistry.find((rule) => ruleId.startsWith(`${rule.id}-`));
}

function inferDataSources(category: InsightCategory) {
  const common = ["transactions", "accounts"];
  if (category.includes("budget")) return [...common, "budgets", "categories"];
  if (category.includes("emergency") || category.includes("debt") || category.includes("stability")) return [...common, "assets", "liabilities", "goals"];
  if (category.includes("recurring")) return [...common, "recurring rules"];
  if (category.includes("spending") || category.includes("subscription")) return [...common, "categories"];
  if (category.includes("recommendations")) return [...common, "goals"];
  if (category.includes("retirement")) return [...common, "goals", "planning profile"];
  if (category.includes("house") || category.includes("education")) return [...common, "goals", "planning profile"];
  return common;
}
