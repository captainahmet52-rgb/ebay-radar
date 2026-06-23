/**
 * eBay sipariş kargolama akışı (otomatik).
 *
 * Akış: cüzdandan $0.43 rezerve → TrackCaptain'dan GEÇERLİ takip no al →
 * o numarayı müşterinin eBay mağazasına (OAuth token'ıyla) yükle → "kargolandı".
 * Hata olursa cüzdan iade edilir. Token/secret loglanmaz.
 *
 * Sahibin TrackCaptain kredisi biterse veya müşteri cüzdanı yetersizse admin'e bildirim.
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

export interface FulfillResult {
  trackingNumber: string;
  carrierCode: string;
}

/**
 * Bir eBay siparişini kargolar: takip no al → eBay'e yükle → kaydet.
 * @throws InsufficientWalletError | TrackCaptainOutOfCreditsError | Error
 */
export async function fulfillEbayOrder(orderId: string): Promise<FulfillResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { listing: { include: { ebayAccount: true } } },
  });

  if (!order) throw new Error("Sipariş bulunamadı");
  if (order.fulfillmentStatus === "fulfilled" || order.trackingNumber) {
    throw new Error("Sipariş zaten kargolandı");
  }
  if (!order.ebayOrderId || !order.ebayLineItemId) {
    throw new Error("eBay sipariş/satır bilgisi eksik — kargo yüklenemez");
  }

  const account = order.listing.ebayAccount;
  const FEE = TRACKING_CONVERSION_FEE_USD;

  // 1. Ücreti rezerve et — yalnızca yeterli bakiye varsa (atomik koşullu update)
  const reserve = await prisma.user.updateMany({
    where: { id: order.userId, creditBalanceUsd: { gte: FEE } },
    data: { creditBalanceUsd: { decrement: FEE } },
  });
  if (reserve.count === 0) {
    await notifyInsufficientBalance(order.userId, "eBay sipariş kargolama").catch(() => {});
    throw new InsufficientWalletError();
  }

  try {
    // 2. TrackCaptain'dan geçerli numara al (varış adresi yoksa ülke=US)
    const conv = await convertTracking("", { country: "US" });

    // 3. Müşterinin eBay mağazasına yükle
    const fulfillmentId = await createShippingFulfillment(
      account.id,
      order.ebayOrderId,
      conv.trackingNumber,
      ebayCarrierCode(conv.carrierCode),
      order.ebayLineItemId
    );

    // 4. Kaydet + ledger
    await prisma.$transaction([
      prisma.creditTransaction.create({
        data: { userId: order.userId, amountUsd: -FEE, type: "tracking_conversion", refId: order.id, note: "eBay sipariş kargo takip" },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: {
          trackingNumber: conv.trackingNumber,
          carrierCode: conv.carrierCode,
          ebayFulfillmentId: fulfillmentId,
          shippedAt: new Date(),
          fulfillmentStatus: "fulfilled",
        },
      }),
    ]);

    return { trackingNumber: conv.trackingNumber, carrierCode: conv.carrierCode };
  } catch (err) {
    // Hata → cüzdanı iade et + ledger
    await prisma.$transaction([
      prisma.user.update({ where: { id: order.userId }, data: { creditBalanceUsd: { increment: FEE } } }),
      prisma.creditTransaction.create({
        data: { userId: order.userId, amountUsd: FEE, type: "refund", refId: order.id, note: "Kargolama başarısız — iade" },
      }),
    ]);

    if (err instanceof TrackCaptainOutOfCreditsError) {
      await notifyTrackCaptainOutOfCredits(err.creditBalance).catch(() => {});
    }
    throw err;
  }
}
