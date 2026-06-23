"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Store, Plus, CheckCircle, Power, Trash2, Upload, Crown, AlertCircle,
} from "lucide-react";

interface EbayAccountMeta {
  id: string;
  ebayUserId: string;
  marketplace: string;
  isActive: boolean;
  activatedAt: string | null;
  createdAt: string;
}

interface AccountsResponse {
  data: EbayAccountMeta[];
  meta: { storeLimit: number; activeCount: number; plan: string | null };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function marketLabel(marketplace: string): string {
  const map: Record<string, string> = {
    EBAY_US: "🇺🇸 ABD", EBAY_GB: "🇬🇧 İngiltere", EBAY_DE: "🇩🇪 Almanya", EBAY_AU: "🇦🇺 Avustralya",
  };
  return map[marketplace] ?? marketplace.replace("EBAY_", "");
}

export default function StoresPage() {
  const router = useRouter();
  const { data, mutate, isLoading } = useSWR<AccountsResponse>("/api/ebay/accounts", fetcher);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const accounts = data?.data ?? [];
  const storeLimit = data?.meta?.storeLimit ?? 0;
  const activeCount = data?.meta?.activeCount ?? 0;

  async function connectStore() {
    setConnecting(true);
    try {
      const res = await fetch("/api/ebay/connect");
      const j = await res.json();
      if (j.url) window.location.href = j.url;
      else throw new Error();
    } catch {
      alert("eBay bağlantısı başlatılamadı. Tekrar dene.");
      setConnecting(false);
    }
  }

  async function activate(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/ebay/accounts/${id}/activate`, { method: "POST" });
      const j = await res.json();
      if (res.ok) {
        mutate();
      } else if (j.needUpgrade) {
        // Limit dolu / paket yok → paketler sayfasına yönlendir
        if (confirm(`${j.error}\n\nPaketler sayfasına gidilsin mi?`)) {
          router.push("/dashboard/pricing");
        }
      } else {
        alert(j.error ?? "Aktifleştirilemedi.");
      }
    } catch {
      alert("Bir hata oluştu.");
    } finally {
      setBusyId(null);
    }
  }

  async function deactivate(id: string) {
    if (!confirm("Bu mağazayı pasifleştirmek istediğine emin misin? Otomasyon durur.")) return;
    setBusyId(id);
    try {
      await fetch(`/api/ebay/accounts/${id}/activate`, { method: "DELETE" });
      mutate();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Bu mağazayı tamamen kaldırmak istediğine emin misin? Bağlı ürünler de silinir.")) return;
    setBusyId(id);
    try {
      await fetch(`/api/ebay/accounts/${id}`, { method: "DELETE" });
      mutate();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Store className="h-6 w-6 text-violet-400" /> Mağazalarım
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            eBay mağazalarını bağla, aktifleştir ve yönet.
          </p>
        </div>
        <Button onClick={connectStore} loading={connecting}>
          <Plus className="h-4 w-4" /> Mağaza Ekle
        </Button>
      </div>

      {/* Aktif mağaza özeti */}
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          Aktif mağaza: <span className="font-bold text-white">{activeCount} / {storeLimit}</span>
        </div>
        {activeCount >= storeLimit && (
          <Link href="/dashboard/pricing" className="text-xs text-violet-400 hover:underline flex items-center gap-1">
            <Crown className="h-3.5 w-3.5" /> Paket yükselt
          </Link>
        )}
      </Card>

      {/* Mağaza listesi */}
      {isLoading ? (
        <p className="text-slate-400 text-sm">Yükleniyor…</p>
      ) : accounts.length === 0 ? (
        <Card className="p-10 text-center">
          <Store className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">Henüz mağaza yok</p>
          <p className="text-sm text-slate-500 mt-1 mb-4">eBay mağazanı bağlayarak başla.</p>
          <Button onClick={connectStore} loading={connecting}>
            <Plus className="h-4 w-4" /> İlk Mağazanı Ekle
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map((a) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-white">{a.ebayUserId}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{marketLabel(a.marketplace)}</p>
                  </div>
                  {a.isActive ? (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Aktif
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-500/15 text-slate-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Pasif
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {a.isActive ? (
                    <>
                      <Link href="/dashboard/products">
                        <Button size="sm">
                          <Upload className="h-3.5 w-3.5" /> Ürün Yükle
                        </Button>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => deactivate(a.id)} loading={busyId === a.id}>
                        <Power className="h-3.5 w-3.5" /> Pasifleştir
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => activate(a.id)} loading={busyId === a.id}>
                      <CheckCircle className="h-3.5 w-3.5" /> Aktifleştir
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(a.id)} loading={busyId === a.id}
                    className="text-red-400 hover:bg-red-500/10 ml-auto">
                    <Trash2 className="h-3.5 w-3.5" /> Kaldır
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Bilgi notu */}
      <Card className="p-4 flex items-start gap-2 text-xs text-slate-400">
        <AlertCircle className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <span>
          Sadece <span className="text-white font-medium">aktif</span> mağazalara ürün yüklenir ve otomatik
          listeleme (radar) çalışır. Pasif mağazalar bağlı kalır ama otomasyona dahil olmaz. Daha fazla aktif
          mağaza için paketini yükselt.
        </span>
      </Card>
    </div>
  );
}
