// Uygulama genelinde kullanılan TypeScript tipleri

export type PollTier = "hot" | "normal" | "dead";
export type UserRole = "user" | "admin";
export type StockStatus = "in_stock" | "low" | "out" | "unknown";
export type ListingStatus = "active" | "paused" | "ended";
export type FulfillmentStatus = "pending" | "verified" | "cancelled" | "fulfilled";
export type Plan = "free" | "pro" | "enterprise";

export interface ScraperResult {
  asin: string;
  title: string;
  imageUrl: string | null;
  price: number | null;
  stockStatus: StockStatus;
  stockQty: number | null;
}

export interface RepricerResult {
  amazonPrice: number;
  ebayPrice: number;
  ebayFee: number;
  netProfit: number;
  marginPct: number;
  recommendedQty: number;
}

// NextAuth Session augmentation'ı `src/types/next-auth.d.ts`'e taşındı (worker tsconfig'i
// bu dosyayı dahil ediyor ama next-auth'u yok → augmentation burada olunca worker kırılıyordu).
