"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard, Grid3X3, Store, Package, ClipboardList, Home, Loader2,
  LogOut, Menu, X,
} from "lucide-react";
import { EtsyDataProvider, ETSY_ACCENT } from "@/components/etsy/shared";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

/** Sayfa yapısı EtsyFlow'un kendi paneli (KODLAR/etsyflow-project/src/components/Sidebar.jsx) baz alındı; marka Lean Automation'a uyarlandı. */
const NAV = [
  { href: "/etsy", label: "Anasayfa", icon: LayoutDashboard, exact: true },
  { href: "/etsy/kategoriler", label: "Katalog", icon: Grid3X3 },
  { href: "/etsy/products", label: "Ürünlerim", icon: Package },
  { href: "/etsy/orders", label: "Siparişlerim", icon: ClipboardList },
  { href: "/etsy/stores", label: "Mağazalarım", icon: Store },
];

export default function EtsyLayout({ children }: { children: React.ReactNode }) {
  const { status, data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
        <Loader2 className="h-8 w-8 animate-spin text-[#f1641e]" />
      </div>
    );
  }

  const email = session?.user?.email ?? "";

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <Link href="/etsy" className="flex items-center gap-2.5 px-5 py-6 mb-2">
        <LogoMark size={32} className="flex-shrink-0" />
        <div className="leading-none">
          <p className="text-sm font-black text-[#f8fafc] flex items-center gap-1.5">
            Lean Automation
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: ETSY_ACCENT }} />
          </p>
          <p className="text-[10px] text-[#64748b] mt-1">Etsy Paneli</p>
        </div>
      </Link>

      {/* Ana Sayfa (leanautomation.pro'ya dön) */}
      <Link
        href="/"
        className="flex items-center px-5 py-2.5 text-sm font-medium text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#111827] transition"
      >
        <Home className="mr-2.5 w-4 h-4" /> Ana Sayfa
      </Link>

      <div className="mx-5 my-2 border-t border-[#1e293b]" />

      {/* Navigasyon */}
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center px-5 py-2.5 text-sm font-medium w-full text-left transition",
              active
                ? "bg-[#f1641e]/10 text-[#f1641e] font-semibold border-r-2 border-[#f1641e]"
                : "text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#111827]"
            )}
          >
            <Icon className="mr-2.5 w-4 h-4 flex-shrink-0" />
            {item.label}
          </Link>
        );
      })}

      <div className="flex-1" />

      {/* Kullanıcı + Çıkış */}
      <div className="px-5 py-3 border-t border-[#1e293b]">
        <div className="text-xs text-[#64748b] truncate mb-2">{email}</div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center text-sm font-medium text-red-400 hover:bg-red-400/5 -mx-2 px-2 py-1.5 rounded-lg transition w-full text-left"
        >
          <LogOut className="mr-2.5 w-4 h-4" /> Çıkış Yap
        </button>
      </div>
    </div>
  );

  return (
    <EtsyDataProvider email={email || null}>
      <div className="min-h-screen bg-[#0a0e1a] text-[#e2e8f0]">
        {/* Mobil menü butonu */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#111827] border border-[#1e293b] rounded-lg text-[#94a3b8] hover:text-white"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/60 z-30" onClick={() => setMobileOpen(false)} />
        )}

        {/* Masaüstü sidebar */}
        <aside className="hidden lg:flex w-[220px] bg-[#0c1322] border-r border-[#1e293b] flex-col fixed left-0 top-0 bottom-0 z-40 overflow-y-auto">
          {sidebarContent}
        </aside>

        {/* Mobil sidebar */}
        <aside
          className={cn(
            "lg:hidden fixed left-0 top-0 bottom-0 w-[220px] bg-[#0c1322] border-r border-[#1e293b] z-40 flex flex-col transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="pt-14 flex-1 flex flex-col min-h-0">{sidebarContent}</div>
        </aside>

        {/* İçerik */}
        <main className="relative lg:ml-[220px] min-h-screen p-6 lg:p-8">
          <div
            className="fixed top-0 right-0 w-[45vw] h-[45vh] pointer-events-none -z-0"
            style={{ background: `radial-gradient(ellipse at top right, ${ETSY_ACCENT}14 0%, transparent 65%)` }}
          />
          <div className="relative z-10">{children}</div>
        </main>
      </div>
    </EtsyDataProvider>
  );
}
