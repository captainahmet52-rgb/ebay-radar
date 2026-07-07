"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { PRO_PLUS_PLANS } from "@/lib/plans";

// Pro+ kartında gösterilen özellikler (ana paketlerle aynı dürüst set; limit/yükleme dinamik).
const PRO_PLUS_FEATURES = [
  "1 eBay mağazası",
  "Toplu ASIN yükleme + ASIN Grabber (Chrome)",
  "15 dk'ya kadar stok & fiyat takibi",
  "Otomatik repricer (hep %20 kâr)",
  "Sipariş-anı canlı doğrulama",
  "Oversell (fazla satış) koruması",
  "Sınırsız takip kodu",
  "Sipariş + ürün yöneticisi",
  "US + UK + Almanya pazarları",
  "Canlı destek",
] as const;

/**
 * Yüksek hacimli satıcılar için "eBay Pro+" kartı. Ana 5 paketin ALTINDA, ayrı tek kart.
 * Dropdown ile 15K / 20K limit seçilir; fiyat + günlük yükleme seçime göre güncellenir.
 * Buton şimdilik "Yakında Aktif" (Paddle entegrasyonu gelince checkout'a bağlanır).
 */
export function ProPlusCard() {
  const [idx, setIdx] = useState(0);
  const plan = PRO_PLUS_PLANS[idx];

  return (
    <div className="rounded-2xl border border-violet-500/40 bg-gradient-to-br from-violet-600/10 to-slate-800/30 p-6 md:p-8">
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        {/* Sol: başlık + limit seçimi + fiyat */}
        <div className="space-y-4">
          <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-violet-600 text-white">
            eBay Pro+
          </span>
          <div>
            <h3 className="text-white font-bold text-xl">eBay Pro+ Paketi</h3>
            <p className="text-slate-400 text-sm mt-1">
              En üst seviye eBay dropshipping — yüksek hacimli satıcılar için.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">eBay limiti seç:</label>
            <select
              value={idx}
              onChange={(e) => setIdx(Number(e.target.value))}
              className="w-full rounded-xl bg-slate-900/80 border border-slate-700 text-white text-sm px-3 py-2.5 outline-none focus:border-violet-500"
            >
              {PRO_PLUS_PLANS.map((p, i) => (
                <option key={p.id} value={i}>
                  {p.productLimit.toLocaleString("tr-TR")} ürün — ${p.priceMonthly.toFixed(2)}/ay
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-1 pt-1">
            <span className="text-3xl font-extrabold text-white">
              ${plan.priceMonthly.toFixed(2)}
            </span>
            <span className="text-slate-400 text-sm pb-1">/ay</span>
          </div>

          <button
            disabled
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-violet-600/70 text-white/70 cursor-not-allowed"
          >
            Yakında Aktif
          </button>
        </div>

        {/* Sağ: özellik listesi */}
        <ul className="space-y-2.5">
          <li className="flex items-start gap-2 text-sm text-slate-200">
            <Check className="h-4 w-4 text-violet-400 flex-shrink-0 mt-0.5" />
            <span className="font-semibold text-white">
              {plan.productLimit.toLocaleString("tr-TR")} ürün yükleme limiti
            </span>
          </li>
          <li className="flex items-start gap-2 text-sm text-slate-200">
            <Check className="h-4 w-4 text-violet-400 flex-shrink-0 mt-0.5" />
            <span>
              Günde {plan.uploadDailyLimit.toLocaleString("tr-TR")} otomatik yükleme
            </span>
          </li>
          {PRO_PLUS_FEATURES.map((feat) => (
            <li key={feat} className="flex items-start gap-2 text-sm text-slate-300">
              <Check className="h-4 w-4 text-violet-400 flex-shrink-0 mt-0.5" />
              <span>{feat}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
