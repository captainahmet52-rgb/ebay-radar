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
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
