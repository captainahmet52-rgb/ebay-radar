// Radar → Amazon deposu intake doğrulaması (saf, prisma'sız — test edilebilir).
// Tek bozuk ürün 500'lük partinin TAMAMINI reddetmesin diye ürün başına doğrulanır;
// geçerliler kaydedilir, geçersizler aliId'leriyle Radar'a geri bildirilir.
import { z } from "zod";

export const AmazonDepotItemSchema = z.object({
  aliId: z.string().min(1).max(64),
  title: z.string().min(1),
  category: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  aliCostUsd: z.number().positive(),
  aliShippingUsd: z.number().min(0),
  aliOrders: z.number().int().min(0),
  aliRating: z.number().min(0).max(5),
  amazonBsr: z.number().int().min(0).nullable().optional(),
  amazonSalesEst: z.number().int().min(0).nullable().optional(),
  amazonSellerCount: z.number().int().min(0).nullable().optional(),
  amazonSoldByAmazon: z.boolean().optional(),
  radarScore: z.number().min(0).max(100),
  sourceChannel: z.enum(["amazon", "shopify"]).optional(),
});

export type AmazonDepotIntakeItem = z.infer<typeof AmazonDepotItemSchema>;

export const MAX_INTAKE_BATCH = 500;

export interface IntakeRejection {
  aliId: string | null;
  reason: string;
}

/** Geçerli ürünleri ayırır (aynı aliId tekrar ederse sonuncusu kalır), geçersizleri raporlar. */
export function partitionIntakeItems(raw: readonly unknown[]): {
  valid: AmazonDepotIntakeItem[];
  rejected: IntakeRejection[];
} {
  const byId = new Map<string, AmazonDepotIntakeItem>();
  const rejected: IntakeRejection[] = [];

  for (const item of raw) {
    const parsed = AmazonDepotItemSchema.safeParse(item);
    if (parsed.success) {
      byId.set(parsed.data.aliId, parsed.data);
      continue;
    }
    const issue = parsed.error.issues[0];
    rejected.push({
      aliId: extractAliId(item),
      reason: issue ? `${issue.path.join(".") || "ürün"}: ${issue.message}` : "geçersiz ürün",
    });
  }

  return { valid: [...byId.values()], rejected };
}

function extractAliId(item: unknown): string | null {
  if (typeof item !== "object" || item === null) return null;
  const id = (item as { aliId?: unknown }).aliId;
  return typeof id === "string" && id.length > 0 ? id : null;
}
