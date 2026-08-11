import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { etsyflowAdmin, isEtsyflowConfigured } from "@/lib/etsyflow";

export interface CatalogPriceEntry {
  cost?: number;
  salePrice?: number;
}

export interface CatalogPricingResponse {
  usdRate: number;
  /** anahtar: "{category}:{sub_category}" */
  prices: Record<string, CatalogPriceEntry>;
}

/**
 * GET /api/etsy/catalog-pricing — Katalog sayfası için GERÇEK maliyet/satış
 * fiyatı verisi. EtsyFlow'un admin panelinden girilen değerlerdir (uydurma
 * kâr rakamı DEĞİL): subcategory_prices (satış, admin PricingTab) +
 * app_settings.supplier_costs (maliyet, admin CategoriesTab) + usd_try_rate.
 * Bu tablolar kullanıcıya özel değil, tüm EtsyFlow için ortak — profil
 * eşlemesi gerekmez, sadece giriş ve EtsyFlow bağlantısı yeterli.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  }
  if (!isEtsyflowConfigured()) {
    return NextResponse.json({ error: "EtsyFlow bağlantısı yapılandırılmadı" }, { status: 503 });
  }

  try {
    const db = etsyflowAdmin();
    const [pricesRes, costsRes, rateRes] = await Promise.all([
      db.from("subcategory_prices").select("category, sub_category, price_usd"),
      db.from("app_settings").select("value").eq("key", "supplier_costs").maybeSingle(),
      db.from("app_settings").select("value").eq("key", "usd_try_rate").maybeSingle(),
    ]);

    const usdRate = parseFloat(rateRes.data?.value) || 35;
    const prices: Record<string, CatalogPriceEntry> = {};

    for (const row of pricesRes.data ?? []) {
      if (row.category && row.sub_category && row.price_usd) {
        const key = `${row.category}:${row.sub_category}`;
        prices[key] = { ...prices[key], salePrice: parseFloat(row.price_usd) * usdRate };
      }
    }

    try {
      const costsJson = JSON.parse(costsRes.data?.value || "{}") as Record<string, Record<string, string>>;
      for (const [cat, subs] of Object.entries(costsJson)) {
        for (const [sub, price] of Object.entries(subs)) {
          const key = `${cat}:${sub}`;
          prices[key] = { ...prices[key], cost: parseFloat(price) };
        }
      }
    } catch {
      // supplier_costs JSON bozuksa maliyetsiz devam et — satış fiyatı yine gösterilir
    }

    const response: CatalogPricingResponse = { usdRate, prices };
    return NextResponse.json(response);
  } catch (e) {
    console.error("[etsy/catalog-pricing]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Fiyat verisi alınamadı" }, { status: 500 });
  }
}
