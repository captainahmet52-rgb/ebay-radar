import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  etsyflowAdmin,
  getOrCreateEtsyProfileId,
  isEtsyflowConfigured,
} from "@/lib/etsyflow";
import { ETSY_CURRENCIES, isValidCatalogPair } from "@/lib/etsy-catalog";

const PatchStoreSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    category: z.string().min(1).optional(),
    sub_category: z.string().min(1).optional(),
    currency: z.enum(ETSY_CURRENCIES).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Değişiklik yok" });

type RouteCtx = { params: Promise<{ id: string }> };

/** Mağaza sahiplik kontrolü — herkes sadece KENDİ mağazasını yönetebilir. */
async function resolveOwnedStore(id: string, email: string, name?: string | null) {
  const profileId = await getOrCreateEtsyProfileId(email, name ?? null);
  const db = etsyflowAdmin();
  const { data: store } = await db.from("stores").select("*").eq("id", id).maybeSingle();
  if (!store || store.user_id !== profileId) return { db, store: null, profileId };
  return { db, store, profileId };
}

/** PATCH /api/etsy/stores/[id] — mağaza düzenle / aktif-pasif yap. */
export async function PATCH(req: Request, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  }
  if (!isEtsyflowConfigured()) {
    return NextResponse.json({ error: "EtsyFlow bağlantısı yapılandırılmadı" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = PatchStoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz istek" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  try {
    const { db, store } = await resolveOwnedStore(id, session.user.email);
    if (!store) return NextResponse.json({ error: "Mağaza bulunamadı" }, { status: 404 });

    // Kategori değişiyorsa yeni ikili katalogda olmalı (tek taraflı değişime de
    // izin ver: değişmeyen taraf mevcut değerden tamamlanır).
    const nextCategory = input.category ?? store.category;
    const nextSub = input.sub_category ?? store.sub_category;
    if ((input.category || input.sub_category) && !isValidCatalogPair(nextCategory, nextSub)) {
      return NextResponse.json(
        { error: "Geçersiz kategori/alt kategori seçimi" },
        { status: 400 }
      );
    }

    const { data: updated, error } = await db
      .from("stores")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Mağaza pasife alınınca üretim de dursun; aktife alınınca devam etsin.
    if (input.status) {
      await db
        .from("cron_jobs")
        .update({ is_active: input.status === "active" })
        .eq("store_id", id);
    }

    return NextResponse.json({ store: updated });
  } catch (e) {
    console.error("[etsy/stores PATCH]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Mağaza güncellenemedi" }, { status: 500 });
  }
}

/** DELETE /api/etsy/stores/[id] — mağazayı ve otomasyon kaydını sil. */
export async function DELETE(_req: Request, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  }
  if (!isEtsyflowConfigured()) {
    return NextResponse.json({ error: "EtsyFlow bağlantısı yapılandırılmadı" }, { status: 503 });
  }

  const { id } = await ctx.params;
  try {
    const { db, store } = await resolveOwnedStore(id, session.user.email);
    if (!store) return NextResponse.json({ error: "Mağaza bulunamadı" }, { status: 404 });

    await db.from("cron_jobs").delete().eq("store_id", id);
    const { error } = await db.from("stores").delete().eq("id", id);
    if (error) {
      // En olası sebep: mağazaya bağlı ürünler (FK). Kullanıcıya anlaşılır söyle.
      return NextResponse.json(
        { error: "Mağaza silinemedi — önce bu mağazanın ürünlerini silmen gerekiyor" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[etsy/stores DELETE]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Mağaza silinemedi" }, { status: 500 });
  }
}
