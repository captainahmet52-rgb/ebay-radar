// AI ürün GÖRSELLERİ — Shopify yüklemesinde AliExpress görseli OLDUĞU GİBİ gitmez:
// Nano Banana 3 profesyonel görsel üretir (stüdyo / kullanım sahnesi / yakın çekim,
// filigran-yazı temizlenir).
//
// ⚠️ SAHİBİN NET KURALI (2026-07-18): VİDEO BU AKIŞA DAHİL DEĞİL. Video, kullanıcının
// UGC Video panelinden KENDİ PARASIYLA (kredi cüzdanı) ürettiği AYRI bir üründür —
// yükleme akışı yalnız 3 görsel üretir, iki sistem BİRBİRİNE KARIŞMAZ.
//
// ORTAK DEPO EKONOMİSİ: görseller ÜRÜN BAŞINA BİR KEZ üretilip AmazonDepotProduct'a
// yazılır; aynı ürünü yükleyen sonraki tüm kullanıcılar hazır seti kullanır
// (maliyet kullanıcı sayısıyla ÇARPILMAZ). FAL_KEY yoksa veya üretim patlarsa
// orijinal görsele sessizce düşülür — yükleme asla durmaz.

import { fal } from "@fal-ai/client";
import { prisma } from "@/lib/prisma";

let configured = false;
function ensureConfig(): boolean {
  const key = process.env.FAL_KEY;
  if (!key) return false;
  if (!configured) {
    fal.config({ credentials: key });
    configured = true;
  }
  return true;
}

const IMAGE_PROMPTS = [
  "Professional e-commerce product photo of this exact product on a clean pure white studio background, soft natural shadows, centered composition. Remove all text, watermarks, logos and discount labels. Keep the product itself completely unchanged and realistic.",
  "This exact product placed in a realistic cozy home lifestyle setting, natural daylight, shallow depth of field, aspirational but authentic look. Remove all text, watermarks and logos. Keep the product itself completely unchanged and realistic.",
  "Premium close-up detail shot of this exact product on a neutral soft-gradient background, crisp focus on texture and details. Remove all text, watermarks and logos. Keep the product itself completely unchanged and realistic.",
];

async function generateImage(sourceUrl: string, prompt: string): Promise<string> {
  const result = await fal.subscribe("fal-ai/nano-banana/edit", {
    input: { prompt, image_urls: [sourceUrl], num_images: 1, output_format: "jpeg" },
  });
  const url = (result.data as { images?: { url?: string }[] })?.images?.[0]?.url;
  if (!url) throw new Error("Görsel üretimi boş döndü");
  return url;
}

export interface ProductMedia {
  imageUrls: string[]; // en az orijinal görsel
}

/**
 * Depo ürününün AI görsel setini döner — yoksa üretir ve depoya yazar.
 * Kısmi başarı kabul: 2 görsel çıktıysa 2 gider, hiç çıkmadıysa orijinal gider.
 */
export async function ensureProductMedia(depotProductId: string): Promise<ProductMedia> {
  const product = await prisma.amazonDepotProduct.findUnique({
    where: { id: depotProductId },
    select: { imageUrl: true, aiImageUrls: true },
  });

  const original = product?.imageUrl ?? null;
  const fallback: ProductMedia = { imageUrls: original ? [original] : [] };
  if (!original || !ensureConfig()) return fallback;

  // Önbellek: daha önce üretildiyse aynen kullan (ortak depo — maliyet 1 kez)
  const cached = (product?.aiImageUrls as string[] | null) ?? null;
  if (cached && cached.length > 0) {
    return { imageUrls: cached };
  }

  // 3 görsel paralel — patlayan atlanır
  const imageResults = await Promise.allSettled(
    IMAGE_PROMPTS.map((p) => generateImage(original, p))
  );
  const aiImages = imageResults
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => r.value);

  if (aiImages.length === 0) return fallback;

  await prisma.amazonDepotProduct
    .update({
      where: { id: depotProductId },
      data: { aiImageUrls: aiImages },
    })
    .catch(() => {});

  return { imageUrls: aiImages };
}
