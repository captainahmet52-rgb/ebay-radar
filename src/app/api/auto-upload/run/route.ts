import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ebayAutoUploadQueue } from "@/lib/queues";

/**
 * POST /api/auto-upload/run
 * Kullanıcı için oto-yüklemeyi HEMEN tetikler (BullMQ ebay-auto-upload job'ı).
 * Worker depodan filtreye uyan ürünleri seçer → Listing + publish-listing ile eBay'e yayınlar.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = session.user.id;

  // Aktif mağaza ve oto-yükleme açık mı, hızlı kontrol
  const [user, account] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { autoUploadEnabled: true } }),
    prisma.ebayAccount.findFirst({ where: { userId, isActive: true }, select: { id: true } }),
  ]);

  if (!account) {
    return NextResponse.json(
      { error: "Aktif eBay mağazası yok. Mağazalarım'dan bir mağaza bağlayıp aktifleştir." },
      { status: 400 }
    );
  }
  if (!user?.autoUploadEnabled) {
    return NextResponse.json(
      { error: "Önce oto-yüklemeyi açıp ayarları kaydet." },
      { status: 400 }
    );
  }

  await ebayAutoUploadQueue.add(
    "ebay-auto-upload",
    { userId },
    { jobId: `ebay-auto-upload:manual:${userId}:${Date.now()}` }
  );

  return NextResponse.json({
    ok: true,
    message: "Otomatik yükleme başlatıldı. Geçmiş sekmesinden takip edebilirsiniz.",
  });
}
