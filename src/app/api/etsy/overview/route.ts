import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  etsyflowAdmin,
  resolveEtsyProfileId,
  isEtsyflowConfigured,
} from "@/lib/etsyflow";
import type { EtsyOverview } from "@/types/etsyflow";

/**
 * GET /api/etsy/overview
 * Giriş yapmış Lean Automation kullanıcısının EtsyFlow verisini (mağaza,
 * ürün, sipariş) e-posta eşlemesiyle döner. Veri EtsyFlow Supabase'inden gelir.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  }

  if (!isEtsyflowConfigured()) {
    return NextResponse.json(
      { error: "EtsyFlow bağlantısı henüz yapılandırılmadı" },
      { status: 503 }
    );
  }

  const email = session.user.email;
  if (!email) {
    return NextResponse.json({ error: "Hesap e-postası bulunamadı" }, { status: 400 });
  }

  try {
    const profileId = await resolveEtsyProfileId(email);

    // EtsyFlow hesabı bu e-posta ile yoksa: boş ama bağlı değil
    if (!profileId) {
      const empty: EtsyOverview = { linked: false, stores: [], products: [], orders: [] };
      return NextResponse.json(empty);
    }

    const db = etsyflowAdmin();
    const [stores, products, orders] = await Promise.all([
      db.from("stores").select("*").eq("user_id", profileId).order("created_at", { ascending: false }),
      db.from("products").select("*").eq("user_id", profileId).order("created_at", { ascending: false }).limit(100),
      db.from("orders").select("*").eq("user_id", profileId).order("created_at", { ascending: false }).limit(100),
    ]);

    const overview: EtsyOverview = {
      linked: true,
      stores: stores.data ?? [],
      products: products.data ?? [],
      orders: orders.data ?? [],
    };
    return NextResponse.json(overview);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Bilinmeyen hata" },
      { status: 500 }
    );
  }
}
