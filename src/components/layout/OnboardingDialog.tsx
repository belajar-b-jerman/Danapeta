import { BarChart3, Download, Landmark, Lightbulb, Lock, ReceiptText, ShieldCheck, Smartphone, Target } from "lucide-react";
import { useState } from "react";
import { useRouter } from "../../app/router";
import { setAppSetting } from "../../db/repositories/settingsRepository";
import { useAppStore } from "../../stores/appStore";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

const steps = [
  {
    title: "Privat sejak awal",
    body: "DANAPETA menyimpan akun, budget, tujuan, dan insight di IndexedDB lokal. Sinkronisasi tetap opsional dan siap dikembangkan nanti.",
    icon: ShieldCheck
  },
  {
    title: "Mulai dari transaksi",
    body: "Catat pemasukan, pengeluaran, transfer, label perilaku belanja, dan template transaksi rutin dari ledger transaksi.",
    icon: ReceiptText
  },
  {
    title: "Rencanakan dengan data yang jelas",
    body: "Budget, goals, analytics, dan insight deterministik dibuat dari agregat lokal yang dapat ditinjau.",
    icon: BarChart3
  },
  {
    title: "Pahami skor kesehatan finansial",
    body: "Financial health score adalah model berbobot yang transparan: cashflow, rasio menabung, disiplin budget, utang, dana darurat, dan stabilitas.",
    icon: Lightbulb
  },
  {
    title: "Pisahkan net worth dan tujuan",
    body: "Akun dan aset menjadi sumber saldo aktual. Goals adalah objek perencanaan, sehingga proyeksi tidak menggandakan net worth.",
    icon: Landmark
  },
  {
    title: "Gunakan proyeksi sebagai panduan",
    body: "Future planning memakai rumus lokal, target tanggal, kontribusi bulanan, dan asumsi return. Perlakukan proyeksi sebagai panduan, bukan kepastian.",
    icon: Target
  },
  {
    title: "Kuasai datamu",
    body: "Ekspor CSV, unduh backup JSON lengkap, restore lokal, atau buat laporan PDF dari Settings.",
    icon: Download
  }
] as const;

export function OnboardingDialog() {
  const isAppReady = useAppStore((state) => state.isAppReady);
  const hasCompletedOnboarding = useAppStore((state) => state.hasCompletedOnboarding);
  const setHasCompletedOnboarding = useAppStore((state) => state.setHasCompletedOnboarding);
  const installPromptAvailable = useAppStore((state) => state.installPromptAvailable);
  const { navigate } = useRouter();
  const [stepIndex, setStepIndex] = useState(0);

  const step = steps[stepIndex];
  const StepIcon = step.icon;
  const isLastStep = stepIndex === steps.length - 1;
  const open = isAppReady && !hasCompletedOnboarding;

  async function completeOnboarding(route = "/transactions") {
    await setAppSetting("hasCompletedOnboarding", true);
    setHasCompletedOnboarding(true);
    navigate(route);
  }

  async function handleInstall() {
    const prompt = window.danapetaInstallPrompt;
    if (prompt) {
      await prompt.prompt();
    }
  }

  return (
    <Modal open={open} title="Selamat datang di DANAPETA" onClose={() => void completeOnboarding("/")}>
      <div className="grid gap-4">
        <div className="rounded-lg bg-muted p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-surface text-ink">
              <StepIcon size={21} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-sage">
                Langkah {stepIndex + 1} dari {steps.length}
              </p>
              <h3 className="mt-2 text-lg font-bold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-secondary">{step.body}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2" aria-hidden="true">
          {steps.map((item, index) => (
            <span key={item.title} className={`h-2 rounded-full ${index <= stepIndex ? "bg-sage" : "bg-muted"}`} />
          ))}
        </div>

        <div className="rounded-lg border border-ink/5 bg-surface p-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky/25 text-ink">
              {installPromptAvailable ? <Smartphone size={18} aria-hidden="true" /> : <Lock size={18} aria-hidden="true" />}
            </span>
            <p className="text-sm leading-6 text-secondary">
              {installPromptAvailable
                ? "Perangkat ini dapat memasang aplikasi untuk pengalaman layar penuh yang ramah offline."
                : "Prompt instalasi muncul setelah browser mengonfirmasi kelayakan PWA. Aplikasi tetap dapat dipakai offline setelah pemuatan pertama."}
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={() => void completeOnboarding("/")}>
            Lewati
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            {installPromptAvailable && (
              <Button variant="secondary" onClick={() => void handleInstall()}>
                Pasang aplikasi
              </Button>
            )}
            {stepIndex > 0 && (
              <Button variant="secondary" onClick={() => setStepIndex((current) => current - 1)}>
                Kembali
              </Button>
            )}
            {isLastStep ? (
              <Button onClick={() => void completeOnboarding("/transactions")}>Mulai merencanakan</Button>
            ) : (
              <Button onClick={() => setStepIndex((current) => current + 1)}>Lanjut</Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
