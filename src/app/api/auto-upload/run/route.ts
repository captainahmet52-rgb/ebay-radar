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

  // Aktif mağaza var mı, hızlı kontrol
  const account = await prisma.ebayAccount.findFirst({ where: { userId, isActive: true }, select: { id: true } });
  if (!account) {
    return NextResponse.json(
      { error: "Aktif eBay mağazası yok. Mağazalarım'dan bir mağaza bağlayıp aktifleştir." },
      { status: 400 }
    );
  }

  // Kullanıcı "Şimdi Çalıştır" dediğinde autoUploadEnabled kaydedilmemiş olabilir
  // (toggle açıldı ama Kaydet basılmadı / kaydetme başarısız oldu).
  // Bu durumda otomatik olarak aç — buton her zaman çalışsın.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { autoUploadEnabled: true } });
  if (!user?.autoUploadEnabled) {
    await prisma.user.update({ where: { id: userId }, data: { autoUploadEnabled: true } });
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
