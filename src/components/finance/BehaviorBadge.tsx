import type { SpendingBehavior } from "../../db/schema";
import { cn } from "../../lib/cn";

const labels: Record<SpendingBehavior, string> = {
  fixed: "Tetap",
  variable: "Variabel",
  planned: "Direncanakan",
  impulse: "Impulsif",
  mandatory: "Wajib"
};

const styles: Record<SpendingBehavior, string> = {
  fixed: "bg-lavender/30 text-ink",
  variable: "bg-sky/25 text-ink",
  planned: "bg-mint/30 text-ink",
  impulse: "bg-peach/30 text-ink",
  mandatory: "bg-danger/15 text-ink"
};

export function BehaviorBadge({ behavior, className }: { behavior: SpendingBehavior; className?: string }) {
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", styles[behavior], className)}>{labels[behavior]}</span>;
}

