import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import {
  extractLegacyItemId,
  extractStoreSlug,
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

// POST — Mağaza/satıcı ekle. "sellerInput" şunlardan biri olabilir:
//   • Mağaza linki (https://www.ebay.com/str/telitetech) → slug denenir
//   • Ürün linki (https://www.ebay.com/itm/123...) → gerçek satıcı çözülür (en kesin)
//   • Doğrudan satıcı kullanıcı adı
// Mağaza URL opsiyonel — verilmezse girdiden türetilir. "Sadece link" yeterli.
export const POST = requireAdmin(async (req) => {
  const body = (await req.json()) as {
    ebayUsername?: string; // geriye dönük uyumluluk
    sellerInput?: string;
    storeUrl?: string;
  };
  const rawInput = (body.sellerInput ?? body.ebayUsername ?? "").trim();
  if (!rawInput) {
    return NextResponse.json({ error: "Mağaza linki / ürün linki / satıcı adı gerekli" }, { status: 400 });
  }

  // 1) Girdiyi sınıflandır → gerçek satıcı username'ini bul
  let username = rawInput;
  let resolvedFrom: "item" | "store" | "username" = "username";
  const isItem = /\/itm\//.test(rawInput) || /^\d{9,}$/.test(rawInput);

  if (isItem) {
    // Ürün linki → gerçek satıcıyı çöz (en kesin yol)
    const legacyId = extractLegacyItemId(rawInput);
    let resolved: string | null = null;
    try {
      resolved = legacyId ? await resolveSellerUsername(legacyId) : null;
    } catch (err) {
      return NextResponse.json(
        { error: `Ürün linkinden satıcı çözülemedi: ${err instanceof Error ? err.message : "hata"}` },
        { status: 502 },
      );
    }
    if (!resolved) {
      return NextResponse.json(
        { error: "Bu ürün linkinden satıcı bulunamadı. Geçerli bir eBay ürün linki ver." },
        { status: 422 },
      );
    }
    username = resolved;
    resolvedFrom = "item";
  } else {
    // Mağaza linki → slug; değilse düz kullanıcı adı
    const slug = extractStoreSlug(rawInput);
    if (slug) {
      username = slug;
      resolvedFrom = "store";
    }
  }

  // 2) Sanity — bu satıcının Browse'da gerçekten ürünü var mı?
  //    (fetchSellerListings sertleştirildi: geçersiz satıcıda THROW → rastgele ürün gelmez)
  let sampleCount = 0;
  let sanityError = "";
  try {
    const sample = await fetchSellerListings(username, 1);
    sampleCount = sample.length;
  } catch (err) {
    sanityError = err instanceof Error ? err.message : String(err);
  }

  if (sampleCount === 0) {
    // Slug doğrudan çalışmadıysa kullanıcıyı ürün linkine yönlendir
    const needsItemLink = resolvedFrom !== "item";
    return NextResponse.json(
      {
        error: needsItemLink
          ? `"${username}" doğrudan çalışmadı. Bu mağazadan bir ÜRÜN LİNKİ yapıştır ` +
            `(https://www.ebay.com/itm/...) — gerçek satıcı otomatik çözülür.`
          : `"${username}" için ürün bulunamadı.${sanityError ? " (" + sanityError.slice(0, 120) + ")" : ""}`,
        resolvedUsername: username,
      },
      { status: 422 },
    );
  }

  // 3) Mağaza URL — verilmemişse girdiden türet
  const storeUrl =
    (body.storeUrl ?? "").trim() ||
    (resolvedFrom === "store" ? `https://www.ebay.com/str/${username}` : rawInput) ||
    `https://www.ebay.com/usr/${username}`;

  // 4) Kaydet (ebayUsername GERÇEK satıcı username'ini tutar)
  try {
    const store = await prisma.trackedStore.create({
      data: { ebayUsername: username, storeUrl },
    });
    return NextResponse.json(
      { ...store, resolvedUsername: username, resolvedFrom },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique")) {
      return NextResponse.json({ error: `"${username}" zaten takip ediliyor.` }, { status: 409 });
    }
    throw err;
  }
});
