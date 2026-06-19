"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Store, Package, ShoppingCart, AlertTriangle, ArrowRight, Loader2, Plus, Settings as SettingsIcon } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { AMZ_ACCENT } from "@/components/amazon/shared";

interface Listing {
  id: string; market: string; salePrice: number | null; currentQty: number;
  status: string; publishStage: string | null;
  product: { title: string | null; aliId: string };
}

const MARKET_SYMBOL: Record<string, string> = { us: "$", uk: "£", ae: "AED ", sa: "SAR " };
const stagger = { animate: { transition: { staggerChildren: 0.08 } } };

export default function AmazonPanelPage() {
  const [accounts, setAccounts] = useState(0);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsCount, setListingsCount] = useState(0);
  const [orders, setOrders] = useState(0);
  const [riskOrders, setRiskOrders] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [acc, l, o] = await Promise.all([
      fetch("/api/amazon/accounts").then((r) => r.json()).catch(() => null),
      fetch("/api/amazon/listings").then((r) => r.json()).catch(() => null),
      fetch("/api/amazon/orders").then((r) => r.json()).catch(() => null),
    ]);
    setAccounts(acc?.data?.length ?? 0);
    setListings(l?.listings ?? []);
    setListingsCount(l?.total ?? 0);
    const ords = o?.orders ?? [];
    setOrders(ords.length);
    setRiskOrders(ords.filter((x: { status: string }) => x.status === "risk").length);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      {/* Başlık + hızlı aksiyonlar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="text-2xl md:text-3xl font-black flex items-center gap-2">
            AmazonBot Paneli <span className="w-2 h-2 rounded-full" style={{ background: AMZ_ACCENT }} />
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="text-slate-400 text-sm mt-1.5 max-w-xl">
            Mağazanı bağla, kurallarını ayarla — sistem depodan uygun ürünleri otomatik listeler, fiyatlar ve siparişleri yönetir.
          </motion.p>
        </div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5">
          <Link href="/amazon/stores"
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-black transition-transform hover:scale-[1.03]"
            style={{ background: AMZ_ACCENT }}>
            <Plus className="h-4 w-4" /> Mağaza Bağla
          </Link>
          <Link href="/amazon/settings"
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-slate-300 hover:text-white transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <SettingsIcon className="h-4 w-4" /> Ayarlar
          </Link>
        </motion.div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-slate-400 py-24 justify-center">
          <Loader2 className="h-6 w-6 animate-spin" /> Yükleniyor...
        </div>
      ) : (
        <>
          {/* İstatistikler (count-up) */}
          <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="Mağazalarım" value={accounts} icon={<Store />} color="green" delay={0} />
            <StatsCard title="Listelemelerim" value={listingsCount} icon={<Package />} color="green" delay={0.1} />
            <StatsCard title="Siparişler" value={orders} icon={<ShoppingCart />} color="blue" delay={0.2} />
            <StatsCard title="Riskli Sipariş" value={riskOrders} icon={<AlertTriangle />} color="amber" delay={0.3} />
          </motion.div>

          {accounts === 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
              style={{ background: `${AMZ_ACCENT}0d`, border: `1px solid ${AMZ_ACCENT}33` }}>
              <p className="text-sm text-slate-200">
                Başlamak için bir Amazon mağazası bağla, sonra Ayarlar&apos;dan oto-yüklemeyi aç.
              </p>
              <Link href="/amazon/stores" className="rounded-lg px-4 py-2 text-sm font-semibold text-black flex items-center gap-1.5 flex-shrink-0"
                style={{ background: AMZ_ACCENT }}>
                Mağaza bağla <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          )}

          {/* Son listelemeler */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Son listelemelerim</h2>
              <Link href="/amazon/products" className="text-sm text-slate-400 hover:text-white flex items-center gap-1">
                Tümü <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {listings.length === 0 ? (
              <p className="text-slate-500 text-sm py-10 text-center rounded-xl"
                style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)" }}>
                Henüz listeleme yok. Mağaza bağlayıp oto-yüklemeyi açınca ürünler otomatik listelenecek.
              </p>
            ) : (
              <div className="space-y-2.5">
                {listings.slice(0, 6).map((l, i) => {
                  const sym = MARKET_SYMBOL[l.market] ?? "$";
                  return (
                    <motion.div key={l.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.05 }} whileHover={{ x: 3 }}
                      className="rounded-xl p-4 flex items-center justify-between gap-4 transition-colors hover:border-emerald-500/30"
                      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <p className="text-sm font-medium min-w-0 truncate">{l.product.title ?? l.product.aliId}</p>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {l.market.toUpperCase()}{l.salePrice != null ? ` · ${sym}${l.salePrice.toFixed(2)}` : ""} · {l.status}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
