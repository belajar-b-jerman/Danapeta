import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

export type HelpTopic = "insight" | "goals" | "netWorth" | "budget" | "report" | "healthScore";

const helpContent: Record<HelpTopic, { title: string; body: string[] }> = {
  insight: {
    title: "Insight formulas",
    body: [
      "Insight membaca data lokal dari transaksi, budget, akun, goals, dan profil planning.",
      "Setiap kartu menampilkan alasan, rumus, ambang, sumber data, dan rekomendasi agar hasilnya bisa diaudit."
    ]
  },
  goals: {
    title: "Manual vs linked goals",
    body: [
      "Manual tracking hanya mengubah progress tujuan dan tidak mengubah saldo akun.",
      "Mode linked mengikuti transaksi nyata, sehingga progress dapat berubah saat transaksi diedit atau dihapus."
    ]
  },
  netWorth: {
    title: "Net worth rule",
    body: [
      "Net worth dihitung dari accounts, manual assets, dan liabilities.",
      "Goals adalah target planning/proyeksi dan tidak dihitung ganda sebagai aset."
    ]
  },
  budget: {
    title: "Budget assumptions",
    body: [
      "Budget digunakan sebagai guardrail bulanan berbasis kategori dan subkategori.",
      "Persentase terpakai = pengeluaran kategori periode aktif / limit budget."
    ]
  },
  report: {
    title: "Dasar laporan Financial Planner",
    body: [
      "Report merangkum financial summary, cashflow, budget, goals, debt, emergency fund, skor kesehatan, dan rekomendasi.",
      "Laporan ini adalah bantuan edukasi perencanaan keuangan, bukan nasihat keuangan berlisensi."
    ]
  },
  healthScore: {
    title: "Health score interpretation",
    body: [
      "Skor menggunakan bobot: cashflow 25, savings 20, budget 15, debt 20, dana darurat 10, stabilitas 10.",
      "Interpretasi dipakai untuk memprioritaskan area paling lemah sebelum menambah kompleksitas planning."
    ]
  }
};

export function HelpModalButton({ topic, label = "Help" }: { topic: HelpTopic; label?: string }) {
  const [open, setOpen] = useState(false);
  const content = helpContent[topic];

  return (
    <>
      <Button variant="ghost" className="h-10 px-3" icon={<HelpCircle size={16} aria-hidden="true" />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} title={content.title} onClose={() => setOpen(false)}>
        <div className="grid gap-3">
          {content.body.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-6 text-secondary">
              {paragraph}
            </p>
          ))}
        </div>
      </Modal>
    </>
  );
}
