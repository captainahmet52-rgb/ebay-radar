import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  // Kullanıcının ayarlarını çek
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id:                    true,
      productLimit:          true,
      uploadDailyLimit:      true,
      uploadMinProfit:       true,
      uploadMinMarginPct:    true,
      uploadMinAmazonPrice:  true,
      uploadMaxAmazonPrice:  true,
      uploadPrimeOnly:       true,
      uploadAutoPublish:     true,
      uploadProfitMarginPct: true,
      uploadQuantity:        true,
    },
  });

  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  // Log kaydı oluştur (gerçek iş BullMQ'da olacak)
  const log = await prisma.autoUploadLog.create({
    data: {
      userId:  session.user.id,
      status:  "success",
      productsChecked:  0,
      productsUploaded: 0,
      productsSkipped:  0,
    },
  });

  // TODO: BullMQ'ya auto-upload job'ı ekle
  // await autoUploadQueue.add("auto-upload", { userId: session.user.id, logId: log.id });

  return NextResponse.json({
    ok: true,
    message: "Otomatik yükleme başlatıldı. Geçmiş sekmesinden takip edebilirsiniz.",
    logId: log.id,
  });
}
