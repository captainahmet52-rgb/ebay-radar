import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const GET = requireAuth(async (req, { userId, params }) => {
  try {
    const { id } = await params;

    const listing = await prisma.listing.findFirst({
      where: { userId, productId: id },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Ürün bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: { select: { listings: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (err) {
    console.error("[products/[id] GET]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});

export const DELETE = requireAuth(async (req, { userId, params }) => {
  try {
    const { id } = await params;

    const listing = await prisma.listing.findFirst({
      where: { userId, productId: id },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Ürün bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    await prisma.listing.deleteMany({
      where: { userId, productId: id },
    });

    const remainingListings = await prisma.listing.count({
      where: { productId: id },
    });

    if (remainingListings === 0) {
      await prisma.product.delete({ where: { id } });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[products/[id] DELETE]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
