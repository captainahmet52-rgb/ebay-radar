import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import {
  extractLegacyItemId,
  extractStoreSlug,
  resolveSellerUsername,
  resolveUsernameFromStorePage,
  fetchSellerListings,
} from "@/lib/ebay/seller-listings";

export const GET = requireAdmin(async () => {
  const stores = await prisma.trackedStore.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { depotProducts: true } } },
  });
  return NextResponse.json(stores);
});

/** username Browse'da geçerli + ürünü var mı? (sertleştirilmiş fetch throw ederse false) */
async function sellerHasItems(username: string): Promise<boolean> {
  try {
    return (await fetchSellerListings(username, 1)).length > 0;
  } catch {
    return false;
  }
}

// POST — SADECE MAĞAZA LİNKİ ile ekle (radar mağaza mantığı, ürün değil).
// Girdi: https://www.ebay.com/str/telitetech (ya da düz mağaza adı).
// Akış: slug'ı dene → olmazsa mağaza sayfasından satıcıyı OTOMATİK çöz → yine
// olmazsa net hata. Kullanıcı ürün linkiyle uğraşmaz.
export const POST = requireAdmin(async (req) => {
  const body = (await req.json()) as {
    ebayUsername?: string;
    sellerInput?: string;
    storeUrl?: string;
  };
  const rawInput = (body.sellerInput ?? body.ebayUsername ?? "").trim();
  if (!rawInput) {
    return NextResponse.json({ error: "Mağaza linki gerekli" }, { status: 400 });
  }

  // Slug'ı çıkar: mağaza linkiyse /str/'den, değilse düz metni slug kabul et.
  const slug = extractStoreSlug(rawInput) ?? rawInput;

  // 1) Slug doğrudan geçerli satıcı adı mı? (çoğu mağazada öyle)
  let username: string | null = null;
  if (await sellerHasItems(slug)) {
    username = slug;
  }

  // 2) Değilse: mağaza sayfasından satıcıyı OTOMATİK çöz (kullanıcı görmeden)
  if (!username) {
    const auto = await resolveUsernameFromStorePage(slug);
    if (auto && (await sellerHasItems(auto))) {
      username = auto;
    }
  }

  // 3) (Nadiren) girdi bir ürün linkiyse yine de destekle — sessiz kolaylık
  if (!username) {
    const legacyId = /\/itm\//.test(rawInput) ? extractLegacyItemId(rawInput) : null;
    if (legacyId) {
      const resolved = await resolveSellerUsername(legacyId).catch(() => null);
      if (resolved && (await sellerHasItems(resolved))) username = resolved;
    }
  }

  if (!username) {
    return NextResponse.json(
      { error: "Bu mağaza şu an okunamadı. Mağaza linkini kontrol edip tekrar dene." },
      { status: 422 },
    );
  }

  // Mağaza URL: verilen ya da slug'dan türet
  const storeUrl =
    (body.storeUrl ?? "").trim() ||
    (extractStoreSlug(rawInput) ? rawInput : `https://www.ebay.com/str/${slug}`);

  try {
    const store = await prisma.trackedStore.create({
      data: { ebayUsername: username, storeUrl },
    });
    return NextResponse.json({ ...store, resolvedUsername: username }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique")) {
      return NextResponse.json({ error: `"${username}" zaten takip ediliyor.` }, { status: 409 });
    }
    throw err;
  }
});
