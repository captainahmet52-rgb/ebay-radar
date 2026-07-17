"use client";

import { AMZ_ACCENT } from "@/components/amazon/shared";
import { openSupportChat } from "@/lib/open-support-chat";

interface AmazonPlanCheckoutButtonProps {
  plan: string;
  // Hangi hesap için (Mağazalarım'dan gelen ?account=). Şimdilik kullanılmıyor;
  // ödeme sağlayıcısı bağlanınca checkout'a geri taşınacak.
  accountId?: string;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}

/**
 * Paket "Satın Al" butonu (eBay'deki PlanCheckoutButton'ın Amazon karşılığı) —
 * ödeme sağlayıcısı YOK (Lemon Squeezy kaldırıldı, 2026-07-17): buton canlı
 * destek sohbetini açar, satın alma manuel yürütülür (admin panelden aktivasyon).
 */
export function AmazonPlanCheckoutButton({ className, style, label }: AmazonPlanCheckoutButtonProps) {
  return (
    <button
      onClick={openSupportChat}
      className={className}
      style={style ?? (!className ? { background: AMZ_ACCENT } : undefined)}
    >
      {label ?? "Satın Al"}
    </button>
  );
}
