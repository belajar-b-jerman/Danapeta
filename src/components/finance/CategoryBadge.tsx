import { cn } from "../../lib/cn";

export function CategoryBadge({ label, color = "#88B99A", className }: { label: string; color?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-ink", className)}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
