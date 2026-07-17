"use client";

// ShopifyBot bölümü — etsy/layout.tsx ile aynı desen (kendi sidebar'ı olan ayrı panel).
// Veri sağlayıcısı henüz yok; backend (mağaza bağlama/depo/sipariş API'leri) geldikçe eklenecek.

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard, Store, Warehouse, ShoppingCart, Home, Loader2,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import { SHOPIFY_ACCENT } from "@/components/shopify/shared";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/shopify", label: "Panel", icon: LayoutDashboard, exact: true },
  { href: "/shopify/stores", label: "Mağazalar", icon: Store },
  { href: "/shopify/depot", label: "Depo", icon: Warehouse },
  { href: "/shopify/orders", label: "Siparişler", icon: ShoppingCart },
];

export default function ShopifyLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#050508" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: SHOPIFY_ACCENT }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ background: "#050508" }}>
      {/* Sidebar */}
      <aside
        className="fixed left-0 top-0 h-screen w-60 z-40 flex flex-col"
        style={{ background: "rgba(9,12,8,0.85)", backdropFilter: "blur(20px)", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <LogoMark size={32} />
          <div className="leading-none">
            <p className="font-black text-sm flex items-center gap-1.5">
              ShopifyBot <span className="w-1.5 h-1.5 rounded-full" style={{ background: SHOPIFY_ACCENT }} />
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Lean Automation</p>
          </div>
        </div>

        {/* Ana Sayfa */}
        <div className="px-3 pt-3">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <Home className="h-4 w-4" /> Ana Sayfa
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  active ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
                style={active ? { background: `${SHOPIFY_ACCENT}1a`, border: `1px solid ${SHOPIFY_ACCENT}33` } : undefined}
              >
                <Icon className="h-4 w-4" style={active ? { color: SHOPIFY_ACCENT } : undefined} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* İçerik */}
      <main className="ml-60 min-h-screen">
        {/* Arka plan parlaması */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden ml-60">
          <div className="absolute -top-32 right-0 w-[55vw] h-[60vh]"
            style={{ background: `radial-gradient(ellipse at top right, ${SHOPIFY_ACCENT}1f 0%, transparent 65%)` }} />
        </div>
        <div className="relative z-10 px-6 md:px-10 py-8">{children}</div>
      </main>
    </div>
  );
}
