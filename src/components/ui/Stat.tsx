import { formatCurrency } from "../../lib/money";

type StatProps = {
  label: string;
  value: string | number;
  tone: "sage" | "sky" | "peach";
};

const toneClass: Record<StatProps["tone"], string> = {
  sage: "bg-sage/20",
  sky: "bg-sky/25",
  peach: "bg-peach/25"
};

export function Stat({ label, value, tone }: StatProps) {
  const displayValue = typeof value === "number" ? formatCurrency(value) : value;

  return (
    <div className={`rounded-lg p-3 shadow-soft sm:p-4 ${toneClass[tone]}`}>
      <p className="text-xs font-medium text-secondary sm:text-sm">{label}</p>
      <p className="mt-2 break-words text-lg font-bold tabular-nums text-ink sm:text-2xl">{displayValue}</p>
    </div>
  );
}
