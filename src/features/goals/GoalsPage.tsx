import { GraduationCap, Home, Landmark, Plus, ShieldCheck, Target, TrendingDown } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Amount } from "../../components/finance/Amount";
import { LockedFeature } from "../../components/finance/FeatureGate";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/AppState";
import { HelpModalButton } from "../../components/finance/HelpModal";
import { Field, FormActions, Input, Select } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Stat } from "../../components/ui/Stat";
import { listAccounts } from "../../db/repositories/accountRepository";
import { addGoalContribution, archiveGoal, createGoal, listGoalSummaries, updateGoal, type GoalSummary } from "../../db/repositories/goalRepository";
import type { Account, Goal } from "../../db/schema";
import { canUseFeature } from "../../lib/commercialTiers";
import { getAccountType } from "../../lib/accounts";
import { formatCurrency } from "../../lib/money";
import { defaultReturnForGoal } from "../../lib/planningEngine";
import { useAppStore } from "../../stores/appStore";

const goalLabels: Record<Goal["type"], string> = {
  savings: "Tabungan",
  emergency_fund: "Dana darurat",
  debt_payoff: "Pelunasan utang",
  investment: "Investasi",
  custom: "Dana tujuan",
  house_purchase: "Beli rumah",
  retirement: "Pensiun",
  education: "Pendidikan",
  vehicle: "Kendaraan",
  custom_future: "Tujuan masa depan"
};

const deadlineLabels: Record<GoalSummary["deadlineStatus"], string> = {
  on_track: "Sesuai ritme",
  watch: "Perlu dipantau",
  behind: "Perlu penyesuaian",
  open: "Belum lengkap"
};

const deadlineStyles: Record<GoalSummary["deadlineStatus"], string> = {
  on_track: "bg-mint/30 text-ink",
  watch: "bg-peach/30 text-ink",
  behind: "bg-danger/15 text-ink",
  open: "bg-sky/25 text-ink"
};

export function GoalsPage() {
  const commercialTier = useAppStore((state) => state.commercialTier);
  const [goals, setGoals] = useState<GoalSummary[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeGoal, setActiveGoal] = useState<GoalSummary | undefined>();
  const [contributionGoal, setContributionGoal] = useState<GoalSummary | undefined>();
  const [contributionMode, setContributionMode] = useState<"real_transaction" | "manual_progress">("manual_progress");
  const [isFormOpen, setFormOpen] = useState(false);
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionAccountId, setContributionAccountId] = useState("");
  const [contributionNote, setContributionNote] = useState("");
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadGoalsData();
  }, []);

  async function loadGoalsData() {
    setLoading(true);
    setErrorMessage("");
    try {
      const [nextGoals, nextAccounts] = await Promise.all([listGoalSummaries(), listAccounts()]);
      setGoals(nextGoals);
      setAccounts(nextAccounts);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load goals.");
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    return goals.reduce(
      (summary, goal) => {
        summary.target += goal.targetAmount;
        summary.current += goal.currentAmount;
        summary.remaining += goal.remaining;
        if (goal.type === "debt_payoff") summary.debtPayoff += goal.currentAmount;
        if (goal.type === "emergency_fund") summary.emergency += goal.currentAmount;
        if (goal.type === "house_purchase") summary.house += goal.currentAmount;
        if (goal.type === "education") summary.education += goal.currentAmount;
        return summary;
      },
      { target: 0, current: 0, remaining: 0, debtPayoff: 0, emergency: 0, house: 0, education: 0 }
    );
  }, [goals]);

  const canUseGoals = canUseFeature(commercialTier, "savings_goals") || canUseFeature(commercialTier, "debt_tracker");

  if (!canUseGoals) {
    return (
      <>
        <section>
          <p className="text-sm font-semibold text-sage">Rencana tujuan</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">Tujuan Keuangan</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
            Tujuan tabungan, dana darurat, pelunasan utang, dan dana tujuan tersedia sebagai alat perencanaan.
          </p>
        </section>
        <LockedFeature feature="savings_goals" />
      </>
    );
  }

  function openForm(goal?: GoalSummary) {
    setActiveGoal(goal);
    setFormOpen(true);
  }

  function closeForm() {
    setActiveGoal(undefined);
    setFormOpen(false);
  }

  async function handleSubmit(values: GoalFormValues) {
    if (activeGoal) {
      await updateGoal(activeGoal.id, values);
    } else {
      await createGoal(values);
    }
    closeForm();
    await loadGoalsData();
  }

  async function handleContribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contributionGoal) return;
    await addGoalContribution(contributionGoal.id, {
      amount: Math.abs(Number(contributionAmount || 0)),
      mode: contributionMode,
      sourceAccountId: contributionMode === "real_transaction" ? contributionAccountId : undefined,
      targetLiabilityAccountId: contributionGoal.type === "debt_payoff" ? contributionGoal.linkedAccountId : undefined,
      note: contributionNote
    });
    setContributionGoal(undefined);
    setContributionMode("manual_progress");
    setContributionAmount("");
    setContributionAccountId("");
    setContributionNote("");
    await loadGoalsData();
  }

  async function handleArchive(goal: GoalSummary) {
    await archiveGoal(goal.id);
    await loadGoalsData();
  }

  return (
    <>
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-sage">Rencana tujuan</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">Tujuan Keuangan</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
            Pantau target tabungan, dana darurat, pelunasan utang, tenggat, dan estimasi kontribusi bulanan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HelpModalButton topic="goals" label="Mode tracking" />
          <Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => openForm()}>
            Tambah tujuan
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        <Stat label="Total target" value={totals.target} tone="sage" />
        <Stat label="Terkumpul / terbayar" value={totals.current} tone="sky" />
        <Stat label="Sisa target" value={totals.remaining} tone="peach" />
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-secondary">Progress tujuan</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{totals.target > 0 ? Math.round((totals.current / totals.target) * 100) : 0}%</p>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-mint/30 text-ink">
              <Target size={19} aria-hidden="true" />
            </span>
          </div>
        </Card>
      </section>

      {isLoading && <LoadingState title="Memuat tujuan" body="Membaca target tabungan, dana darurat, dan pelunasan utang dari penyimpanan lokal." />}
      {errorMessage && <ErrorState body={errorMessage} onRetry={() => void loadGoalsData()} />}

      <section>
        <Card title="Sinkronisasi Goal" eyebrow="No double counting">
          <div className="grid gap-2 text-sm leading-6 text-secondary">
            <p>Accounts adalah sumber saldo nyata untuk net worth.</p>
            <p>Goals adalah objek planning dan proyeksi, sehingga progress goal tidak otomatis menambah net worth.</p>
            <p>Default goal baru memakai manual tracking. Mode linked bersifat opsional untuk transaksi nyata.</p>
          </div>
        </Card>
      </section>

      <section className="rounded-lg bg-mint/20 px-4 py-3 text-sm leading-6 text-secondary">
        Dana darurat mengikuti status keluarga: lajang 3-6 bulan pengeluaran, menikah 6-9 bulan, menikah dengan anak/tanggungan 9-12 bulan. Proyeksi tujuan dihitung dari tanggal device, kontribusi bulanan, dan asumsi return jika ada.
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card title="Tujuan Aktif" action={<span className="text-sm font-medium text-secondary">{goals.length} target</span>}>
          <div className="grid gap-3">
            {goals.map((goal) => (
              <article key={goal.id} className="rounded-lg bg-muted/70 p-3">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-ink">{goal.name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${deadlineStyles[goal.deadlineStatus]}`}>
                        {deadlineLabels[goal.deadlineStatus]}
                      </span>
                      <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-secondary">{goal.feasibilityLabel}</span>
                    </div>
                    <p className="mt-1 text-xs text-secondary">
                      {goalLabels[goal.type]} {goal.targetDate ? `- tenggat ${goal.targetDate}` : "- tanpa tenggat"}
                    </p>
                  </div>
                  <Amount value={goal.currentAmount} className="text-sm" />
                </div>
                <ProgressBar value={goal.percent} tone={goal.deadlineStatus === "behind" ? "danger" : goal.deadlineStatus === "watch" ? "warning" : "sage"} label={`${goal.name} progress`} />
                <div className="mt-3 grid gap-2 text-xs text-secondary sm:grid-cols-2 lg:grid-cols-3">
                  <span>Target: {formatCurrency(goal.targetAmount)}</span>
                  <span>Sisa: {formatCurrency(goal.remaining)}</span>
                  <span>Waktu: {goal.remainingTimeLabel}</span>
                  <span>Estimasi/bulan: {formatCurrency(goal.requiredMonthlyContribution ?? goal.monthlyContribution ?? 0)}</span>
                  <span>Proyeksi selesai: {goal.projectedCompletionLabel}</span>
                  <span>Future value: {formatCurrency(goal.estimatedFutureValue)}</span>
                  <span>Funding gap: {formatCurrency(goal.fundingGap)}</span>
                  {goal.expectedAnnualReturn !== undefined && goal.expectedAnnualReturn > 0 && (
                    <span>Return asumsi: {(goal.expectedAnnualReturn ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%/tahun</span>
                  )}
                </div>
                <details className="mt-3 rounded-lg bg-surface px-3 py-2">
                  <summary className="cursor-pointer text-sm font-semibold text-ink">Simulasi kontribusi</summary>
                  <div className="mt-2 grid gap-1 text-sm leading-6 text-secondary">
                    <p>Kontribusi saat ini: <span className="font-semibold text-ink">{formatCurrency(goal.monthlyContribution ?? 0)}/bulan</span></p>
                    <p>Estimasi dibutuhkan: <span className="font-semibold text-ink">{formatCurrency(goal.requiredMonthlyContribution ?? 0)}/bulan</span></p>
                    <p>Expected completion: <span className="font-semibold text-ink">{goal.projectedCompletionLabel}</span></p>
                    <p>Logic: <span className="font-semibold text-ink">{goal.projectionLogic}</span></p>
                  </div>
                </details>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" className="h-10 px-3" onClick={() => openForm(goal)}>
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-10 px-3"
                    onClick={() => {
                      setContributionGoal(goal);
                      setContributionMode("manual_progress");
                      setContributionAccountId(accounts.find((account) => !account.isArchived && getAccountType(account) === "asset")?.id ?? "");
                    }}
                  >
                    Tambah kontribusi
                  </Button>
                  <Button variant="ghost" className="h-10 px-3 text-danger" onClick={() => void handleArchive(goal)}>
                    Arsipkan
                  </Button>
                </div>
              </article>
            ))}
            {!isLoading && goals.length === 0 && (
              <EmptyState
                title="Belum ada tujuan"
                body="Buat dana darurat, target tabungan, pelunasan utang, atau dana tujuan."
                action={<Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => openForm()}>Tambah tujuan</Button>}
              />
            )}
          </div>
        </Card>

        <div className="grid gap-4">
          <GoalPulseCard
            title="Dana Darurat"
            body="Dana aman untuk kebutuhan mendadak."
            value={totals.emergency}
            icon={<ShieldCheck size={19} aria-hidden="true" />}
          />
          <GoalPulseCard
            title="Pelunasan Utang"
            body="Total progress pembayaran utang."
            value={totals.debtPayoff}
            icon={<TrendingDown size={19} aria-hidden="true" />}
          />
          <GoalPulseCard
            title="Rumah & Pendidikan"
            body="Progress tujuan masa depan utama."
            value={totals.house + totals.education}
            icon={totals.house >= totals.education ? <Home size={19} aria-hidden="true" /> : <GraduationCap size={19} aria-hidden="true" />}
          />
          <Card title="Kesehatan Tenggat" eyebrow="Target waktu">
            <div className="grid gap-2">
              {goals.slice(0, 4).map((goal) => (
                <div key={goal.id} className="flex min-h-12 items-center justify-between rounded-lg bg-muted/70 px-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{goal.name}</span>
                    <span className="text-xs text-secondary">{goal.remainingTimeLabel}</span>
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${deadlineStyles[goal.deadlineStatus]}`}>
                    {goal.percent}%
                  </span>
                </div>
              ))}
              {goals.length === 0 && <p className="text-sm leading-6 text-secondary">Tenggat akan muncul setelah tujuan dibuat.</p>}
            </div>
          </Card>
        </div>
      </section>

      <Modal open={isFormOpen} title={activeGoal ? "Edit tujuan" : "Tambah tujuan"} onClose={closeForm}>
        <GoalForm accounts={accounts} goal={activeGoal} onSubmit={handleSubmit} onCancel={closeForm} />
      </Modal>

      <Modal open={Boolean(contributionGoal)} title="Tambah kontribusi" onClose={() => setContributionGoal(undefined)}>
        <form className="grid gap-4" onSubmit={handleContribution}>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm font-semibold text-ink">{contributionGoal?.name}</p>
            <p className="mt-1 text-sm text-secondary">Saat ini: {formatCurrency(contributionGoal?.currentAmount ?? 0)}</p>
            <p className="mt-2 inline-flex rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-secondary">
              {contributionMode === "real_transaction" ? "Linked to real money" : "Manual tracking only"}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className={`rounded-lg p-3 text-left transition ${contributionMode === "manual_progress" ? "bg-mint/30 text-ink" : "bg-muted text-secondary"}`}
              onClick={() => setContributionMode("manual_progress")}
            >
              <p className="text-sm font-bold">Manual tracking only</p>
              <p className="mt-1 text-xs leading-5">Update progress tujuan tanpa mengubah saldo akun.</p>
            </button>
            <button
              type="button"
              className={`rounded-lg p-3 text-left transition ${contributionMode === "real_transaction" ? "bg-sage/20 text-ink" : "bg-muted text-secondary"}`}
              onClick={() => setContributionMode("real_transaction")}
            >
              <p className="text-sm font-bold">Linked to real money</p>
              <p className="mt-1 text-xs leading-5">Mode linked akan mengikuti transaksi nyata dan dapat berubah saat transaksi diedit/dihapus.</p>
            </button>
          </div>
          <Field label="Nominal kontribusi">
            <Input required type="number" inputMode="numeric" min="0" value={contributionAmount} onChange={(event) => setContributionAmount(event.target.value)} />
          </Field>
          {contributionMode === "real_transaction" && (
            <>
              <Field label="Source account">
                <Select required value={contributionAccountId} onChange={(event) => setContributionAccountId(event.target.value)}>
                  <option value="">Pilih akun sumber</option>
                  {accounts
                    .filter((account) => !account.isArchived && getAccountType(account) === "asset")
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </Select>
              </Field>
              {contributionGoal?.type === "debt_payoff" && (
                <div className="flex gap-3 rounded-lg bg-peach/20 p-3 text-sm leading-6 text-secondary">
                  <Landmark size={18} className="mt-0.5 shrink-0 text-ink" aria-hidden="true" />
                  <p>
                    Payment ini akan mengurangi liability account{" "}
                    <span className="font-semibold text-ink">
                      {accounts.find((account) => account.id === contributionGoal.linkedAccountId)?.name ?? "yang terhubung"}
                    </span>
                    .
                  </p>
                </div>
              )}
            </>
          )}
          <Field label="Catatan">
            <Input value={contributionNote} placeholder="Opsional" onChange={(event) => setContributionNote(event.target.value)} />
          </Field>
          <FormActions>
            <Button variant="secondary" onClick={() => setContributionGoal(undefined)}>
              Batal
            </Button>
            <Button type="submit" disabled={!contributionAmount || (contributionMode === "real_transaction" && !contributionAccountId)}>
              Simpan kontribusi
            </Button>
          </FormActions>
        </form>
      </Modal>
    </>
  );
}

type GoalFormValues = {
  name: string;
  type: Goal["type"];
  planningGoalType?: Goal["planningGoalType"];
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  linkedAccountId?: string;
  contributesToAssets?: boolean;
  monthlyContribution?: number;
  expectedAnnualReturn?: number;
};

function GoalForm({
  accounts,
  goal,
  onSubmit,
  onCancel
}: {
  accounts: Account[];
  goal?: GoalSummary;
  onSubmit: (values: GoalFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [type, setType] = useState<Goal["type"]>(goal?.type ?? "savings");
  const [targetAmount, setTargetAmount] = useState(goal ? String(goal.targetAmount) : "");
  const [currentAmount, setCurrentAmount] = useState(goal ? String(goal.currentAmount) : "0");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [linkedAccountId, setLinkedAccountId] = useState(goal?.linkedAccountId ?? "");
  const [monthlyContribution, setMonthlyContribution] = useState(goal?.monthlyContribution ? String(goal.monthlyContribution) : "");
  const [expectedAnnualReturn, setExpectedAnnualReturn] = useState(goal?.expectedAnnualReturn ? String(goal.expectedAnnualReturn) : "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      name: name.trim(),
      type,
      planningGoalType: toPlanningGoalType(type),
      targetAmount: Math.abs(Number(targetAmount)),
      currentAmount: Math.abs(Number(currentAmount || 0)),
      targetDate: targetDate || undefined,
      linkedAccountId: linkedAccountId || undefined,
      contributesToAssets: false,
      monthlyContribution: monthlyContribution ? Math.abs(Number(monthlyContribution)) : undefined,
      expectedAnnualReturn: supportsGrowth(type) ? (expectedAnnualReturn === "" ? undefined : Math.abs(Number(expectedAnnualReturn))) : 0
    });
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <Field label="Nama tujuan">
        <Input required value={name} placeholder="Dana darurat, biaya sekolah, pelunasan utang" onChange={(event) => setName(event.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Jenis tujuan">
          <Select value={type} onChange={(event) => setType(event.target.value as Goal["type"])}>
            <option value="savings">Target tabungan</option>
            <option value="emergency_fund">Dana darurat</option>
            <option value="debt_payoff">Pelunasan utang</option>
            <option value="investment">Investasi</option>
            <option value="house_purchase">Beli rumah</option>
            <option value="retirement">Pensiun</option>
            <option value="education">Pendidikan</option>
            <option value="vehicle">Kendaraan</option>
            <option value="custom_future">Custom future goal</option>
            <option value="custom">Dana tujuan</option>
          </Select>
        </Field>
        <Field
          label={type === "debt_payoff" ? "Liability account terkait" : "Akun referensi"}
          hint={type === "debt_payoff" ? "Payment real money akan mengurangi saldo utang ini." : "Goals adalah tracker planning, bukan sumber net worth."}
        >
          <Select value={linkedAccountId} onChange={(event) => setLinkedAccountId(event.target.value)}>
            <option value="">Tanpa akun terkait</option>
            {accounts
              .filter((account) => type !== "debt_payoff" || getAccountType(account) === "liability")
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nominal target">
          <Input required type="number" inputMode="numeric" min="0" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} />
        </Field>
        <Field label="Nominal saat ini">
          <Input type="number" inputMode="numeric" min="0" value={currentAmount} onChange={(event) => setCurrentAmount(event.target.value)} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tenggat target">
          <Input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
        </Field>
        <Field label="Kontribusi bulanan">
          <Input type="number" inputMode="numeric" min="0" value={monthlyContribution} onChange={(event) => setMonthlyContribution(event.target.value)} />
        </Field>
      </div>
      <div className="rounded-lg bg-muted p-3 text-sm leading-6 text-secondary">
        Goal progress adalah planning tracker. Net worth hanya membaca accounts, liability accounts, dan manual assets.
      </div>
      {supportsGrowth(type) && (
        <Field label="Asumsi imbal hasil tahunan (%)" hint={`Default ${defaultReturnForGoal(type)}% jika dikosongkan. Gunakan 0% untuk tanpa growth.`}>
          <Input type="number" inputMode="decimal" min="0" step="0.01" value={expectedAnnualReturn} onChange={(event) => setExpectedAnnualReturn(event.target.value)} />
        </Field>
      )}
      <FormActions>
        <Button variant="secondary" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" disabled={!name || !targetAmount}>
          Simpan tujuan
        </Button>
      </FormActions>
    </form>
  );
}

function toPlanningGoalType(type: Goal["type"]): Goal["planningGoalType"] | undefined {
  if (type === "house_purchase" || type === "retirement" || type === "education" || type === "vehicle") return type;
  if (type === "custom_future") return "custom_future";
  return undefined;
}

function supportsGrowth(type: Goal["type"]) {
  return ["savings", "emergency_fund", "investment", "house_purchase", "retirement", "education", "vehicle", "custom_future", "custom"].includes(type);
}

function GoalPulseCard({ title, body, value, icon }: { title: string; body: string; value: number; icon: ReactNode }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-1 text-sm leading-6 text-secondary">{body}</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-sage/20 text-ink">{icon}</span>
      </div>
      <p className="mt-4 text-2xl font-bold tabular-nums text-ink">{formatCurrency(value)}</p>
    </Card>
  );
}
