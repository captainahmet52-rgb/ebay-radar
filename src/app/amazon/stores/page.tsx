"use client";

import { useEffect, useState } from "react";
import { Loader2, Store, Trash2, Plus } from "lucide-react";
import { PageHeader, Card, Empty, AMZ_ACCENT } from "@/components/amazon/shared";

interface AmazonAccount {
  id: string;
  sellerId: string;
  market: string;
  createdAt: string;
  _count: { listings: number };
}

const MARKET_LABELS: Record<string, string> = {
  us: "🇺🇸 Amazon US",
  uk: "🇬🇧 Amazon UK",
  ae: "🇦🇪 Amazon BAE",
  sa: "🇸🇦 Amazon Suudi",
};

export default function AmazonStoresPage() {
  const [accounts, setAccounts] = useState<AmazonAccount[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/amazon/accounts");
    if (r.ok) setAccounts((await r.json()).data);
    else setMsg("Hesaplar yüklenemedi");
  }
  useEffect(() => { void load(); }, []);

  async function disconnect(id: string) {
    if (!confirm("Bu Amazon mağazasının bağlantısını kesmek istiyor musun? Listelemeleri de silinir.")) return;
    const r = await fetch(`/api/amazon/accounts/${id}`, { method: "DELETE" });
    if (r.ok) { setMsg("Mağaza bağlantısı kesildi."); await load(); }
    else setMsg((await r.json()).error ?? "Hata");
  }

  return (
    <>
      <PageHeader title="Mağazalarım" subtitle="Amazon satıcı hesaplarını bağla. Pazar (US/UK/BAE/Suudi) bağlanırken otomatik tespit edilir." />

      {/* Bağlama */}
      <Card pad="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-300 flex items-center gap-2">
            <Plus className="h-4 w-4" style={{ color: AMZ_ACCENT }} /> Yeni mağaza bağla:
          </span>
          <a
            href="/api/amazon/connect?region=na"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-black"
            style={{ background: AMZ_ACCENT }}
          >
            🇺🇸 Amazon US
          </a>
          <a
            href="/api/amazon/connect?region=eu"
            className="rounded-lg px-4 py-2 text-sm font-semibold border border-white/10 text-white hover:border-emerald-500/40"
          >
            🇬🇧🇦🇪🇸🇦 Amazon UK / BAE / Suudi
          </a>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          SP-API anahtarları bağlanınca yetkilendirme açılır. Hangi anahtar gerekli →{" "}
          <span style={{ color: AMZ_ACCENT }}>Admin → API Kurulumu</span>
        </p>
      </Card>

      {msg && <p className="text-sm text-slate-300 my-3">{msg}</p>}

      {/* Bağlı mağazalar */}
      <h2 className="text-lg font-bold mt-6 mb-3">Bağlı mağazalar</h2>
      {!accounts ? (
        <div className="flex items-center gap-3 text-slate-400 py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Yükleniyor...
        </div>
      ) : accounts.length === 0 ? (
        <Empty text="Henüz bağlı Amazon mağazan yok. Yukarıdan bir mağaza bağla." />
      ) : (
        <div className="space-y-2.5">
          {accounts.map((a) => (
            <Card key={a.id} pad="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${AMZ_ACCENT}1f`, border: `1px solid ${AMZ_ACCENT}33` }}>
                    <Store className="h-5 w-5" style={{ color: AMZ_ACCENT }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{MARKET_LABELS[a.market] ?? a.market}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Satıcı: {a.sellerId} · {a._count.listings} listeleme
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => disconnect(a.id)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Bağlantıyı kes"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
