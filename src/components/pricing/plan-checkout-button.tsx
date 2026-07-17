"use client";

import { openSupportChat } from "@/lib/open-support-chat";

interface PlanCheckoutButtonProps {
  plan: string;
  // Hangi mağaza için (Mağazalarım'dan gelen ?store=). Şimdilik kullanılmıyor;
  // ödeme sağlayıcısı bağlanınca checkout'a geri taşınacak.
  storeId?: string;
  className?: string;
  label?: string;
}

/**
 * Paket "Satın Al" butonu — ödeme sağlayıcısı YOK (Lemon Squeezy kaldırıldı,
 * 2026-07-17): buton canlı destek sohbetini açar, satın alma manuel yürütülür
 * (admin panelden aktivasyon). Sağlayıcı bağlanınca eski checkout akışı döner.
 */
export function PlanCheckoutButton({ className, label }: PlanCheckoutButtonProps) {
  return (
    <button onClick={openSupportChat} className={className}>
      {label ?? "Satın Al"}
    </button>
  );
}
