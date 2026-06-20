import type { ReactNode } from "react";
import { Card } from "../ui/Card";

type ChartCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function ChartCard({ title, description, children, footer }: ChartCardProps) {
  return (
    <Card title={title}>
      <p className="-mt-2 mb-4 text-sm leading-6 text-secondary">{description}</p>
      <div className="h-56 min-h-56 sm:h-64 sm:min-h-64">{children}</div>
      {footer && <div className="mt-4">{footer}</div>}
    </Card>
  );
}
