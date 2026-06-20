import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white shadow-soft hover:bg-ink/90",
  secondary: "bg-muted text-ink hover:bg-sage/20",
  ghost: "bg-transparent text-secondary hover:bg-muted hover:text-ink",
  danger: "bg-danger text-white shadow-soft hover:bg-danger/90"
};

export function Button({ className, variant = "primary", icon, children, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-lg px-4 text-center text-sm font-semibold leading-5 outline-none transition focus-visible:ring-4 focus-visible:ring-sage/20 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
