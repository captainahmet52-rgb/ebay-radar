"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, ChevronDown, Settings, LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

const pathLabels: Record<string, string> = {
  "/dashboard":           "Dashboard",
  "/dashboard/products":  "Ürünler",
  "/dashboard/listings":  "Listeler",
  "/dashboard/orders":    "Siparişler",
  "/dashboard/settings":  "Ayarlar",
};

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const pageTitle = pathLabels[pathname] ?? "Dashboard";

  return (
    <header className="fixed top-0 right-0 left-64 h-16 bg-slate-950/80 backdrop-blur-xl border-b border-slate-700/50 z-30 flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-white">{pageTitle}</h1>

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-violet-500 ring-2 ring-slate-950" />
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700/50 rounded-xl shadow-xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-slate-700/50">
                  <p className="text-sm font-semibold text-white">Bildirimler</p>
                </div>
                <div className="divide-y divide-slate-700/30">
                  {[
                    { title: "Ürün fiyatı güncellendi", desc: "B09G9HD6PD → $145.20", time: "5 dk önce" },
                    { title: "Yeni sipariş alındı", desc: "#EB-2024-001 → $89.99", time: "1 saat önce" },
                    { title: "Stok uyarısı", desc: "3 ürün düşük stok", time: "3 saat önce" },
                  ].map((n, i) => (
                    <div key={i} className="px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer">
                      <p className="text-sm font-medium text-white">{n.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{n.desc}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{n.time}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-all duration-200"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white">
              {session?.user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <span className="text-sm text-slate-300 hidden sm:block max-w-32 truncate">
              {session?.user?.email ?? "Kullanıcı"}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700/50 rounded-xl shadow-xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-slate-700/50">
                  <p className="text-xs text-slate-400 truncate">{session?.user?.email}</p>
                </div>
                <div className="p-1">
                  <button className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all">
                    <Settings className="h-4 w-4" />
                    Ayarlar
                  </button>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <LogOut className="h-4 w-4" />
                    Çıkış Yap
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
