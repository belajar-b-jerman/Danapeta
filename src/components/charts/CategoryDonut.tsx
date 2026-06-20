import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "../../lib/money";
import { ChartCard } from "./ChartCard";

type CategoryDatum = {
  name: string;
  value: number;
  color: string;
};

export function CategoryDonut({ data }: { data: CategoryDatum[] }) {
  return (
    <ChartCard
      title="Komposisi Kategori"
      description="Ringkasan pola pengeluaran bulan ini."
      footer={
        <div className="grid gap-2">
          {data.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-secondary">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}
              </span>
              <span className="font-semibold tabular-nums text-ink">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      }
    >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3}>
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
    </ChartCard>
  );
}
