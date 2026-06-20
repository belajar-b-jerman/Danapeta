import { cn } from "../../lib/cn";

type ProgressBarProps = {
  value: number;
  tone?: "sage" | "warning" | "danger" | "sky";
  label?: string;
};

const toneClass: Record<NonNullable<ProgressBarProps["tone"]>, string> = {
  sage: "bg-sage",
  warning: "bg-warning",
  danger: "bg-danger",
  sky: "bg-sky"
};

export function ProgressBar({ value, tone = "sage", label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(value, 100));

  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn("h-full rounded-full transition-all", toneClass[tone])} style={{ width: `${clamped}%` }} />
    </div>
  );
}

