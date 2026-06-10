"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import { motion } from "framer-motion";

interface ProfitData {
  date: string;
  profit: number;
}

interface ProfitChartProps {
  data?: ProfitData[];
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-bold text-white">
        ${payload[0]?.value?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}

// Generate mock 30-day data
function generateMockData(): ProfitData[] {
  const data: ProfitData[] = [];
  let base = 800;
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
    base += (Math.random() - 0.3) * 200;
    data.push({ date: label, profit: Math.max(200, Math.round(base)) });
  }
  return data;
}

export function ProfitChart({ data }: ProfitChartProps) {
  const chartData = data ?? generateMockData();
  const totalProfit = chartData.reduce((sum, d) => sum + d.profit, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6"
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-sm font-medium text-slate-400">30 Günlük Kâr</h3>
          <p className="text-2xl font-bold text-white mt-1">
            ${totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-emerald-400 bg-emerald-500/10">
          Bu Ay
        </span>
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "#64748b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={6}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(124,58,237,0.3)", strokeWidth: 2 }} />
            <Area
              type="monotone"
              dataKey="profit"
              stroke="#7c3aed"
              strokeWidth={2}
              fill="url(#profitGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "#7c3aed", stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
