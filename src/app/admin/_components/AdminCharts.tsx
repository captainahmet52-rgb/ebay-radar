"use client";

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";

interface MonthRow { month: string; count: number }
interface OrderRow { month: string; count: number; revenue: number }
interface PlanRow  { plan: string; count: number }

interface Props {
  monthlyUsers:  MonthRow[];
  monthlyOrders: OrderRow[];
  planCounts:    PlanRow[];
}

const COLORS = ["#7c3aed", "#2563eb", "#059669", "#d97706"];

const tooltipStyle = {
  contentStyle: { background: "#0d1117", border: "1px solid #30363d", borderRadius: 8 },
  labelStyle: { color: "#8b949e" },
  itemStyle: { color: "#f0f6fc" },
};

export function AdminCharts({ monthlyUsers, monthlyOrders, planCounts }: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

      {/* Kullanıcı Büyümesi */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #30363d", borderRadius: 12, padding: "1.25rem" }}>
        <p style={{ color: "#8b949e", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Son 6 Ay — Yeni Kullanıcı</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={monthlyUsers}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="month" tick={{ fill: "#8b949e", fontSize: 11 }} />
            <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Line type="monotone" dataKey="count" name="Kullanıcı" stroke="#7c3aed" strokeWidth={2} dot={{ fill: "#7c3aed" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Aylık Sipariş */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #30363d", borderRadius: 12, padding: "1.25rem" }}>
        <p style={{ color: "#8b949e", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Son 6 Ay — Sipariş</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyOrders}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="month" tick={{ fill: "#8b949e", fontSize: 11 }} />
            <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} allowDecimals={false} />
            <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => name === "Gelir" ? `$${v.toFixed(2)}` : v} />
            <Bar dataKey="count" name="Sipariş" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Plan Dağılımı */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #30363d", borderRadius: 12, padding: "1.25rem" }}>
        <p style={{ color: "#8b949e", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Plan Dağılımı</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={planCounts} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={70} label={({ plan, percent }) => `${plan} ${(percent * 100).toFixed(0)}%`}>
              {planCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip {...tooltipStyle} />
            <Legend formatter={(v) => <span style={{ color: "#f0f6fc", fontSize: 12 }}>{v}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Aylık Gelir */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #30363d", borderRadius: 12, padding: "1.25rem" }}>
        <p style={{ color: "#8b949e", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Son 6 Ay — Tahmini Gelir ($)</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyOrders}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="month" tick={{ fill: "#8b949e", fontSize: 11 }} />
            <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => [`$${Number(v).toFixed(2)}`, "Gelir"]} />
            <Bar dataKey="revenue" name="Gelir" fill="#059669" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
