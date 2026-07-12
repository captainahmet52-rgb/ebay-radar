"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Store, Package, ShoppingCart, Upload,
  ChevronLeft, LogOut, Home, ShieldCheck,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LogoMark } from "@/components/logo";
import { AMZ_ACCENT } from "@/components/amazon/shared";

// AmazonBot müşteri menüsü — radar/depo YOK (admin'e ait)
const navItems = [
  { href: "/amazon",          label: "Panel",       icon: LayoutDashboard, exact: true },
  { href: "/amazon/stores",   label: "Mağazalarım", icon: Store },
  { href: "/amazon/products", label: "Ürünler",     icon: Package },
  { href: "/amazon/orders",   label: "Siparişler",  icon: ShoppingCart },
  { href: "/amazon/auto-upload", label: "Oto Yükleme", icon: Upload },
];

export function AmazonSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("amz-sidebar-collapsed") === "true";
  });
  useEffect(() => {
    localStorage.setItem("amz-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  const plan = (session?.user?.plan ?? "starter") as "free" | "starter" | "basic" | "growth" | "pro" | "enterprise";
  const isAdmin = session?.user?.role === "admin";

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="fixed left-0 top-0 h-screen z-40 flex flex-col overflow-hidden"
      style={{ background: "rgba(6,14,10,0.85)", backdropFilter: "blur(20px)", borderRight: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 min-h-[72px]" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <LogoMark size={34} className="flex-shrink-0" />
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }} className="overflow-hidden leading-none"
            >
              <p className="font-black text-white text-sm flex items-center gap-1.5">
                AmazonBot <span className="w-1.5 h-1.5 rounded-full" style={{ background: AMZ_ACCENT }} />
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Lean Automation</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ana Sayfa */}
      <div className="px-3 pt-3">
        <Link href="/">
          <motion.div whileHover={{ x: 2 }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200 cursor-pointer"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <Home className="h-5 w-5 flex-shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }} className="text-sm font-medium truncate">Ana Sayfa</motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href}>
              <motion.div whileHover={{ x: 2 }} whileTap={{ scale: 0.97 }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer",
                  isActive ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
                style={isActive ? { background: `${AMZ_ACCENT}1a`, border: `1px solid ${AMZ_ACCENT}33`, boxShadow: `0 8px 24px -12px ${AMZ_ACCENT}55` } : undefined}>
                <Icon className="h-5 w-5 flex-shrink-0" style={isActive ? { color: AMZ_ACCENT } : undefined} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.2 }} className="text-sm font-medium truncate">{label}</motion.span>
                  )}
                </AnimatePresence>
                {isActive && (
                  <motion.div layoutId="amz-active-indicator" className="ml-auto w-1 h-4 rounded-full"
                    style={{ background: `linear-gradient(to bottom, ${AMZ_ACCENT}, #34d399)` }} />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Admin */}
      {isAdmin && (
        <div className="px-3 pb-1">
          <Link href="/admin/amazon">
            <motion.div whileHover={{ x: 2 }} whileTap={{ scale: 0.97 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-500/10">
              <ShieldCheck className="h-5 w-5 flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }} className="text-sm font-medium truncate">Admin</motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className={cn("flex items-center gap-3 px-3 py-2", collapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-black"
            style={{ background: `linear-gradient(to bottom right, ${AMZ_ACCENT}, #059669)` }}>
            {session?.user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }} className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{session?.user?.email ?? "Kullanıcı"}</p>
                <Badge variant={plan} className="mt-0.5 text-[10px]" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button onClick={() => signOut({ callbackUrl: "/" })}
          className={cn("flex items-center gap-3 w-full px-3 py-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200", collapsed && "justify-center")}>
          <LogOut className="h-4 w-4 flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }} className="text-sm font-medium">Çıkış Yap</motion.span>
            )}
          </AnimatePresence>
        </button>

        <button onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all duration-200">
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronLeft className="h-4 w-4" />
          </motion.div>
        </button>
      </div>
    </motion.aside>
  );
}
