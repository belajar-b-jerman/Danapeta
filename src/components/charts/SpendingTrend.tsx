import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactCurrency, formatCurrency } from "../../lib/money";
import { ChartCard } from "./ChartCard";

type TrendDatum = {
  month: string;
  spending: number;
  budget: number;
};

export function SpendingTrend({ data }: { data: TrendDatum[] }) {
  return (
    <ChartCard
      title="Tren Pengeluaran"
      description="Bandingkan realisasi dengan budget bulanan."
      footer={<p className="text-sm text-secondary">Garis lavender menunjukkan budget rencana.</p>}
    >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
            <defs>
              <linearGradient id="spending" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#88B99A" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#88B99A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E6ECE8" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickFormatter={formatCompactCurrency} tickLine={false} axisLine={false} width={48} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Area type="monotone" dataKey="spending" stroke="#88B99A" fill="url(#spending)" strokeWidth={3} />
            <Area type="monotone" dataKey="budget" stroke="#C8B8EA" fill="transparent" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
    </ChartCard>
  );
}
