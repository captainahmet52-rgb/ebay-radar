"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";

// Sekmeye her dönüşte oturum + tüm SWR verilerinin yeniden çekilmesi hem
// sunucuyu yoruyor hem gezinmeyi yavaşlatıyordu. Veriler dakikalar içinde
// değişen türden (sipariş/stok) — odakta otomatik tazeleme kapalı, kısa
// aralıklı çift istekler tekilleştiriliyor.
const swrConfig = {
  revalidateOnFocus: false,
  dedupingInterval: 10_000,
  errorRetryCount: 2,
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <SWRConfig value={swrConfig}>{children}</SWRConfig>
    </SessionProvider>
  );
}
