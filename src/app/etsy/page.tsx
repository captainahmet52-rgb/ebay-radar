"use client";

import Link from "next/link";
import {
  Store, Package, ShoppingBag, AlertTriangle, ArrowRight, Grid3X3, Wrench, Plus, Check,
} from "lucide-react";
import { EtsyReady, useEtsyData } from "@/components/etsy/shared";
import { StatsCard } from "@/components/etsy/ui";
import { cn } from "@/lib/utils";
import type { EtsyOverview } from "@/types/etsyflow";

/** listflow.pro "Kontrol Merkezi" sayfası — gerçek EtsyFlow verisiyle. */
export default function EtsyDashboardPage() {
  const { email } = useEtsyData();

  return (
    <EtsyReady>
      {(data) => {
        const activeStores = data.stores.filter((s) => s.status === "active").length;
        const waiting = data.products.filter((p) => p.upload_status === "waiting").length;
        const uploaded = data.products.filter((p) => p.upload_status === "uploaded").length;
        const newOrders = data.orders.filter((o) => o.status === "new").length;
        const inactiveStores = data.stores.length - activeStores;

        const checklist = buildChecklist(data);
        const completedCount = checklist.filter((i) => i.completed).length;
        const firstName = (email ?? "").split("@")[0];

        return (
          <div className="p-6 max-w-7xl mx-auto">
            {/* Başlık */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider border border-[#1e1e2e] px-2 py-0.5 rounded-md">
                    KONTROL MERKEZİ
                  </span>
                  <span className="text-xs font-medium text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/20 px-2 py-0.5 rounded-md">
                    CANLI
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">
                  Tekrar hoş geldin{firstName ? `, ${firstName}` : ""}.
                </h1>
                <p className="text-[#a0a0b0] text-sm max-w-xl">
                  Mağazanı tek ekrandan yönet ve sıradaki kritik adımı anında gör.
                </p>
              </div>

              <div className="flex flex-col gap-2 lg:items-end">
                <div className="flex items-center gap-2 bg-[#12121a] border border-[#1e1e2e] rounded-lg px-4 py-2">
                  <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                  <span className="text-xs text-[#a0a0b0]">MAĞAZA SAĞLIĞI:</span>
                  <span className="text-xs font-bold text-[#10b981]">
                    {activeStores}/{data.stores.length}
                  </span>
                  <span className="text-xs text-[#6b6b80]">Yayına hazır aktif mağaza</span>
                </div>
                <div className="flex items-center gap-2 bg-[#12121a] border border-[#1e1e2e] rounded-lg px-4 py-2">
                  <span className="text-xs text-[#a0a0b0]">YÜKLEME KUYRUĞU:</span>
                  <span className="text-xs font-bold text-white">{waiting}</span>
                  <span className="text-xs text-[#6b6b80]">Eklenti için hazır ürün</span>
                </div>
              </div>
            </div>

            {/* İstatistikler */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatsCard
                title="MAĞAZALAR"
                value={data.stores.length}
                subtitle={data.stores.length === 0 ? "Henüz mağaza eklenmedi" : `${activeStores} aktif`}
                icon={Store}
                iconColor="text-[#8b5cf6]"
                accentColor="bg-[#8b5cf6]/10"
              />
              <StatsCard
                title="ÜRÜNLER"
                value={data.products.length}
                subtitle={data.products.length === 0 ? "Henüz ürün üretilmedi" : `${uploaded} Etsy'de yayında`}
                icon={Package}
                iconColor="text-[#06b6d4]"
                accentColor="bg-[#06b6d4]/10"
              />
              <StatsCard
                title="SİPARİŞLER"
                value={data.orders.length}
                subtitle={`${newOrders} yeni sipariş`}
                icon={ShoppingBag}
                iconColor="text-[#10b981]"
                accentColor="bg-[#10b981]/10"
              />
              <StatsCard
                title="DİKKAT"
                value={inactiveStores}
                subtitle={inactiveStores === 0 ? "Her şey yolunda" : `${inactiveStores} pasif mağaza`}
                icon={AlertTriangle}
                iconColor="text-yellow-400"
                accentColor="bg-yellow-400/10"
              />
            </div>

            {/* Ana içerik */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Yapılacaklar */}
              <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-1">
                  Seni ileri taşıyacak sonraki adımlar
                </h2>
                <div className="flex items-center gap-2 mb-6">
                  <div className="flex-1 bg-[#1e1e2e] rounded-full h-1.5">
                    <div
                      className="bg-gradient-to-r from-[#06b6d4] to-[#8b5cf6] h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${(completedCount / checklist.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-[#6b6b80] flex-shrink-0">
                    {completedCount}/{checklist.length}
                  </span>
                </div>
                <div>
                  {checklist.map((item, idx) => (
                    <ChecklistRow key={item.label} {...item} isLast={idx === checklist.length - 1} />
                  ))}
                </div>
              </div>

              {/* Mağaza durumu */}
              <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-1">Mağazalarının bugünkü durumu</h2>
                <p className="text-xs text-[#6b6b80] mb-5">Tüm mağazalarının anlık otomasyon durumu</p>
                {data.stores.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-10 h-10 rounded-full bg-[#1e1e2e] flex items-center justify-center mb-3">
                      <Store className="w-5 h-5 text-[#6b6b80]" />
                    </div>
                    <p className="text-sm text-[#6b6b80] mb-3">Henüz mağaza eklenmedi.</p>
                    <Link
                      href="/etsy/stores"
                      className="inline-flex items-center gap-1.5 text-xs text-[#8b5cf6] hover:text-[#a78bfa] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Mağaza ekle
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {data.stores.map((store) => {
                      const cfg =
                        store.status === "active"
                          ? { label: "AKTİF", cls: "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20" }
                          : { label: "PASİF", cls: "bg-red-400/10 text-red-400 border-red-400/20" };
                      const productCount = data.products.filter((p) => p.store_id === store.id).length;
                      return (
                        <div
                          key={store.id}
                          className="flex items-center justify-between py-3 px-4 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#8b5cf6]/10 flex items-center justify-center">
                              <ShoppingBag className="w-4 h-4 text-[#8b5cf6]" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{store.name}</div>
                              <div className="text-xs text-[#6b6b80]">
                                {store.category ?? "—"}
                                {store.sub_category ? ` · ${store.sub_category}` : ""} · {productCount} ürün
                              </div>
                            </div>
                          </div>
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-md border", cfg.cls)}>
                            {cfg.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Hızlı bağlantılar */}
            <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6">
              <h2 className="text-base font-semibold text-white mb-4">Hızlı Bağlantılar</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <QuickLink href="/etsy/kategoriler" icon={Grid3X3} label="Kategorileri İncele" color="#8b5cf6" />
                <QuickLink href="/etsy/stores" icon={Wrench} label="Mağazaları Yönet" color="#06b6d4" />
                <QuickLink href="/etsy/products" icon={Package} label="Ürün Kuyruğunu Aç" color="#10b981" />
              </div>
            </div>
          </div>
        );
      }}
    </EtsyReady>
  );
}

function buildChecklist(data: EtsyOverview) {
  const hasStore = data.stores.length > 0;
  const hasProduct = data.products.length > 0;
  const hasUploaded = data.products.some((p) => p.upload_status === "uploaded");
  const hasOrder = data.orders.length > 0;
  return [
    { label: "İlk mağazanı oluştur", completed: hasStore, href: "/etsy/stores", buttonLabel: "MAĞAZALARA GİT" },
    { label: "Otomasyon ilk ürününü üretsin", completed: hasProduct, href: "/etsy/products", buttonLabel: "ÜRÜNLERİ AÇ" },
    { label: "Eklentiyle Etsy'ye yükle", completed: hasUploaded, href: "/etsy/products", buttonLabel: "KUYRUĞU GÖR" },
    { label: "İlk siparişini al", completed: hasOrder, href: "/etsy/orders", buttonLabel: "SİPARİŞLERİ AÇ" },
  ];
}

function ChecklistRow({
  label, completed, href, buttonLabel, isLast,
}: {
  label: string; completed: boolean; href: string; buttonLabel: string; isLast?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 relative">
      {!isLast && (
        <div className="absolute left-4 top-8 w-px bg-[#1e1e2e]" style={{ height: "calc(100% - 8px)" }} />
      )}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 z-10",
          completed ? "bg-[#10b981] border-[#10b981]" : "bg-[#12121a] border-[#1e1e2e]"
        )}
      >
        {completed ? (
          <Check className="w-4 h-4 text-white" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-[#6b6b80]" />
        )}
      </div>
      <div className="flex-1 flex items-center justify-between pb-4 min-w-0">
        <span className={cn("text-sm font-medium", completed ? "text-[#6b6b80] line-through" : "text-white")}>
          {label}
        </span>
        <Link
          href={href}
          className="ml-3 flex-shrink-0 text-xs font-medium text-[#8b5cf6] hover:text-[#a78bfa] border border-[#8b5cf6]/30 hover:border-[#8b5cf6]/60 px-2.5 py-1 rounded-md transition-all duration-150 whitespace-nowrap"
        >
          {buttonLabel}
        </Link>
      </div>
    </div>
  );
}

function QuickLink({
  href, icon: Icon, label, color,
}: {
  href: string; icon: React.ElementType; label: string; color: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between p-4 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg transition-all duration-150 group hover:border-[#8b5cf6]/50"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}1a` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-sm font-medium text-white">{label}</span>
      </div>
      <ArrowRight className="w-4 h-4 text-[#6b6b80] group-hover:text-[#8b5cf6] transition-colors" />
    </Link>
  );
}
