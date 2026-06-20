import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

export function LoadingState({ title = "Memuat data lokal", body }: { title?: string; body?: string }) {
  return (
    <div className="rounded-lg bg-surface p-5 shadow-soft" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-sage/20 text-ink">
          <Loader2 className="animate-spin" size={19} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-bold text-ink">{title}</p>
          <p className="mt-1 text-sm leading-6 text-secondary">{body ?? "Menyiapkan workspace offline dari IndexedDB."}</p>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  compact = false
}: {
  title: string;
  body: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-lg bg-muted text-center", compact ? "p-4" : "p-6")}>
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-surface text-secondary">
        <Inbox size={19} aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-secondary">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Ada hal yang perlu diperiksa",
  body,
  onRetry
}: {
  title?: string;
  body: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-danger/20 bg-danger/10 p-4" role="alert">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-surface text-danger">
          <AlertTriangle size={19} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-bold text-ink">{title}</p>
          <p className="mt-1 text-sm leading-6 text-secondary">{body}</p>
          {onRetry && (
            <Button variant="secondary" className="mt-3 h-10 px-3" onClick={onRetry}>
              Coba lagi
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
