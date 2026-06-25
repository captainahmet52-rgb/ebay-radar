"use client";

import { motion } from "framer-motion";
import useSWR from "swr";
import Link from "next/link";
import { DollarSign, List, TrendingUp, Clock, Plus, Zap } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ProfitChart } from "@/components/dashboard/profit-chart";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { OnboardingCard } from "@/components/dashboard/onboarding-card";
import { Button } from "@/components/ui/button";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
};

export default function DashboardPage() {
  const { data: stats } = useSWR("/api/orders/stats", fetcher);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title + Quick actions */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold text-white"
          >
            Hoş Geldiniz 👋
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-slate-400 text-sm mt-1"
          >
            İşte mağazanızın güncel durumu
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <Link href="/dashboard/products">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Ürün Ekle
            </Button>
          </Link>
          <Link href="/dashboard/settings">
            <Button variant="ghost" size="sm">
              <Zap className="h-4 w-4" />
              eBay Bağla
            </Button>
          </Link>
        </motion.div>
      </div>

      {/* Başlarken rehberi — hesap boşken görünür, adımlar bitince kaybolur */}
      <OnboardingCard status={stats?.onboarding} />

      {/* Stats grid */}
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatsCard
          title="Toplam Kâr"
          value={stats?.totalProfit ?? 0}
          prefix="$"
          icon={<DollarSign />}
          color="violet"
          delay={0}
        />
        <StatsCard
          title="Aktif Listeler"
          value={stats?.activeListings ?? 0}
          icon={<List />}
          color="blue"
          delay={0.1}
        />
        <StatsCard
          title="Bu Ay Kâr"
          value={stats?.thisMonthProfit ?? 0}
          prefix="$"
          change={stats?.thisMonthChange ?? undefined}
          icon={<TrendingUp />}
          color="green"
          delay={0.2}
        />
        <StatsCard
          title="Bekleyen Sipariş"
          value={stats?.pendingOrders ?? 0}
          icon={<Clock />}
          color="amber"
          delay={0.3}
        />
      </motion.div>

      {/* Chart + Recent orders */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ProfitChart data={stats?.dailyProfit} />
        </div>
        <div>
          <RecentOrders orders={stats?.recentOrders} />
        </div>
      </div>

      {/* Quick stats footer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-3 gap-4"
      >
        {[
          { label: "Başarı Oranı", value: `%${stats?.successRate ?? 0}`, color: "text-emerald-400" },
          { label: "Ort. Kâr/Sipariş", value: `$${(stats?.avgProfitPerOrder ?? 0).toFixed(2)}`, color: "text-violet-400" },
          { label: "Toplam Sipariş", value: `${stats?.totalOrders ?? 0}`, color: "text-blue-400" },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between"
          >
            <span className="text-sm text-slate-400">{item.label}</span>
            <span className={`text-sm font-semibold ${item.color}`}>{item.value}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
