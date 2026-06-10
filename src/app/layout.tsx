import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "eBay Otomasyon | Amazon'dan Otomatik Kazan",
  description:
    "Amazon ürünlerini eBay'de otomatik listele, fiyatlandır ve sat. %20 net kâr garantili repricer motoru.",
  keywords: ["ebay", "amazon", "dropshipping", "otomasyon", "saas"],
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
