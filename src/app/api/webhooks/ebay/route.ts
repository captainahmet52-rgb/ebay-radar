import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOrderQueue } from "@/lib/queues";

interface EbayOrderWebhookBody {
  orderId?: string;
  lineItems?: Array<{ sku?: string; listingId?: string }>;
  buyer?: { username?: string };
  totalAmount?: { value?: string };
  // eBay'in gerçek payload yapısına göre genişletilebilir
  metadata?: {
    topic?: string;
    orderId?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const verificationToken = req.headers.get("x-ebay-signature");
    const expectedToken = process.env.EBAY_WEBHOOK_VERIFICATION_TOKEN;

    // Token yapılandırılmamışsa isteği reddet — boş token bypass'ına izin verme
    if (!expectedToken) {
      console.error("[webhooks/ebay] EBAY_WEBHOOK_VERIFICATION_TOKEN tanımlı değil");
      return NextResponse.json({ error: "Webhook yapılandırılmamış" }, { status: 500 });
    }

    if (verificationToken !== expectedToken) {
      return NextResponse.json({ error: "Yetkisiz webhook" }, { status: 401 });
    }

    const body = await req.json() as EbayOrderWebhookBody;

    // eBay order ID ve listing ID çıkar
    const ebayOrderId =
      body.orderId ??
      body.metadata?.orderId ??
      null;

    // lineItems'dan SKU veya listing ID al
    const sku = body.lineItems?.[0]?.sku ?? null;
    const ebayListingIdFromWebhook = body.lineItems?.[0]?.listingId ?? null;

    if (!ebayOrderId) {
      // Bilinmeyen event türü olabilir — 200 döndür, işleme
      return NextResponse.json({ received: true });
    }

    // Listing'i DB'de bul
    let listingId: string | null = null;

    if (ebayListingIdFromWebhook) {
      const listing = await prisma.listing.findFirst({
        where: { ebayListingId: ebayListingIdFromWebhook },
        select: { id: true, userId: true },
      });
      listingId = listing?.id ?? null;
    } else if (sku) {
      // SKU formatı: EBAY-{ASIN}
      const asin = sku.replace(/^EBAY-/, "");
      const product = await prisma.product.findUnique({
        where: { asin },
        select: { id: true },
      });
      if (product) {
        const listing = await prisma.listing.findFirst({
          where: { productId: product.id },
          select: { id: true, userId: true },
        });
        listingId = listing?.id ?? null;
      }
    }

    if (!listingId) {
      // Listing bulunamadı — kayıt al ve 200 döndür
      console.warn(`[ebay webhook] listing bulunamadı — ebayOrderId: ${ebayOrderId}`);
      return NextResponse.json({ received: true });
    }

    // Listing'in userId'sini al
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { userId: true },
    });

    if (!listing) {
      return NextResponse.json({ received: true });
    }

    // Order kaydı oluştur (pending)
    const order = await prisma.order.create({
      data: {
        userId: listing.userId,
        listingId,
        ebayOrderId,
        fulfillmentStatus: "pending",
      },
    });

    // BullMQ kuyruğuna doğrulama job'ı ekle
    await verifyOrderQueue.add(
      "verify-order",
      { orderId: order.id },
      {
        jobId: `verify-order-${order.id}`,
        attempts: 2,
      }
    );

    // Webhook'a hızlı 200 dön (timeout < 3sn)
    return NextResponse.json({ received: true, orderId: order.id });
  } catch (err) {
    console.error("[webhooks/ebay POST]", err);
    // Webhook'larda 500 dönme — eBay tekrar gönderir, sonsuz döngü olabilir
    return NextResponse.json({ received: true });
  }
}
