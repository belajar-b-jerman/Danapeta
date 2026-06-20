import { Amount } from "./Amount";

type TransactionItemProps = {
  title: string;
  category: string;
  amount: number;
};

export function TransactionItem({ title, category, amount }: TransactionItemProps) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-lg bg-muted/70 px-3">
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs font-medium text-secondary">{category}</p>
      </div>
      <Amount value={amount} className="text-sm" />
    </div>
  );
}
