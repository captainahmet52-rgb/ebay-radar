"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { PRO_PLUS_PLANS } from "@/lib/plans";
import { AmazonPlanCheckoutButton } from "@/components/amazon/plan-checkout-button";
import { AMZ_ACCENT } from "@/components/amazon/shared";

const PRO_PLUS_FEATURES = [
  "1 Amazon satıcı hesabı",
  "AliExpress → Amazon otomatik oto-yükleme",
  "Pazar başına özel kâr marjı (KDV + gümrük dahil hesaplanır)",
  "Amazon radar ile sürekli yeni ürün keşfi",
  "Satışta otomatik AliExpress sipariş (oto-buy)",
  "Sipariş + takip kodu yöneticisi",
  "US + UK + BAE + Suudi pazarları",
  "Canlı destek",
] as const;

/** Yüksek hacimli satıcılar için "AmazonBot Pro+" kartı — eBay'in ProPlusCard'ı ile aynı desen. */
export function AmazonProPlusCard({ accountId }: { accountId?: string }) {
  const [idx, setIdx] = useState(0);
  const plan = PRO_PLUS_PLANS[idx];

  return (
    <div className="rounded-2xl border p-6 md:p-8"
      style={{ borderColor: `${AMZ_ACCENT}66`, background: `linear-gradient(135deg, ${AMZ_ACCENT}1a 0%, rgba(15,23,42,0.3) 100%)` }}>
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <div className="space-y-4">
          <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full text-black"
            style={{ background: AMZ_ACCENT }}>
            AmazonBot Pro+
          </span>
          <div>
            <h3 className="text-white font-bold text-xl">AmazonBot Pro+ Paketi</h3>
            <p className="text-slate-400 text-sm mt-1">
              En üst seviye AliExpress→Amazon dropshipping — yüksek hacimli satıcılar için.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Ürün limiti seç:</label>
            <select
              value={idx}
              onChange={(e) => setIdx(Number(e.target.value))}
              className="w-full rounded-xl bg-slate-900/80 border border-slate-700 text-white text-sm px-3 py-2.5 outline-none"
            >
              {PRO_PLUS_PLANS.map((p, i) => (
                <option key={p.id} value={i}>
                  {p.productLimit.toLocaleString("tr-TR")} ürün — ${p.priceMonthly.toFixed(2)}/ay
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-1 pt-1">
            <span className="text-3xl font-extrabold text-white">${plan.priceMonthly.toFixed(2)}</span>
            <span className="text-slate-400 text-sm pb-1">/ay</span>
          </div>

          <AmazonPlanCheckoutButton
            plan={plan.id}
            accountId={accountId}
            label="Satın Al"
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-black transition-all disabled:opacity-60"
            style={{ background: AMZ_ACCENT }}
          />
        </div>

        <ul className="space-y-2.5">
          <li className="flex items-start gap-2 text-sm text-slate-200">
            <Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: AMZ_ACCENT }} />
            <span className="font-semibold text-white">
              {plan.productLimit.toLocaleString("tr-TR")} ürün yükleme limiti
            </span>
          </li>
          <li className="flex items-start gap-2 text-sm text-slate-200">
            <Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: AMZ_ACCENT }} />
            <span>Günde {plan.uploadDailyLimit.toLocaleString("tr-TR")} otomatik yükleme</span>
          </li>
          {PRO_PLUS_FEATURES.map((feat) => (
            <li key={feat} className="flex items-start gap-2 text-sm text-slate-300">
              <Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: AMZ_ACCENT }} />
              <span>{feat}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
