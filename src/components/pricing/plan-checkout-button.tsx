"use client";

import { useState } from "react";

interface PlanCheckoutButtonProps {
  plan: string;
  // Hangi mağaza için (Mağazalarım'dan gelen ?store=). Yoksa backend tek mağazayı seçer.
  storeId?: string;
  className?: string;
  label?: string;
}

/**
 * Paket "Satın Al" butonu — /api/checkout'a POST atıp dönen Lemon Squeezy
 * ödeme sayfasına yönlendirir. Kart bilgisi tamamen LS'te; bize değmez.
 */
export function PlanCheckoutButton({ plan, storeId, className, label }: PlanCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function buy() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, ebayAccountId: storeId }),
      });
      const j = await res.json();
      if (res.ok && j.url) {
        window.location.href = j.url;
        return;
      }
      if (j.needStorePick) {
        alert(j.error);
        window.location.href = "/dashboard/stores";
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
    <button onClick={buy} disabled={loading} className={className}>
      {loading ? "Yönlendiriliyor…" : label ?? "Satın Al"}
    </button>
  );
}
