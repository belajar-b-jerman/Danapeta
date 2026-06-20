import { AlertTriangle, CheckCircle2, Info, Pin, RefreshCw, ShieldCheck, Sparkles, UserRoundCog, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/AppState";
import { Field, FormActions, Input, Select } from "../../components/ui/Form";
import { HelpModalButton } from "../../components/finance/HelpModal";
import { Modal } from "../../components/ui/Modal";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { useRouter } from "../../app/router";
import { LockedFeature } from "../../components/finance/FeatureGate";
import { generateInsightFeed, getInsightCategory, listInsights, updateInsightStatus } from "../../db/repositories/insightRepository";
import { getPlanningProfile, savePlanningProfile } from "../../db/repositories/planningProfileRepository";
import type { Insight, PlanningProfile } from "../../db/schema";
import { canUseFeature } from "../../lib/commercialTiers";
import { toPeriodKey } from "../../lib/dashboardAnalytics";
import { formatCurrency } from "../../lib/money";
import { useAppStore } from "../../stores/appStore";

const categoryOptions = [
  { label: "All", value: "all" },
  { label: "Warnings", value: "financial warnings" },
  { label: "Cashflow", value: "cashflow health" },
  { label: "Savings", value: "savings health" },
  { label: "Budget", value: "budgeting quality" },
  { label: "Planning", value: "planning suggestions" }
] as const;

const severityStyles: Record<Insight["severity"], string> = {
  positive: "bg-mint/30 text-ink",
  info: "bg-sky/25 text-ink",
  warning: "bg-peach/30 text-ink",
  critical: "bg-danger/15 text-ink"
};

export function InsightsPage() {
  const activePeriod = useAppStore((state) => state.activePeriod);
  const { navigate } = useRouter();
  const commercialTier = useAppStore((state) => state.commercialTier);
  const period = useMemo(() => toPeriodKey(activePeriod), [activePeriod]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<(typeof categoryOptions)[number]["value"]>("all");
  const [planningProfile, setPlanningProfile] = useState<PlanningProfile | undefined>();
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void refreshInsights();
  }, [period]);

  useEffect(() => {
    void getPlanningProfile().then(setPlanningProfile);
  }, []);

  async function refreshInsights() {
    setLoading(true);
    setErrorMessage("");
    try {
      const nextInsights = await generateInsightFeed(period);
      setInsights(nextInsights);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to generate insights.");
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(insight: Insight, status: Insight["status"]) {
    await updateInsightStatus(insight.id, status);
    setInsights(await listInsights(period));
  }

  async function handleProfileSubmit(values: PlanningProfile) {
    setPlanningProfile(await savePlanningProfile(values));
    setProfileOpen(false);
    await refreshInsights();
  }

  const filteredInsights = useMemo(() => {
    if (categoryFilter === "all") return insights;
    if (categoryFilter === "financial warnings") {
      return insights.filter((insight) => insight.severity === "warning" || insight.severity === "critical");
    }
    if (categoryFilter === "planning suggestions") {
      return insights.filter((insight) => ["planning suggestions", "retirement readiness", "house affordability", "education funding readiness"].includes(getInsightCategory(insight)));
    }
    return insights.filter((insight) => getInsightCategory(insight) === categoryFilter);
  }, [categoryFilter, insights]);

  const healthScore = Number(insights.find((insight) => insight.ruleId === "financial-health-score")?.evidence.find((item) => item.label === "Health score")?.value ?? 0);
  const healthInsight = insights.find((insight) => insight.ruleId === "financial-health-score");
  const warningCount = insights.filter((insight) => insight.severity === "warning" || insight.severity === "critical").length;
  const positiveCount = insights.filter((insight) => insight.severity === "positive").length;
  const canUseInsights = canUseFeature(commercialTier, "smart_insights");
  const canUseAdvancedScoring = canUseFeature(commercialTier, "advanced_financial_scoring");

  if (!canUseInsights) {
    return (
      <>
        <section>
          <p className="text-sm font-semibold text-sage">Mesin analisis lokal</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">Insight Feed</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
            Insight pintar tersedia di PRO dan ELITE. Semua perhitungan tetap berjalan lokal di perangkat ini.
          </p>
        </section>
        <LockedFeature feature="smart_insights" />
      </>
    );
  }

  return (
    <>
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-sage">Mesin analisis lokal</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">Insight Feed</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
            Rekomendasi keuangan yang mudah ditelusuri dari data lokal, skor prioritas, dan batas aman perencanaan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HelpModalButton topic="insight" />
          <Button variant="secondary" icon={<UserRoundCog size={17} aria-hidden="true" />} onClick={() => setProfileOpen(true)}>
            Planning profile
          </Button>
          <Button variant="secondary" icon={<RefreshCw size={17} aria-hidden="true" />} onClick={() => void refreshInsights()} disabled={isLoading}>
            Generate
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
        {canUseAdvancedScoring ? (
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-secondary">Financial health score</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{healthScore}</p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-sage/20 text-ink">
                <Sparkles size={19} aria-hidden="true" />
              </span>
            </div>
            <div className="mt-4">
              <ProgressBar value={healthScore} tone={healthScore >= 65 ? "sage" : healthScore >= 50 ? "warning" : "danger"} label="Financial health score" />
            </div>
            {healthInsight && (
              <div className="mt-3 grid gap-1 text-xs leading-5 text-secondary">
                <p>Terkuat: <span className="font-semibold text-ink">{evidenceText(healthInsight, "Faktor terbesar")}</span></p>
                <p>Terlemah: <span className="font-semibold text-ink">{evidenceText(healthInsight, "Faktor terlemah")}</span></p>
                <p>Total: <span className="font-semibold text-ink">{evidenceText(healthInsight, "Total score")}</span></p>
              </div>
            )}
            <div className="mt-3">
              <HelpModalButton topic="healthScore" label="Score basis" />
            </div>
          </Card>
        ) : (
          <LockedFeature feature="advanced_financial_scoring" compact />
        )}
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-secondary">Warnings</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{warningCount}</p>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-peach/25 text-ink">
              <AlertTriangle size={19} aria-hidden="true" />
            </span>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-secondary">Positive signals</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{positiveCount}</p>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-mint/30 text-ink">
              <CheckCircle2 size={19} aria-hidden="true" />
            </span>
          </div>
        </Card>
      </section>

      <section>
        <Card title="Planning Profile" eyebrow="Asumsi perencanaan">
          <div className="grid gap-3 sm:grid-cols-5">
            <ProfileMetric label="Usia" value={`${planningProfile?.currentAge ?? 0}`} />
            <ProfileMetric label="Target pensiun" value={`${planningProfile?.retirementTargetAge ?? 0}`} />
            <ProfileMetric label="Status" value={planningProfile?.maritalStatus ?? "single"} />
            <ProfileMetric label="Tanggungan" value={`${planningProfile?.dependentsCount ?? 0}`} />
            <ProfileMetric label="Risk" value={planningProfile?.riskProfile ?? "moderate"} />
          </div>
          <p className="mt-3 text-sm leading-6 text-secondary">
            Profil ini digunakan untuk asumsi perencanaan dan rekomendasi keuangan.
          </p>
        </Card>
      </section>

      {isLoading && <LoadingState title="Membuat insight" body="Menganalisis data lokal dan ringkasan keuangan periode ini." />}
      {errorMessage && <ErrorState body={errorMessage} onRetry={() => void refreshInsights()} />}

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.4fr]">
        <Card title="Insight Categories" eyebrow="Priority system">
          <div className="mb-4 flex gap-3 rounded-lg bg-mint/20 p-3 text-sm leading-6 text-secondary">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-sage" aria-hidden="true" />
            <p>Dihitung dari data lokal Anda. Tidak ada ketergantungan cloud untuk membaca insight ini.</p>
          </div>
          <SegmentedControl value={categoryFilter} options={[...categoryOptions]} onChange={setCategoryFilter} />
          <div className="mt-5 grid gap-2">
            {categorySummary(insights).map((item) => (
              <div key={item.category} className="flex min-h-12 items-center justify-between rounded-lg bg-muted/70 px-3">
                <span className="text-sm font-semibold capitalize text-ink">{item.category}</span>
                <span className="text-sm font-bold tabular-nums text-secondary">{item.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Insight Feed" action={<span className="text-sm font-medium text-secondary">{filteredInsights.length} cards</span>}>
          <div className="grid gap-3">
            {filteredInsights.map((insight) => (
              <article key={insight.id} className="rounded-lg bg-muted/70 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <InsightIcon severity={insight.severity} />
                      <h3 className="text-sm font-bold text-ink">{insight.title}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${severityStyles[insight.severity]}`}>
                        {insight.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-secondary">{insight.body}</p>
                  </div>
                  <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-secondary">
                    {getInsightCategory(insight)}
                  </span>
                </div>

                {insight.ruleId === "financial-health-score" && <HealthBreakdown insight={insight} />}

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {visibleEvidence(insight).slice(0, 6).map((item) => (
                    <div key={`${insight.id}-${item.label}`} className="rounded-lg bg-surface px-3 py-2">
                      <p className="text-xs font-semibold text-secondary">{item.label}</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-ink">{formatEvidenceValue(item.value, item.unit)}</p>
                    </div>
                  ))}
                </div>

                <details className="mt-3 rounded-lg bg-surface px-3 py-2">
                  <summary className="cursor-pointer text-sm font-semibold text-ink">Cara hitung</summary>
                  <div className="mt-3 grid gap-2 text-sm leading-6 text-secondary">
                    <p><span className="font-semibold text-ink">Kenapa muncul:</span> {evidenceText(insight, "Why")}</p>
                    <p><span className="font-semibold text-ink">Rumus:</span> {evidenceText(insight, "Formula")}</p>
                    <p><span className="font-semibold text-ink">Ambang:</span> {evidenceText(insight, "Threshold")}</p>
                    <p><span className="font-semibold text-ink">Sumber data:</span> {evidenceText(insight, "Data sources")}</p>
                    <p><span className="font-semibold text-ink">Saran:</span> {evidenceText(insight, "Recommendation")}</p>
                  </div>
                </details>

                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {insight.action && (
                    <Button variant="secondary" className="h-10 px-3" onClick={() => navigate(insight.action?.route ?? "/")}>
                      {insight.action.label}
                    </Button>
                  )}
                  <Button variant="ghost" className="h-10 px-3" icon={<Pin size={15} aria-hidden="true" />} onClick={() => void setStatus(insight, insight.status === "pinned" ? "seen" : "pinned")}>
                    {insight.status === "pinned" ? "Unpin" : "Pin"}
                  </Button>
                  <Button variant="ghost" className="h-10 px-3" icon={<X size={15} aria-hidden="true" />} onClick={() => void setStatus(insight, "dismissed")}>
                    Dismiss
                  </Button>
                </div>
              </article>
            ))}

            {!isLoading && filteredInsights.length === 0 && (
              <EmptyState
                title="No insights yet"
                body="Generate insights after adding transactions, budgets, goals, or recurring rules."
                action={<Button variant="secondary" icon={<RefreshCw size={17} aria-hidden="true" />} onClick={() => void refreshInsights()}>Generate</Button>}
              />
            )}
          </div>
        </Card>
      </section>

      <Modal open={isProfileOpen} title="Profil Perencanaan" onClose={() => setProfileOpen(false)}>
        {planningProfile && <PlanningProfileForm profile={planningProfile} onSubmit={handleProfileSubmit} onCancel={() => setProfileOpen(false)} />}
      </Modal>
    </>
  );
}

function InsightIcon({ severity }: { severity: Insight["severity"] }) {
  if (severity === "positive") return <CheckCircle2 size={18} className="text-success" aria-hidden="true" />;
  if (severity === "info") return <Info size={18} className="text-secondary" aria-hidden="true" />;
  return <AlertTriangle size={18} className={severity === "critical" ? "text-danger" : "text-warning"} aria-hidden="true" />;
}

function categorySummary(insights: Insight[]) {
  const counts = new Map<string, number>();
  insights.forEach((insight) => counts.set(getInsightCategory(insight), (counts.get(getInsightCategory(insight)) ?? 0) + 1));
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => right.count - left.count);
}

function HealthBreakdown({ insight }: { insight: Insight }) {
  const rows = [
    ["Cashflow", "Poin cashflow", "Bobot cashflow"],
    ["Savings", "Poin menabung", "Bobot menabung"],
    ["Budget", "Poin budget", "Bobot budget"],
    ["Debt", "Poin utang", "Bobot utang"],
    ["Emergency", "Poin dana darurat", "Bobot dana darurat"],
    ["Stability", "Poin stabilitas", "Bobot stabilitas"]
  ];

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([label, scoreLabel, maxLabel]) => (
        <div key={label} className="rounded-lg bg-surface px-3 py-2">
          <p className="text-xs font-semibold text-secondary">{label}</p>
          <p className="mt-1 text-sm font-bold text-ink">
            {evidenceText(insight, scoreLabel)}/{evidenceText(insight, maxLabel)}
          </p>
        </div>
      ))}
    </div>
  );
}

function formatEvidenceValue(value: number | string, unit?: "IDR" | "percent" | "count" | "date") {
  if (unit === "IDR" && typeof value === "number") return formatCurrency(value);
  if (unit === "percent") return `${value}%`;
  if (unit === "count") return String(value);
  return String(value);
}

const hiddenEvidenceLabels = new Set([
  "Category",
  "Priority",
  "Priority score",
  "Why",
  "Formula",
  "Threshold",
  "Recommendation",
  "Data sources",
  "Privacy",
  "Health score",
  "Total score",
  "Poin cashflow",
  "Poin menabung",
  "Poin budget",
  "Poin utang",
  "Poin dana darurat",
  "Poin stabilitas",
  "Bobot cashflow",
  "Bobot menabung",
  "Bobot budget",
  "Bobot utang",
  "Bobot dana darurat",
  "Bobot stabilitas"
]);

function visibleEvidence(insight: Insight) {
  return insight.evidence.filter((item) => !hiddenEvidenceLabels.has(item.label));
}

function evidenceText(insight: Insight, label: string) {
  return String(insight.evidence.find((item) => item.label === label)?.value ?? "-");
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/70 px-3 py-2">
      <p className="text-xs font-semibold text-secondary">{label}</p>
      <p className="mt-1 text-sm font-bold capitalize text-ink">{value}</p>
    </div>
  );
}

function PlanningProfileForm({
  profile,
  onSubmit,
  onCancel
}: {
  profile: PlanningProfile;
  onSubmit: (values: PlanningProfile) => Promise<void>;
  onCancel: () => void;
}) {
  const [currentAge, setCurrentAge] = useState(String(profile.currentAge));
  const [maritalStatus, setMaritalStatus] = useState<PlanningProfile["maritalStatus"]>(profile.maritalStatus);
  const [dependentsCount, setDependentsCount] = useState(String(profile.dependentsCount));
  const [retirementTargetAge, setRetirementTargetAge] = useState(String(profile.retirementTargetAge));
  const [riskProfile, setRiskProfile] = useState<PlanningProfile["riskProfile"]>(profile.riskProfile);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      currentAge: Math.abs(Number(currentAge || profile.currentAge)),
      maritalStatus,
      dependentsCount: Math.abs(Number(dependentsCount || 0)),
      retirementTargetAge: Math.abs(Number(retirementTargetAge || profile.retirementTargetAge)),
      riskProfile
    });
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Usia saat ini">
          <Input required type="number" min="0" max="100" value={currentAge} onChange={(event) => setCurrentAge(event.target.value)} />
        </Field>
        <Field label="Target usia pensiun">
          <Input required type="number" min="40" max="85" value={retirementTargetAge} onChange={(event) => setRetirementTargetAge(event.target.value)} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Status pernikahan">
          <Select value={maritalStatus} onChange={(event) => setMaritalStatus(event.target.value as PlanningProfile["maritalStatus"])}>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </Select>
        </Field>
        <Field label="Jumlah tanggungan">
          <Input required type="number" min="0" max="12" value={dependentsCount} onChange={(event) => setDependentsCount(event.target.value)} />
        </Field>
      </div>
      <Field label="Profil risiko">
        <Select value={riskProfile} onChange={(event) => setRiskProfile(event.target.value as PlanningProfile["riskProfile"])}>
          <option value="conservative">Conservative</option>
          <option value="moderate">Moderate</option>
          <option value="aggressive">Aggressive</option>
        </Select>
      </Field>
      <div className="rounded-lg bg-muted p-3 text-sm leading-6 text-secondary">
        Profil ini digunakan untuk asumsi perencanaan dan rekomendasi keuangan.
      </div>
      <FormActions>
        <Button variant="secondary" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit">Simpan profil</Button>
      </FormActions>
    </form>
  );
}
