import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyOrderQueue } from "@/lib/queues";
import {
  verifyEbayNotificationSignature,
  looksLikeEbaySignature,
} from "@/lib/ebay/notification-verify";

/** Sabit-zamanlı string karşılaştırma — uzunluk farkını da güvenli ele alır. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

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
    const signature = req.headers.get("x-ebay-signature");
    const rawBody = await req.text();

    // Gerçek eBay bildirimleri Base64-JSON (kid + ECDSA) imza gönderir →
    // HAM gövde üzerinde doğrula. Düz token eşitliği manuel/özel entegrasyon
    // için yedek yol olarak kalır.
    let verified = false;
    if (looksLikeEbaySignature(signature)) {
      verified = await verifyEbayNotificationSignature(rawBody, signature);
    } else {
      const expectedToken = process.env.EBAY_WEBHOOK_VERIFICATION_TOKEN;
      if (!expectedToken) {
        // Token yapılandırılmamışsa isteği reddet — boş token bypass'ına izin verme
        console.error("[webhooks/ebay] EBAY_WEBHOOK_VERIFICATION_TOKEN tanımlı değil");
        return NextResponse.json({ error: "Webhook yapılandırılmamış" }, { status: 500 });
      }
      verified = Boolean(signature) && safeEqual(signature!, expectedToken);
    }

    if (!verified) {
      return NextResponse.json({ error: "Yetkisiz webhook" }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as EbayOrderWebhookBody;

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

    // Listing'i DB'de bul.
    //
    // TENANT DOĞRULUĞU (kritik): Product global'dir — aynı ASIN'i birden çok
    // kullanıcı takip edebilir. Bu yüzden eşleştirmeyi mümkün olan en spesifik
    // tanımlayıcıyla yaparız:
    //   1) ebayListingId (her tenant'a özgü, marketplace ilan ID'si) — öncelik.
    //   2) SKU yoluna düşülürse: ASIN→Product→Listing eşleşmesi BİRDEN FAZLA
    //      tenant'a denk gelebilir. Tek listing garanti edilemiyorsa siparişi
    //      işleme ALMA + uyarı logla (yanlış kullanıcıya atfetmektense atla).
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
        // Bu ASIN'i takip eden tüm listing'leri çek. SKU tek başına tenant
        // ayıramaz; yalnızca BİR eşleşme varsa güvenle atfedebiliriz.
        const matches = await prisma.listing.findMany({
          where: { productId: product.id },
          select: { id: true },
          take: 2,
        });
        if (matches.length === 1) {
          listingId = matches[0].id;
        } else if (matches.length > 1) {
          // Belirsiz: aynı ASIN'i birden çok kullanıcı takip ediyor. Yanlış
          // atıf yapmaktansa işleme alma — listingId yapılan eşleştirmeden gelmeli.
          console.warn(
            `[ebay webhook] SKU belirsiz — aynı ASIN'i birden çok listing takip ediyor, sipariş atlandı. asin=${asin} ebayOrderId=${ebayOrderId}`
          );
        }
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

    // Dedup: aynı eBay siparişi zaten kayıtlıysa tekrar oluşturma (idempotent).
    // poll-orders ile aynı koruma — webhook + polling aynı siparişi yakalayabilir.
    const existing = await prisma.order.findFirst({
      where: { userId: listing.userId, ebayOrderId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ received: true, orderId: existing.id, duplicate: true });
    }

    // Order kaydı oluştur (pending). Yarış durumunda (userId, ebayOrderId) benzersiz
    // kısıtı ikinci create'i P2002 ile engeller → çift satır oluşmaz.
    let order: { id: string };
    try {
      order = await prisma.order.create({
        data: {
          userId: listing.userId,
          listingId,
          ebayOrderId,
          fulfillmentStatus: "pending",
        },
        select: { id: true },
      });
    } catch (createErr) {
      if (
        createErr instanceof Prisma.PrismaClientKnownRequestError &&
        createErr.code === "P2002"
      ) {
        // Eşzamanlı istek aynı siparişi oluşturdu — çift değil, sessizce ack.
        return NextResponse.json({ received: true, duplicate: true });
      }
      throw createErr;
    }

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
    // GEÇİCİ altyapı hatasında (DB/Redis çökmesi vb.) 500 dön — eBay bildirimi
    // TEKRAR gönderir, sipariş kaybolmaz. (200 dönülürse eBay "teslim edildi"
    // sayar ve bir daha göndermez → sipariş kalıcı kaybolur.) İş-mantığı
    // no-op'ları (listing bulunamadı, duplicate) yukarıda zaten 200 dönüyor.
    return NextResponse.json({ error: "İşleme hatası — tekrar dene" }, { status: 500 });
  }
}
