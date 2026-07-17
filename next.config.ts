import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Hız / güvenlik
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // Modern formatlar — daha küçük görseller
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images-na.ssl-images-amazon.com" },
      { protocol: "https", hostname: "m.media-amazon.com" },
    ],
  },
  experimental: {
    // Büyük kütüphaneleri tree-shake et → daha küçük JS bundle
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts"],
  },
  // Prod'da console.log'ları üretim JS'inden çıkar (error/warn kalsın) — hız + temizlik
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  // Güvenlik + performans HTTP başlıkları
  async headers() {
    // Content-Security-Policy — XSS savunma derinliği. Next.js hidrasyon inline
    // script/style kullandığı için 'unsafe-inline' gerekli (nonce altyapısı yok);
    // yine de object/base/form/frame kısıtları dış-kaynak enjeksiyonunu engeller.
    // img/connect https: → Amazon/eBay görselleri + API çağrıları serbest.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    const securityHeaders = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    // Uygulama-içi sayfalar dizine girmesin (robots disallow tek başına indexlemeyi
    // engellemez — dış link ile yine indexlenebilir; X-Robots-Tag kesin çözüm).
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/dashboard/:path*", headers: noindex },
      { source: "/dashboard", headers: noindex },
      { source: "/admin/:path*", headers: noindex },
      { source: "/admin", headers: noindex },
      { source: "/amazon/:path*", headers: noindex },
      { source: "/amazon", headers: noindex },
      { source: "/etsy/:path*", headers: noindex },
      { source: "/etsy", headers: noindex },
      { source: "/shopify/:path*", headers: noindex },
      { source: "/shopify", headers: noindex },
      { source: "/login", headers: noindex },
      { source: "/register", headers: noindex },
      // Statik görseller / favicon uzun süre cache'lensin
      {
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff2)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
