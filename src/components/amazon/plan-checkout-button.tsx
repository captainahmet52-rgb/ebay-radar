"use client";

import { useState } from "react";
import { AMZ_ACCENT } from "@/components/amazon/shared";

interface AmazonPlanCheckoutButtonProps {
  plan: string;
  // Hangi hesap için (Mağazalarım'dan gelen ?account=). Yoksa backend tek hesabı seçer.
  accountId?: string;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}

/**
 * Paket "Satın Al" butonu (eBay'deki PlanCheckoutButton'ın Amazon karşılığı) —
 * /api/amazon/checkout'a POST atıp dönen Lemon Squeezy ödeme sayfasına yönlendirir.
 */
export function AmazonPlanCheckoutButton({ plan, accountId, className, style, label }: AmazonPlanCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function buy() {
    setLoading(true);
    try {
      const res = await fetch("/api/amazon/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, amazonAccountId: accountId }),
      });
      const j = await res.json();
      if (res.ok && j.url) {
        window.location.href = j.url;
        return;
      }
      if (j.needStorePick) {
        alert(j.error);
        window.location.href = "/amazon/stores";
        return;
      }
      alert(j.error ?? "Ödeme başlatılamadı.");
    } catch {
      alert("Bir hata oluştu, tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={buy} disabled={loading} className={className} style={style ?? (!className ? { background: AMZ_ACCENT } : undefined)}>
      {loading ? "Yönlendiriliyor…" : label ?? "Satın Al"}
    </button>
  );
}
