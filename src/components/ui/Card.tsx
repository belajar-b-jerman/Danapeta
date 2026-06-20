import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type CardProps = HTMLAttributes<HTMLElement> & {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
};

export function Card({ className, title, eyebrow, action, children, ...props }: CardProps) {
  return (
    <section className={cn("overflow-hidden rounded-lg bg-surface p-3 shadow-soft transition-shadow sm:p-4", className)} {...props}>
      {(title || eyebrow || action) && (
        <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4 sm:gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.08em] text-sage">{eyebrow}</p>}
            {title && <h2 className="mt-1 text-base font-semibold text-ink sm:text-lg">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
