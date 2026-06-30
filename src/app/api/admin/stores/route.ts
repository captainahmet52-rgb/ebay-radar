import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import {
  extractLegacyItemId,
  resolveSellerUsername,
  fetchSellerListings,
} from "@/lib/ebay/seller-listings";

export const GET = requireAdmin(async () => {
  const stores = await prisma.trackedStore.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { depotProducts: true } } },
  });
  return NextResponse.json(stores);
});

// POST — Mağaza/satıcı ekle. "sellerInput" ya GERÇEK eBay satıcı kullanıcı adı
// (örn. md.asifpa-0) ya da mağazadan BİR ÜRÜN LİNKİ olabilir. Ürün linkiyse
// Browse API ile gerçek username'e çözülür (mağaza slug'ı Browse'da geçersizdir).
export const POST = requireAdmin(async (req) => {
  const body = (await req.json()) as {
    ebayUsername?: string; // geriye dönük uyumluluk için isim aynı
    sellerInput?: string;
    storeUrl?: string;
  };
  const rawInput = (body.sellerInput ?? body.ebayUsername ?? "").trim();
  const storeUrl = (body.storeUrl ?? "").trim();

  if (!rawInput || !storeUrl) {
    return NextResponse.json(
      { error: "Satıcı kullanıcı adı / ürün linki ve mağaza URL zorunlu" },
      { status: 400 },
    );
  }

  // 1) Ürün linki mi? → gerçek satıcı username'ini çöz
  let username = rawInput;
  const legacyId = extractLegacyItemId(rawInput);
  if (legacyId) {
    let resolved: string | null = null;
    try {
      resolved = await resolveSellerUsername(legacyId);
    } catch (err) {
      return NextResponse.json(
        { error: `Ürün linkinden satıcı çözülemedi: ${err instanceof Error ? err.message : "hata"}` },
        { status: 502 },
      );
    }
    if (!resolved) {
      return NextResponse.json(
        { error: "Bu ürün linkinden satıcı kullanıcı adı bulunamadı. Geçerli bir eBay ürün linki ver." },
        { status: 422 },
      );
    }
    username = resolved;
  }

  // 2) Sanity — bu satıcının Browse'da gerçekten ürünü var mı? (yanlış username'i baştan yakala)
  let sampleCount = 0;
  try {
    const sample = await fetchSellerListings(username, 1);
    sampleCount = sample.length;
  } catch {
    /* geçici hata → engelleme, yine de eklemeye izin ver */
    sampleCount = -1;
  }
  if (sampleCount === 0) {
    return NextResponse.json(
      {
        error:
          `"${username}" için Browse API'de ürün bulunamadı. ` +
          `Mağaza slug'ı değil GERÇEK satıcı adı gerekir — en kolayı mağazadan bir ürün linki yapıştır.`,
        resolvedUsername: username,
      },
      { status: 422 },
    );
  }

  // 3) Kaydet (ebayUsername artık GERÇEK satıcı username'ini tutar)
  try {
    const store = await prisma.trackedStore.create({
      data: { ebayUsername: username, storeUrl },
    });
    return NextResponse.json(
      { ...store, resolvedUsername: username, resolvedFromLink: Boolean(legacyId) },
      { status: 201 },
    );
  } catch (err) {
    // unique ihlali → zaten takip ediliyor
    if (err instanceof Error && err.message.includes("Unique")) {
      return NextResponse.json(
        { error: `"${username}" zaten takip ediliyor.` },
        { status: 409 },
      );
    }
    throw err;
  }
});
