import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

type InsightCardProps = {
  title: string;
  body: string;
  severity: "info" | "positive" | "warning" | "critical";
};

const severityStyles: Record<InsightCardProps["severity"], string> = {
  info: "bg-sky/20 text-ink",
  positive: "bg-mint/30 text-ink",
  warning: "bg-peach/25 text-ink",
  critical: "bg-danger/15 text-ink"
};

export function InsightCard({ title, body, severity }: InsightCardProps) {
  const Icon = severity === "positive" ? CheckCircle2 : severity === "info" ? Info : AlertTriangle;

  return (
    <article className={`rounded-lg p-4 shadow-soft ${severityStyles[severity]}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon size={20} aria-hidden="true" />
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <p className="text-sm leading-6 text-secondary">{body}</p>
    </article>
  );
}

