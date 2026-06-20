import { formatCurrency } from "../../lib/money";
import { cn } from "../../lib/cn";

export function Amount({ value, className }: { value: number; className?: string }) {
  const isIncome = value > 0;
  return (
    <span className={cn("font-bold tabular-nums", isIncome ? "text-success" : "text-ink", className)}>
      {isIncome ? "+" : value < 0 ? "-" : ""}
      {formatCurrency(Math.abs(value))}
    </span>
  );
}

