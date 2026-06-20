import { formatCurrency } from "../../lib/money";
import { ProgressBar } from "../ui/ProgressBar";

type BudgetProgressProps = {
  name: string;
  spent: number;
  limit: number;
};

export function BudgetProgress({ name, spent, limit }: BudgetProgressProps) {
  const percent = Math.min(Math.round((spent / limit) * 100), 100);
  const isNearLimit = percent >= 85;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{name}</p>
        <p className="text-sm font-medium tabular-nums text-secondary">
          {formatCurrency(spent)} / {formatCurrency(limit)}
        </p>
      </div>
      <ProgressBar value={percent} tone={isNearLimit ? "warning" : "sage"} label={`${name} progress`} />
    </div>
  );
}
