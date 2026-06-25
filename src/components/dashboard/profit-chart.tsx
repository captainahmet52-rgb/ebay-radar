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

export function ProfitChart({ data }: ProfitChartProps) {
  const chartData = data ?? [];
  const totalProfit = chartData.reduce((sum, d) => sum + d.profit, 0);
  const hasData = chartData.some((d) => d.profit > 0);

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
        {!hasData ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <p className="text-sm text-slate-400">Henüz kâr verisi yok</p>
            <p className="text-xs text-slate-600 mt-1">
              Mağaza bağlayıp satış oldukça grafik burada dolacak
            </p>
          </div>
        ) : (
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
        )}
      </div>
    </motion.div>
  );
}
