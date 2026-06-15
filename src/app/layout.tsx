import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "OtoBot | Amazon, eBay ve Etsy Pazar Yeri Otomasyonu",
  description:
    "Amazon, eBay ve Etsy satıcıları için tam otomasyonlu yapay zeka destekli platform. Listeleme, sipariş, stok ve müşteri iletişimini tek yerden yönetin.",
  keywords: ["ebay", "amazon", "etsy", "otomasyon", "pazar yeri", "saas", "dropshipping"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans bg-slate-950 text-white antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
