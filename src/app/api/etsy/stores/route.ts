import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  etsyflowAdmin,
  getOrCreateEtsyProfileId,
  isEtsyflowConfigured,
} from "@/lib/etsyflow";
import {
  ETSY_CURRENCIES,
  DEFAULT_INTERVAL_HOURS,
  isValidCatalogPair,
} from "@/lib/etsy-catalog";

const CreateStoreSchema = z.object({
  name: z.string().trim().min(2, "Mağaza adı en az 2 karakter olmalı").max(80),
  category: z.string().min(1),
  sub_category: z.string().min(1),
  currency: z.enum(ETSY_CURRENCIES),
});

/**
 * POST /api/etsy/stores — yeni mağaza + otomasyon (cron) kaydı.
 *
 * Mağaza eklemek tek başına yetmez: otomasyon motoru (etsyflow-automation)
 * cron_jobs tablosunu okur — kaydı olmayan mağaza için ASLA üretim yapmaz.
 * Bu yüzden ikisi burada birlikte oluşturulur; cron eklenemezse mağaza geri
 * silinir (yarım kalmış, sessizce üretmeyen mağaza bırakmayız).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  }
  if (!isEtsyflowConfigured()) {
    return NextResponse.json({ error: "EtsyFlow bağlantısı yapılandırılmadı" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateStoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz istek" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Katalog dışı kategori/alt kategori = otomasyon motorunda karşılığı yok
  // = sessiz üretim atlaması. Kaynağında engelle.
  if (!isValidCatalogPair(input.category, input.sub_category)) {
    return NextResponse.json(
      { error: "Geçersiz kategori/alt kategori seçimi" },
      { status: 400 }
    );
  }

  try {
    const profileId = await getOrCreateEtsyProfileId(session.user.email);
    const db = etsyflowAdmin();

    const { data: store, error: storeErr } = await db
      .from("stores")
      .insert({
        user_id: profileId,
        name: input.name,
        category: input.category,
        sub_category: input.sub_category,
        currency: input.currency,
        status: "active",
      })
      .select()
      .single();

    if (storeErr || !store) {
      throw new Error(storeErr?.message ?? "Mağaza oluşturulamadı");
    }

    const { error: cronErr } = await db.from("cron_jobs").insert({
      user_id: profileId,
      store_id: store.id,
      client_id: store.client_id ?? null,
      webhook_url: "",
      interval_hours: DEFAULT_INTERVAL_HOURS,
      is_active: true,
      status: "active",
      last_run_at: null,
      // Şimdiki zaman → motor ilk 30 saniyelik denetiminde görüp üretime başlar
      next_run_at: new Date().toISOString(),
    });

    if (cronErr) {
      await db.from("stores").delete().eq("id", store.id);
      throw new Error(`Otomasyon kaydı oluşturulamadı: ${cronErr.message}`);
    }

    return NextResponse.json({ store });
  } catch (e) {
    console.error("[etsy/stores POST]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Mağaza eklenemedi" }, { status: 500 });
  }
}
