// DOĞRULAMA — bir mağazayı eklemeden ÖNCE gerçekten çalışacak mı test et.
// (İş yaptırmadan önce teyit.) Slug'ı doğrudan dener; geçersizse ürün linki gerekir.
//
// Kullanım:
//   /api/admin/radar/verify-store?store=telitetech
//   /api/admin/radar/verify-store?store=telitetech&item=https://www.ebay.com/itm/123456789
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import {
  fetchSellerListings,
  getItemSoldCount,
  resolveSellerUsername,
  extractLegacyItemId,
} from "@/lib/ebay/seller-listings";

export const GET = requireAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const store = (searchParams.get("store") ?? "").trim();
  const itemInput = (searchParams.get("item") ?? "").trim();

  if (!store && !itemInput) {
    return NextResponse.json({ ok: false, reason: "store veya item parametresi ver" });
  }

  // 1) Ürün linki verildiyse gerçek satıcıyı çöz; yoksa slug'ı username olarak dene.
  let username = store;
  let resolvedFrom = "slug (doğrudan)";
  const legacyId = extractLegacyItemId(itemInput);
  if (legacyId) {
    const r = await resolveSellerUsername(legacyId).catch(() => null);
    if (r) {
      username = r;
      resolvedFrom = "ürün linki";
    } else {
      return NextResponse.json({
        ok: true,
        works: false,
        verdict: `Ürün linkinden satıcı çözülemedi (item=${legacyId}). Geçerli bir ürün linki ver.`,
      });
    }
  }

  // 2) Bu username ile ürünleri çek (fetchSellerListings sertleştirildi: geçersiz
  //    satıcıda THROW eder → rastgele ürün gelmez).
  let items: Awaited<ReturnType<typeof fetchSellerListings>> = [];
  let error = "";
  try {
    items = await fetchSellerListings(username, 12);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const works = items.length > 0;

  // 3) İlk ürünün satış adedini çek (satış-odaklı radarın bu mağazada da çalıştığını kanıtla)
  let sampleSold: number | null = null;
  if (works && items[0]?.itemId) {
    sampleSold = await getItemSoldCount(items[0].itemId).catch(() => null);
  }

  const prices = items.map((i) => i.price).filter((p): p is number => p !== null);
  const avgPrice = prices.length ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100 : null;

  const verdict = works
    ? `✅ ÇALIŞIYOR → satıcı "${username}" (${resolvedFrom}), ${items.length}+ ürün geldi, ` +
      `ort. fiyat ~$${avgPrice ?? "?"}, örnek satış adedi: ${sampleSold ?? "?"}. Eklemeye HAZIR.`
    : legacyId
      ? `❌ Satıcı "${username}" ürün döndürmedi. Hata: ${error || "bilinmiyor"}`
      : `⚠️ Slug "${store}" doğrudan çalışmadı (${error || "ürün yok"}). ` +
        `Bu mağazadan bir ÜRÜN LİNKİ ekle: ...&item=https://www.ebay.com/itm/XXXX`;

  return NextResponse.json({
    ok: true,
    store,
    username,
    resolvedFrom,
    works,
    verdict,
    itemCount: items.length,
    avgPrice,
    sampleSold,
    sampleTitles: items.slice(0, 6).map((i) => i.title),
    error,
  });
});
