"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  List,
  ShoppingCart,
  Settings,
  ChevronLeft,
  LogOut,
  Upload,
  CreditCard,
  ShieldCheck,
  Home,
  Store,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LogoMark } from "@/components/logo";

// eBayBot paneli — sadece eBay'e ait sayfalar
const navItems = [
  { href: "/dashboard",             label: "Panel",         icon: LayoutDashboard },
  { href: "/dashboard/stores",      label: "Mağazalarım",   icon: Store },
  { href: "/dashboard/listings",    label: "eBay Listeler", icon: List },
  { href: "/dashboard/products",    label: "Ürünler",       icon: Package },
  { href: "/dashboard/orders",      label: "Siparişler",    icon: ShoppingCart },
  { href: "/dashboard/auto-upload", label: "Oto Yükleme",   icon: Upload },
  { href: "/dashboard/pricing",     label: "Paketler",      icon: CreditCard },
  { href: "/dashboard/settings",    label: "Ayarlar",       icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  const plan = (session?.user?.plan ?? "starter") as "free" | "starter" | "basic" | "growth" | "pro" | "enterprise";
  const isAdmin = session?.user?.role === "admin";

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="fixed left-0 top-0 h-screen bg-slate-900/80 backdrop-blur-xl border-r border-slate-700/50 z-40 flex flex-col overflow-hidden"
    >
      {/* Logo + platform */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50 min-h-[72px]">
        <LogoMark size={36} className="flex-shrink-0" />
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden leading-none"
            >
              <p className="font-black text-white text-sm flex items-center gap-1.5">
                Lean Automation
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              </p>
              <p className="text-[10px] text-slate-400 mt-1">eBay Paneli</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ana Sayfa / Platform değiştir */}
      <div className="px-3 pt-3">
        <Link href="/">
          <motion.div
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200 cursor-pointer border border-slate-700/40"
          >
            <Home className="h-5 w-5 flex-shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm font-medium truncate"
                >
                  Ana Sayfa
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);

          return (
            <Link key={href} href={href}>
              <motion.div
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer",
                  isActive
                    ? "bg-gradient-to-r from-violet-600/20 to-blue-600/10 border border-violet-500/20 text-white shadow-lg shadow-violet-500/10"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0",
                    isActive ? "text-violet-400" : "group-hover:text-slate-200"
                  )}
                />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.2 }}
                      className="text-sm font-medium truncate"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
                    className="ml-auto w-1 h-4 rounded-full bg-gradient-to-b from-violet-500 to-blue-500"
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Admin Link */}
      {isAdmin && (
        <div className="px-3 pb-1">
          <Link href="/admin">
            <motion.div
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.97 }}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer",
                pathname.startsWith("/admin")
                  ? "bg-gradient-to-r from-red-600/20 to-orange-600/10 border border-red-500/20 text-white shadow-lg shadow-red-500/10"
                  : "text-red-400 hover:text-red-300 hover:bg-red-500/10"
              )}
            >
              <ShieldCheck
                className={cn(
                  "h-5 w-5 flex-shrink-0",
                  pathname.startsWith("/admin") ? "text-red-400" : "text-red-500"
                )}
              />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm font-medium truncate"
                  >
                    Admin Panel
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-slate-700/50 space-y-2">
        {/* User info */}
        <div className={cn("flex items-center gap-3 px-3 py-2", collapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
            {session?.user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="flex-1 min-w-0"
              >
                <p className="text-xs text-white truncate">{session?.user?.email ?? "Kullanıcı"}</p>
                <Badge variant={plan} className="mt-0.5 text-[10px]" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Logout */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="text-sm font-medium"
              >
                Çıkış Yap
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all duration-200"
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.div>
        </button>
      </div>
    </motion.aside>
  );
}
