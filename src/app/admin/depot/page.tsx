"use client";
import { useState } from "react";
import useSWR from "swr";

interface DepotProduct {
  id: string;
  asin: string;
  title: string | null;
  imageUrl: string | null;
  amazonPrice: number | null;
  calculatedEbayPrice: number | null;
  status: string;
  createdAt: string;
  sourceStore: { ebayUsername: string } | null;
  _count: { distributions: number };
}

interface DepotResponse {
  data: DepotProduct[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const fetcher = (url: string) => fetch(url).then(r => r.json()) as Promise<DepotResponse>;

export default function AdminDepotPage() {
  const [page, setPage] = useState(1);
  const [clearing, setClearing] = useState(false);
  const { data, isLoading, mutate } = useSWR<DepotResponse>(
    `/api/admin/depot?page=${page}&limit=50`,
    fetcher
  );

  async function clearDepot() {
    if (!confirm("TÜM depo ürünleri silinecek (dağıtımlar dahil). Gerçek müşteri listeleri etkilenmez. Emin misin?")) {
      return;
    }
    setClearing(true);
    try {
      const res = await fetch("/api/admin/depot/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Hata ${res.status}`);
      alert(`Depo sıfırlandı: ${j.deleted} ürün silindi.`);
      setPage(1);
      await mutate();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Sıfırlama başarısız");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Urun Deposu</h1>
        <button
          onClick={clearDepot}
          disabled={clearing}
          className="text-sm px-3 py-2 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50"
        >
          {clearing ? "Siliniyor…" : "Depoyu Sıfırla"}
        </button>
      </div>

      {/* Meta bilgi */}
      {data && (
        <div className="mb-4 text-slate-400 text-sm">
          Toplam {data.meta.total} urun | Sayfa {data.meta.page} / {data.meta.totalPages}
        </div>
      )}

      <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Yukleniyor...</div>
        ) : !data?.data.length ? (
          <div className="p-8 text-center text-slate-400">Depoda henuz urun yok.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 text-slate-400">
                <th className="text-left p-4">Gorsel</th>
                <th className="text-left p-4">ASIN</th>
                <th className="text-left p-4">Baslik</th>
                <th className="text-left p-4">Kaynak Magaza</th>
                <th className="text-right p-4">Amazon Fiyati</th>
                <th className="text-right p-4">Hesaplanan eBay</th>
                <th className="text-right p-4">Dagilim</th>
                <th className="text-right p-4">Eklenme</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map(product => (
                <tr key={product.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="p-3">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt={product.title ?? product.asin}
                        className="w-12 h-12 rounded-lg object-cover bg-slate-800 border border-slate-700/50"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700/50 flex items-center justify-center text-slate-600 text-xs">
                        yok
                      </div>
                    )}
                  </td>
                  <td className="p-4 font-mono text-violet-300 text-xs">{product.asin}</td>
                  <td className="p-4 text-slate-300 max-w-xs truncate">
                    {product.title ?? "-"}
                  </td>
                  <td className="p-4 text-slate-400">
                    {product.sourceStore?.ebayUsername ?? "-"}
                  </td>
                  <td className="p-4 text-right text-slate-300">
                    {product.amazonPrice != null ? `$${product.amazonPrice.toFixed(2)}` : "-"}
                  </td>
                  <td className="p-4 text-right text-emerald-400">
                    {product.calculatedEbayPrice != null
                      ? `$${product.calculatedEbayPrice.toFixed(2)}`
                      : "-"}
                  </td>
                  <td className="p-4 text-right text-slate-400">
                    {product._count.distributions}
                  </td>
                  <td className="p-4 text-right text-slate-500 text-xs">
                    {new Date(product.createdAt).toLocaleDateString("tr-TR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sayfalama */}
      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm disabled:opacity-50 transition-colors"
          >
            Onceki
          </button>
          <span className="text-slate-400 text-sm">
            {page} / {data.meta.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))}
            disabled={page === data.meta.totalPages}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm disabled:opacity-50 transition-colors"
          >
            Sonraki
          </button>
        </div>
      )}
    </div>
  );
}
