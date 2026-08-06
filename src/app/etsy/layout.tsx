"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard, Grid3X3, Store, Package, ClipboardList, Home, Loader2,
  Zap, LogOut, Menu, X, ChevronUp, ChevronDown,
} from "lucide-react";
import { EtsyDataProvider } from "@/components/etsy/shared";
import { cn } from "@/lib/utils";

/** listflow.pro dashboard kabuğu — aynı menü yapısı, Etsy paneline uyarlandı. */
const NAV = [
  { href: "/etsy", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/etsy/kategoriler", label: "Kategoriler", icon: Grid3X3 },
  { href: "/etsy/stores", label: "Etsy Otomasyon", icon: Store },
  { href: "/etsy/products", label: "Ürünler", icon: Package },
  { href: "/etsy/orders", label: "Siparişlerim", icon: ClipboardList },
];

export default function EtsyLayout({ children }: { children: React.ReactNode }) {
  const { status, data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="h-8 w-8 animate-spin text-[#8b5cf6]" />
      </div>
    );
  }

  const email = session?.user?.email ?? "";
  const displayName = email || "Kullanıcı";
  const initials = (email || "LA").slice(0, 2).toUpperCase();

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#1e1e2e]">
        <Link href="/etsy" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-gradient-to-r from-[#06b6d4] to-[#8b5cf6] flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-base font-bold bg-gradient-to-r from-[#06b6d4] to-[#8b5cf6] bg-clip-text text-transparent">
              EtsyBot
            </span>
            <div className="text-[10px] text-[#6b6b80] uppercase tracking-wider">Lean Automation</div>
          </div>
        </Link>
      </div>

      {/* Ana Sayfa */}
      <div className="px-3 pt-3">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#a0a0b0] hover:text-white hover:bg-[#1e1e2e]/50 transition-all border border-[#1e1e2e]"
        >
          <Home className="w-4 h-4 text-[#6b6b80]" /> Ana Sayfa
        </Link>
      </div>

      {/* Navigasyon */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group relative overflow-hidden",
                active
                  ? "bg-[#8b5cf6]/10 text-[#8b5cf6] font-medium"
                  : "text-[#a0a0b0] hover:text-white hover:bg-[#1e1e2e]/50"
              )}
            >
              {active && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-to-b from-[#06b6d4] to-[#8b5cf6] rounded-l-full shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
              )}
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 transition-all duration-200",
                  active
                    ? "text-[#8b5cf6] drop-shadow-[0_0_6px_rgba(139,92,246,0.6)]"
                    : "text-[#6b6b80] group-hover:text-white group-hover:scale-110"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Profil */}
      <div className="px-3 pb-4 border-t border-[#1e1e2e]">
        {profileOpen && (
          <div className="pt-3 pb-2">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all font-medium"
            >
              <LogOut className="w-4 h-4" />
              Çıkış Yap
            </button>
          </div>
        )}
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-[#1e1e2e]/50 transition-all mt-1"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#06b6d4] to-[#8b5cf6] flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-medium text-white truncate">
              {displayName.length > 14 ? displayName.slice(0, 12) + "..." : displayName}
            </div>
            <div className="text-xs text-[#6b6b80] truncate">{email}</div>
          </div>
          {profileOpen ? (
            <ChevronUp className="w-4 h-4 text-[#6b6b80] flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#6b6b80] flex-shrink-0" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <EtsyDataProvider email={email || null}>
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        {/* Mobil menü butonu */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#12121a] border border-[#1e1e2e] rounded-lg text-[#a0a0b0] hover:text-white"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/60 z-30" onClick={() => setMobileOpen(false)} />
        )}

        {/* Masaüstü sidebar */}
        <aside className="hidden lg:flex w-[240px] bg-[#0d0d14] border-r border-[#1e1e2e] flex-col fixed left-0 top-0 bottom-0 z-40">
          {sidebarContent}
        </aside>

        {/* Mobil sidebar */}
        <aside
          className={cn(
            "lg:hidden fixed left-0 top-0 bottom-0 w-[240px] bg-[#0d0d14] border-r border-[#1e1e2e] z-40 flex flex-col transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="pt-14 flex-1 flex flex-col min-h-0">{sidebarContent}</div>
        </aside>

        {/* İçerik */}
        <main className="lg:ml-[240px] min-h-screen">{children}</main>
      </div>
    </EtsyDataProvider>
  );
}
