import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { setCampaignStatus } from "@/lib/meta/campaigns";
import { z } from "zod";

const schema = z.object({ status: z.enum(["ACTIVE", "PAUSED"]) });

/**
 * PATCH /api/shopify/meta/campaigns/[id]/status — kampanyayı aktive/duraklat.
 * Harcamanın başladığı TEK yer burası — kullanıcı bilinçli tıklar.
 */
export const PATCH = requireAuth(async (req, { userId, params }) => {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const campaign = await prisma.metaCampaign.findFirst({
    where: { id, userId },
    include: { metaAccount: { select: { accessTokenEncrypted: true } } },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Kampanya bulunamadı" }, { status: 404 });
  }

  try {
    const token = decryptToken(campaign.metaAccount.accessTokenEncrypted);
    await setCampaignStatus(campaign.metaCampaignId, token, parsed.data.status);
    await prisma.metaCampaign.update({
      where: { id },
      data: { status: parsed.data.status, lastError: null },
    });
    return NextResponse.json({ ok: true, status: parsed.data.status });
  } catch (err) {
    console.error("[shopify/meta/campaigns/status]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Durum güncellenemedi — tekrar dene" }, { status: 502 });
  }
});
