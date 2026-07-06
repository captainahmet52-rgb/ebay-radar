"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

// recharts ağır bir kütüphane — stat kartları anında görünsün, grafikler
// arkadan gelsin diye tembel yüklenir (ssr:false server component'te
// kullanılamadığı için bu ince client sarmalayıcı gerekli).
const AdminCharts = dynamic(() => import("./AdminCharts").then((m) => m.AdminCharts), {
  ssr: false,
  loading: () => (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid #30363d",
        borderRadius: 12,
        height: 320,
      }}
    />
  ),
});

export function AdminChartsLazy(props: ComponentProps<typeof AdminCharts>) {
  return <AdminCharts {...props} />;
}
