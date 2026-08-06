import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  etsyflowAdmin,
  getOrCreateEtsyProfileId,
  isEtsyflowConfigured,
} from "@/lib/etsyflow";

const PatchProductSchema = z.object({
  // requeue: tekrar yükleme kuyruğuna al (eklenti "waiting" olanları çeker)
  // cancel: kuyruktan çıkar (eklenti bir daha görmez)
  action: z.enum(["requeue", "cancel"]),
});

type RouteCtx = { params: Promise<{ id: string }> };

async function resolveOwnedProduct(id: string, email: string, name?: string | null) {
  const profileId = await getOrCreateEtsyProfileId(email, name ?? null);
  const db = etsyflowAdmin();
  const { data: product } = await db.from("products").select("*").eq("id", id).maybeSingle();
  if (!product || product.user_id !== profileId) return { db, product: null };
  return { db, product };
}

/** PATCH /api/etsy/products/[id] — kuyruk durumunu yönet (iptal / tekrar kuyruğa). */
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
  const parsed = PatchProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  try {
    const { db, product } = await resolveOwnedProduct(id, session.user.email);
    if (!product) return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });

    if (product.upload_status === "uploaded") {
      return NextResponse.json(
        { error: "Bu ürün zaten Etsy'ye yüklenmiş — kuyruğu değiştirilemez" },
        { status: 409 }
      );
    }

    const upload_status = parsed.data.action === "requeue" ? "waiting" : "cancelled";
    const { data: updated, error } = await db
      .from("products")
      .update({ upload_status })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ product: updated });
  } catch (e) {
    console.error("[etsy/products PATCH]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Ürün güncellenemedi" }, { status: 500 });
  }
}

/** DELETE /api/etsy/products/[id] — henüz yüklenmemiş ürünü tamamen sil. */
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
    const { db, product } = await resolveOwnedProduct(id, session.user.email);
    if (!product) return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });

    if (product.upload_status === "uploaded") {
      return NextResponse.json(
        { error: "Etsy'ye yüklenmiş ürün panelden silinemez (önce Etsy'den kaldır)" },
        { status: 409 }
      );
    }

    const { error } = await db.from("products").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[etsy/products DELETE]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Ürün silinemedi" }, { status: 500 });
  }
}
