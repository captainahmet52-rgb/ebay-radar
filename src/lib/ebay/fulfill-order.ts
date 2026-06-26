/**
 * eBay sipariş kargolama akışı — İKİ AŞAMA.
 *
 * 1) claimTrackingForOrder: cüzdandan $0.43 rezerve → TrackCaptain'dan GEÇERLİ takip
 *    no al → kaydet + kullanıcıya göster (REVEAL). eBay'e HENÜZ yüklemez.
 *    Hata olursa cüzdan iade edilir.
 * 2) pushTrackingToEbay: kullanıcı "eBay'e Gönder" deyince kayıtlı numarayı
 *    müşterinin eBay mağazasına (OAuth token'ıyla) yükler → "kargolandı".
 *
 * fulfillEbayOrder = ikisini arka arkaya çağırır (eski otomatik akış / verify-order için).
 *
 * Sahibin TrackCaptain kredisi biterse veya müşteri cüzdanı yetersizse admin'e bildirim.
 * Token/secret loglanmaz.
 */

import { prisma } from "@/lib/prisma";
import { convertTracking, TRACKING_CONVERSION_FEE_USD } from "@/lib/tracking";
import { createShippingFulfillment } from "@/lib/ebay/fulfillment";
import { TrackCaptainOutOfCreditsError } from "@/lib/trackcaptain";
import { notifyInsufficientBalance, notifyTrackCaptainOutOfCredits } from "@/lib/admin-notify";

/** Müşteri cüzdanı kargolama ücretine yetmiyor. */
export class InsufficientWalletError extends Error {
  constructor() {
    super("Yetersiz bakiye — kargolama yapılamadı");
    this.name = "InsufficientWalletError";
  }
}

/** TrackCaptain carrier adını eBay'in beklediği koda çevirir. */
function ebayCarrierCode(carrier: string): string {
  const c = carrier.toLowerCase();
  if (c.includes("usps")) return "USPS";
  if (c.includes("fedex")) return "FedEx";
  if (c.includes("ups")) return "UPS";
  return carrier.toUpperCase();
}

export interface ClaimResult {
  trackingNumber: string;
  carrierCode: string;
}

export interface FulfillResult {
  trackingNumber: string;
  carrierCode: string;
}

/**
 * 1. AŞAMA — Takip numarası üret (TrackCaptain) + cüzdandan $0.43 düş + kaydet.
 * eBay'e YÜKLEMEZ; numarayı döndürür (kullanıcı ekranında gösterilir).
 * Idempotent: numara zaten üretilmişse tekrar ücret almaz, mevcut numarayı döndürür.
 * @throws InsufficientWalletError | TrackCaptainOutOfCreditsError | Error
 */
export async function claimTrackingForOrder(orderId: string): Promise<ClaimResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Sipariş bulunamadı");

  // Zaten üretilmiş → tekrar ücret alma (idempotent)
  if (order.trackingNumber) {
    return { trackingNumber: order.trackingNumber, carrierCode: order.carrierCode ?? "usps" };
  }
  if (!order.ebayOrderId || !order.ebayLineItemId) {
    throw new Error("eBay sipariş/satır bilgisi eksik — takip oluşturulamaz");
  }

  const FEE = TRACKING_CONVERSION_FEE_USD;

  // Ücreti rezerve et + borç kaydını AYNI transaction'da yaz. Böylece para hareketi
  // HER ZAMAN denetlenebilir (ledger'da iz kalır) — decrement sonrası kilitlenme
  // penceresinde "parası gitti ama kaydı yok" durumu olmaz. updateMany koşulu (yeterli
  // bakiye) atomik overdraft korumasını sağlar.
  const reserved = await prisma.$transaction(async (tx) => {
    const r = await tx.user.updateMany({
      where: { id: order.userId, creditBalanceUsd: { gte: FEE } },
      data: { creditBalanceUsd: { decrement: FEE } },
    });
    if (r.count === 0) return false;
    await tx.creditTransaction.create({
      data: { userId: order.userId, amountUsd: -FEE, type: "tracking_conversion", refId: order.id, note: "eBay takip kodu üretimi" },
    });
    return true;
  });
  if (!reserved) {
    await notifyInsufficientBalance(order.userId, "takip kodu oluşturma").catch(() => {});
    throw new InsufficientWalletError();
  }

  try {
    const conv = await convertTracking(order.amazonTrackingNo ?? "", {
      city: order.shipToCity ?? undefined,
      state: order.shipToState ?? undefined,
      zip: order.shipToZip ?? undefined,
      country: order.shipToCountry ?? "US",
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        trackingNumber: conv.trackingNumber,
        carrierCode: conv.carrierCode,
        // Managed akıştaysa: numara hazır, eBay'e gönderilmeyi bekliyor
        ...(order.managedStatus
          ? { managedStatus: "awaiting_ebay_push", trackingChargePaidAt: new Date() }
          : {}),
      },
    });

    return { trackingNumber: conv.trackingNumber, carrierCode: conv.carrierCode };
  } catch (err) {
    // Hata → cüzdanı iade et + ledger
    await prisma.$transaction([
      prisma.user.update({ where: { id: order.userId }, data: { creditBalanceUsd: { increment: FEE } } }),
      prisma.creditTransaction.create({
        data: { userId: order.userId, amountUsd: FEE, type: "refund", refId: order.id, note: "Takip üretimi başarısız — iade" },
      }),
    ]);

    if (err instanceof TrackCaptainOutOfCreditsError) {
      await notifyTrackCaptainOutOfCredits(err.creditBalance).catch(() => {});
    }
    throw err;
  }
}

/**
 * 2. AŞAMA — Kayıtlı takip numarasını müşterinin eBay mağazasına yükler.
 * Idempotent: zaten yüklenmişse tekrar yüklemez. Ücret almaz (1. aşamada alındı);
 * bu yüzden eBay hatasında iade YOK — kullanıcı tekrar "eBay'e Gönder" diyebilir.
 * @throws Error
 */
export async function pushTrackingToEbay(orderId: string): Promise<FulfillResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { listing: { include: { ebayAccount: true } } },
  });
  if (!order) throw new Error("Sipariş bulunamadı");

  // Zaten yüklenmiş → idempotent
  if (order.ebayFulfillmentId || order.fulfillmentStatus === "fulfilled") {
    return { trackingNumber: order.trackingNumber ?? "", carrierCode: order.carrierCode ?? "usps" };
  }
  if (!order.trackingNumber) {
    throw new Error("Önce takip kodu oluşturulmalı");
  }
  if (!order.ebayOrderId || !order.ebayLineItemId) {
    throw new Error("eBay sipariş/satır bilgisi eksik — kargo yüklenemez");
  }

  const account = order.listing.ebayAccount;

  const fulfillmentId = await createShippingFulfillment(
    account.id,
    order.ebayOrderId,
    order.trackingNumber,
    ebayCarrierCode(order.carrierCode ?? "usps"),
    order.ebayLineItemId
  );

  await prisma.order.update({
    where: { id: order.id },
    data: {
      ebayFulfillmentId: fulfillmentId,
      shippedAt: new Date(),
      fulfillmentStatus: "fulfilled",
      ...(order.managedStatus ? { managedStatus: "completed" } : {}),
    },
  });

  return { trackingNumber: order.trackingNumber, carrierCode: order.carrierCode ?? "usps" };
}

/**
 * Tek seferde kargola (eski otomatik akış / verify-order auto-fulfill için):
 * takip no üret → eBay'e yükle.
 * @throws InsufficientWalletError | TrackCaptainOutOfCreditsError | Error
 */
export async function fulfillEbayOrder(orderId: string): Promise<FulfillResult> {
  await claimTrackingForOrder(orderId);
  return pushTrackingToEbay(orderId);
}
