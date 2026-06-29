// Admin "Depoyu Sıfırla" — TÜM DepotProduct'ı siler (sıfırdan test için).
// ProductDistribution onDelete:Cascade ile otomatik temizlenir. Gerçek Listing'ler
// ETKİLENMEZ (Product'a bağlı, DepotProduct'a değil). Onay (confirm:true) zorunlu.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const POST = requireAdmin(async (req: NextRequest) => {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* gövde yok → onay yok sayılır */
  }
  if ((body as { confirm?: boolean }).confirm !== true) {
    return NextResponse.json({ error: "Onay gerekli (confirm:true)" }, { status: 400 });
  }

  const { count } = await prisma.depotProduct.deleteMany({});
  return NextResponse.json({ success: true, deleted: count });
});
