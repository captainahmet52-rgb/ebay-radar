// Mevcut eBay ilanlarını içe aktarma orkestratörü.
//
// İKİ FAZLI (maliyet kontrolü için kritik):
//   1) KEŞİF (runDiscovery): Trading API ile satıcının TÜM aktif ilanlarını çek.
//      Sadece eBay çağrısı — scraper maliyeti YOK. SKU'dan ASIN ayıkla:
//        ASIN yok  → matchStatus "unmatched" (Amazon'a hiç bakma)
//        ASIN var  → matchStatus "pending"   (doğrulama bekliyor)
//   2) DOĞRULAMA (verifyMatch): SADECE ASIN'li ilanlar için Amazon'dan veri çek
//      ve SIFIR HATA motoruyla (decideMatch) karar ver. Scraper maliyeti burada,
//      sayıca sınırlı (ASIN'li alt küme) ve kademeli yapılır.
//
// GÖLGE MODU: Hiçbir ilan otomatik fiyatlanmaz/dokunulmaz. trackingEnabled=false
// kalır; satıcı panelden "takibi aç" diyene kadar her şey salt-okunur.

import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/lib/ebay/oauth";
import { fetchActiveListingsPage } from "@/lib/ebay/trading";
import { extractAsinFromSku, decideMatch } from "@/lib/ebay/asin-matcher";
import { fetchAmazonProduct } from "@/lib/scraper";
import { pollProductQueue, verifyImportMatchQueue } from "@/lib/queues";
import { getPlan } from "@/lib/plans";
import type { ParsedEbayListing } from "@/lib/ebay/trading-parser";

// eBay marketplace → Amazon kaynak pazarı (en iyi tahmin; satıcı sonra değiştirebilir)
const MARKETPLACE_TO_AMAZON: Record<string, string> = {
  EBAY_US: "US",
  EBAY_GB: "UK",
  EBAY_DE: "DE",
  EBAY_CA: "CA",
};

function amazonMarketFor(marketplace: string): string {
  return MARKETPLACE_TO_AMAZON[marketplace] ?? "US";
}

export interface DiscoveredClassification {
  detectedAsin: string | null;
  // pending → ASIN var, Amazon doğrulaması bekliyor
  // unmatched → SKU'da ASIN yok, asla otomatik eşleşmez
  matchStatus: "pending" | "unmatched";
  matchReason: string;
}

/**
 * Keşif anındaki sınıflandırma (SAF — ağ yok). SKU'da ASIN var mı?
 * Bu noktada Amazon'a HENÜZ bakılmaz; sadece doğrulanmaya değer mi belirlenir.
 */
export function classifyDiscovered(listing: ParsedEbayListing): DiscoveredClassification {
  const asin = extractAsinFromSku(listing.ebaySku);
  if (!asin) {
    return {
      detectedAsin: null,
      matchStatus: "unmatched",
      matchReason: "SKU'da ASIN yok — otomatik eşleşme yapılamaz",
    };
  }
  return {
    detectedAsin: asin,
    matchStatus: "pending",
    matchReason: "ASIN bulundu — Amazon doğrulaması bekliyor",
  };
}

// ─── 1) KEŞİF ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 200;

/**
 * Bir ListingImport için satıcının tüm aktif ilanlarını çeker ve ImportedListing
 * satırları olarak kaydeder. Scraper kullanmaz. Sayfa imleci (pageCursor) ile
 * yarıda kalırsa devam edebilir. Tamamlanınca status "completed" (veya "failed").
 */
export async function runDiscovery(importId: string): Promise<void> {
  const imp = await prisma.listingImport.findUnique({ where: { id: importId } });
  if (!imp) throw new Error(`ListingImport bulunamadı: ${importId}`);

  const account = await prisma.ebayAccount.findUnique({ where: { id: imp.ebayAccountId } });
  if (!account) throw new Error(`EbayAccount bulunamadı: ${imp.ebayAccountId}`);

  const amazonMarket = amazonMarketFor(account.marketplace);
  const ebaySite = account.marketplace;

  await prisma.listingImport.update({
    where: { id: importId },
    data: { status: "fetching", startedAt: imp.startedAt ?? new Date(), error: null },
  });

  let accessToken: string;
  try {
    accessToken = await getValidToken(imp.ebayAccountId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.listingImport.update({
      where: { id: importId },
      data: { status: "failed", error: `Token alınamadı: ${msg}`, finishedAt: new Date() },
    });
    throw err;
  }

  let page = imp.pageCursor ?? 1;
  let totalPages = imp.totalPages ?? 1;
  let processed = imp.processedListings;

  try {
    do {
      // Uzun import (binlerce ilan, yüzlerce sayfa) token ömrünü (2sa) aşabilir →
      // her 20 sayfada bir token'ı tazele (getValidToken gerekiyorsa yeniler).
      if (page > 1 && page % 20 === 0) {
        accessToken = await getValidToken(imp.ebayAccountId);
      }

      const result = await fetchActiveListingsPage({
        accessToken,
        marketplace: account.marketplace,
        pageNumber: page,
        entriesPerPage: PAGE_SIZE,
      });

      if (result.ack === "Failure") {
        const detail = result.errors.join("; ") || "bilinmeyen Trading API hatası";
        throw new Error(detail);
      }

      totalPages = result.totalPages ?? totalPages;

      for (const listing of result.listings) {
        const cls = classifyDiscovered(listing);
        await prisma.importedListing.upsert({
          where: {
            ebayAccountId_ebayItemId: {
              ebayAccountId: imp.ebayAccountId,
              ebayItemId: listing.ebayItemId,
            },
          },
          create: {
            userId: imp.userId,
            ebayAccountId: imp.ebayAccountId,
            ebayItemId: listing.ebayItemId,
            ebaySku: listing.ebaySku,
            title: listing.title,
            price: listing.price,
            currency: listing.currency,
            quantity: listing.quantityAvailable,
            imageUrl: listing.imageUrl,
            ebaySite,
            detectedAsin: cls.detectedAsin,
            amazonMarket,
            matchStatus: cls.matchStatus,
            matchReason: cls.matchReason,
          },
          update: {
            // Re-import: eBay tarafı tazelensin; eşleşme durumu pending/unmatched'e RESET
            // edilmez eğer zaten doğrulanmışsa (confirmed/review korunur).
            ebaySku: listing.ebaySku,
            title: listing.title,
            price: listing.price,
            currency: listing.currency,
            quantity: listing.quantityAvailable,
            imageUrl: listing.imageUrl,
          },
        });
        processed += 1;
      }

      // İlerleme + imleç kaydet (yarıda kesilirse buradan devam)
      page += 1;
      await prisma.listingImport.update({
        where: { id: importId },
        data: { processedListings: processed, pageCursor: page, totalPages },
      });
    } while (page <= totalPages);

    // Sayaçları tazele (unmatched / pending dağılımı)
    const [unmatched, pending] = await Promise.all([
      prisma.importedListing.count({ where: { ebayAccountId: imp.ebayAccountId, matchStatus: "unmatched" } }),
      prisma.importedListing.count({ where: { ebayAccountId: imp.ebayAccountId, matchStatus: "pending" } }),
    ]);

    await prisma.listingImport.update({
      where: { id: importId },
      data: {
        status: "completed",
        totalListings: processed,
        unmatchedCount: unmatched,
        finishedAt: new Date(),
        pageCursor: null,
      },
    });

    // Keşif bitti → ASIN'li ("pending") ilanları OTOMATİK doğrulamaya al. Doğrulamada
    // "confirmed" çıkanlar verifyMatch içinde OTOMATİK stok takibine girer. Maliyet plan
    // kotasıyla (productLimit) sınırlı. Hata olsa bile keşif "completed" kalır (yalnız logla).
    try {
      await enqueueVerificationForAccount(imp.ebayAccountId);
    } catch (err) {
      console.error(`[listing-import] otomatik doğrulama kuyruğa alınamadı (${importId}):`, err);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.listingImport.update({
      where: { id: importId },
      data: { status: "failed", error: msg.slice(0, 500), processedListings: processed, pageCursor: page },
    });
    throw err;
  }
}

// ─── 2) DOĞRULAMA ────────────────────────────────────────────────────────────────

/**
 * Tek bir ImportedListing'i Amazon'dan doğrular (SCRAPER MALİYETİ burada).
 * SADECE detectedAsin olanlar için anlamlı. decideMatch ile confirmed/review kararı.
 * Bu fonksiyon HİÇBİR şeyi otomatik fiyatlamaz/yayınlamaz — yalnız eşleşmeyi işaretler.
 */
export async function verifyMatch(importedListingId: string): Promise<void> {
  const il = await prisma.importedListing.findUnique({ where: { id: importedListingId } });
  if (!il) throw new Error(`ImportedListing bulunamadı: ${importedListingId}`);

  if (!il.detectedAsin) {
    // ASIN yok → doğrulanacak bir şey yok, unmatched'te kalır.
    return;
  }

  // Amazon'dan çek. Kota/rate-limit gibi GEÇİCİ hatalar fırlatılır → çağıran (worker)
  // retry eder; "review"a düşürmeyiz (yoksa kota bitince tüm ilanlar yanlışlıkla review olur).
  // Ürün gerçekten yoksa fetchAmazonProduct fırlatmaz; price/title boş döner → decideMatch
  // doğal olarak "review" verir (asla körlemesine confirm yok).
  const scraped = await fetchAmazonProduct(il.detectedAsin, il.amazonMarket);
  const amazon = { asin: il.detectedAsin, title: scraped.title, price: scraped.price };

  const decision = decideMatch(
    { sku: il.ebaySku, ebayTitle: il.title ?? "", ebayPrice: il.price },
    amazon
  );

  await prisma.importedListing.update({
    where: { id: importedListingId },
    data: {
      matchStatus: decision.status, // confirmed | review | unmatched
      matchConfidence: decision.confidence,
      matchReason: decision.reason,
    },
  });

  // SIFIR HATA confirm → OTOMATİK stok/fiyat takibine al (Product + legacy Listing + ilk poll).
  // "review" (şüpheli) ve "unmatched" (ASIN yok) ASLA otomatik takibe alınmaz: yanlış ürünü
  // takip etmek gerçek eBay ilanını bozar (oversell/yanlış fiyat). Bunlar panelde bekler.
  if (decision.status === "confirmed") {
    try {
      await enableTracking(importedListingId);
    } catch (err) {
      console.error(`[listing-import] otomatik takip açılamadı (${importedListingId}):`, err);
    }
  }

  // Import sayaçlarını tazele (en güncel dağılım panelde görünsün)
  await refreshImportCounters(il.ebayAccountId);
}

// ─── 3) OTOMATİK ZİNCİR YARDIMCILARI ─────────────────────────────────────────────

/**
 * Keşif bittikten sonra "pending" (ASIN'li) ilanları doğrulama kuyruğuna alır.
 * Scraper maliyeti plan productLimit ile SINIRLI (zaten confirmed olanlar kotadan düşülür).
 * Otomatik akış (mağaza bağlanınca) ve manuel /verify aynı çekirdek mantığı paylaşır.
 * @returns kuyruğa eklenen ilan sayısı.
 */
export async function enqueueVerificationForAccount(
  ebayAccountId: string,
  opts?: { limit?: number }
): Promise<number> {
  const account = await prisma.ebayAccount.findUnique({
    where: { id: ebayAccountId },
    select: { userId: true },
  });
  if (!account) return 0;

  const user = await prisma.user.findUnique({
    where: { id: account.userId },
    select: { plan: true },
  });
  const productLimit = getPlan(user?.plan ?? "starter")?.productLimit ?? 300;

  const confirmedCount = await prisma.importedListing.count({
    where: { ebayAccountId, matchStatus: "confirmed" },
  });
  const remainingQuota = Math.max(0, productLimit - confirmedCount);
  const cap = Math.min(opts?.limit ?? remainingQuota, remainingQuota);
  if (cap <= 0) return 0;

  const pending = await prisma.importedListing.findMany({
    where: { ebayAccountId, matchStatus: "pending" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: cap,
  });

  await Promise.all(
    pending.map((p) =>
      verifyImportMatchQueue.add(
        "verify-import-match",
        { importedListingId: p.id },
        { jobId: `verify-import-match:${p.id}` }
      )
    )
  );
  return pending.length;
}

/**
 * Bir ImportedListing'i stok/fiyat takibine alır: ASIN deposunda Product upsert +
 * legacy Listing oluştur/aktif et + ilk poll'u tetikle. SADECE confirmed + ASIN'li.
 * Idempotent (zaten takipteyse mevcut productId döner). Hem otomatik akış (verifyMatch)
 * hem manuel route bu fonksiyonu kullanır → mantık tek yerde.
 * @returns oluşturulan/bulunan productId; koşul sağlanmazsa null.
 */
export async function enableTracking(importedListingId: string): Promise<string | null> {
  const il = await prisma.importedListing.findUnique({ where: { id: importedListingId } });
  if (!il) return null;
  if (il.matchStatus !== "confirmed" || !il.detectedAsin) return null;
  if (il.trackingEnabled && il.linkedProductId) return il.linkedProductId; // zaten takipte

  const asin = il.detectedAsin;
  const productId = await prisma.$transaction(async (tx) => {
    const product = await tx.product.upsert({
      where: { asin },
      create: {
        asin,
        title: il.title,
        imageUrl: il.imageUrl,
        amazonMarket: il.amazonMarket,
        status: "active",
      },
      update: { status: "active" },
    });

    const existing = await tx.listing.findFirst({
      where: { ebayAccountId: il.ebayAccountId, ebayListingId: il.ebayItemId },
      select: { id: true },
    });

    let listingId: string;
    if (existing) {
      await tx.listing.update({
        where: { id: existing.id },
        data: {
          status: "active",
          isLegacy: true,
          ebaySku: il.ebaySku,
          currentPrice: il.price,
          currentQty: il.quantity ?? 1,
        },
      });
      listingId = existing.id;
    } else {
      const created = await tx.listing.create({
        data: {
          userId: il.userId,
          productId: product.id,
          ebayAccountId: il.ebayAccountId,
          ebayListingId: il.ebayItemId, // legacy ItemID
          ebaySku: il.ebaySku,
          isLegacy: true,
          ebaySite: il.ebaySite,
          currentPrice: il.price,
          currentQty: il.quantity ?? 1,
          publishStage: "published",
          status: "active",
        },
        select: { id: true },
      });
      listingId = created.id;
    }

    await tx.importedListing.update({
      where: { id: il.id },
      data: {
        trackingEnabled: true,
        linkedProductId: product.id,
        linkedListingId: listingId,
      },
    });

    return product.id;
  });

  // İlk taramayı hemen tetikle (Amazon'dan taze fiyat/stok → eBay'e yansıt)
  await pollProductQueue.add(
    "poll-product",
    { productId },
    { jobId: `poll-product:${productId}` }
  );

  return productId;
}

/** Mağazanın en güncel eşleşme dağılımını (confirmed/review/unmatched) son import'a yazar. */
async function refreshImportCounters(ebayAccountId: string): Promise<void> {
  const latest = await prisma.listingImport.findFirst({
    where: { ebayAccountId },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return;

  const [confirmed, review, unmatched] = await Promise.all([
    prisma.importedListing.count({ where: { ebayAccountId, matchStatus: "confirmed" } }),
    prisma.importedListing.count({ where: { ebayAccountId, matchStatus: "review" } }),
    prisma.importedListing.count({ where: { ebayAccountId, matchStatus: "unmatched" } }),
  ]);

  await prisma.listingImport.update({
    where: { id: latest.id },
    data: { confirmedCount: confirmed, reviewCount: review, unmatchedCount: unmatched },
  });
}
