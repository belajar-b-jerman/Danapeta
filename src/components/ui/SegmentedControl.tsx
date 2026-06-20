import { cn } from "../../lib/cn";

type SegmentedControlProps<T extends string> = {
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ value, options, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="inline-grid min-h-11 grid-flow-col rounded-lg bg-muted p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "min-h-9 rounded-md px-3 text-sm font-semibold text-secondary outline-none transition focus-visible:ring-2 focus-visible:ring-sage/30",
            value === option.value && "bg-surface text-ink shadow-sm"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
