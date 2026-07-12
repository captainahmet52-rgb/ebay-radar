import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 20;

  const [logs, total] = await Promise.all([
    prisma.amazonAutoUploadLog.findMany({
      where: { userId: session.user.id },
      orderBy: { ranAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.amazonAutoUploadLog.count({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({ logs, total, page });
}
