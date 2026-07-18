"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Admin paneli — pazar-seçicili menü.
// Üst sıra: pazar sekmeleri (eBay / Amazon / Etsy / Genel).
// Alt sıra: seçili pazarın kendi linkleri. Sayfalar yerinde kalır,
// sadece hangi linklerin gösterileceği seçili sekmeye göre değişir.

type SectionKey = "ebay" | "amazon" | "shopify" | "etsy" | "genel";

interface NavLink {
  href: string;
  label: string;
  exact?: boolean;
  notif?: boolean; // okunmamış bildirim rozeti gösterilsin mi
}

interface Section {
  key: SectionKey;
  label: string;
  color: string;
  links: NavLink[];
}

const SECTIONS: Section[] = [
  {
    key: "ebay",
    label: "eBay",
    color: "#3b82f6",
    links: [
      { href: "/admin", label: "Panel", exact: true },
      { href: "/admin/fulfillment", label: "Sipariş Havuzu" },
      { href: "/admin/stock-health", label: "Stok Sağlığı" },
      { href: "/admin/depot", label: "Depo" },
    ],
  },
  {
    key: "amazon",
    label: "Amazon",
    color: "#22c55e",
    links: [{ href: "/admin/amazon", label: "Panel", exact: true }],
  },
  {
    key: "shopify",
    label: "Shopify",
    color: "#96bf48",
    links: [{ href: "/admin/shopify", label: "Panel", exact: true }],
  },
  {
    key: "etsy",
    label: "Etsy",
    color: "#ec4899",
    links: [{ href: "/admin/etsy", label: "Panel", exact: true }],
  },
  {
    key: "genel",
    label: "Genel",
    color: "#7c3aed",
    links: [
      { href: "/admin/user-stores", label: "Müşteri Mağazaları" },
      { href: "/admin/coupons", label: "Kuponlar" },
      { href: "/admin/affiliates", label: "Ortaklar" },
      { href: "/admin/notifications", label: "Bildirimler", notif: true },
      { href: "/admin/api-setup", label: "API Kurulumu" },
    ],
  },
];

/** Aktif pazarı adres yolundan çözer. Eşleşme yoksa eBay varsayılan. */
function resolveSection(pathname: string): SectionKey {
  if (pathname.startsWith("/admin/amazon")) return "amazon";
  if (pathname.startsWith("/admin/shopify")) return "shopify";
  if (pathname.startsWith("/admin/etsy")) return "etsy";
  const genelPrefixes = [
    "/admin/user-stores",
    "/admin/coupons",
    "/admin/affiliates",
    "/admin/notifications",
    "/admin/api-setup",
  ];
  if (genelPrefixes.some((p) => pathname.startsWith(p))) return "genel";
  return "ebay";
}

export function AdminNav({ unreadNotifs }: { unreadNotifs: number }) {
  const pathname = usePathname();
  const activeKey = resolveSection(pathname);
  const activeSection = SECTIONS.find((s) => s.key === activeKey) ?? SECTIONS[0];

  return (
    <div className="bg-slate-900 border-b border-slate-700/50">
      {/* Üst sıra: pazar seçici + logo + kullanıcı paneli linki */}
      <div className="px-6 pt-3 flex items-center gap-2">
        <span className="font-bold text-violet-400 mr-2">Admin</span>
        {SECTIONS.map((s) => {
          const isActive = s.key === activeKey;
          const firstHref = s.links[0].href;
          return (
            <Link
              key={s.key}
              href={firstHref}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors",
                isActive ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
              style={isActive ? { background: `${s.color}22`, border: `1px solid ${s.color}55`, color: s.color } : undefined}
            >
              {s.label}
            </Link>
          );
        })}
        <a href="/dashboard" className="ml-auto text-sm text-slate-500 hover:text-white transition-colors">
          Kullanıcı Paneli
        </a>
      </div>

      {/* Alt sıra: seçili pazarın linkleri */}
      <nav className="px-6 py-2.5 flex items-center gap-5">
        {activeSection.links.map((l) => {
          const isActive = l.exact ? pathname === l.href : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "text-sm transition-colors flex items-center gap-1.5",
                isActive ? "text-white font-semibold" : "text-slate-300 hover:text-white"
              )}
              style={isActive ? { color: activeSection.color } : undefined}
            >
              {l.label}
              {l.notif && unreadNotifs > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                  {unreadNotifs}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
