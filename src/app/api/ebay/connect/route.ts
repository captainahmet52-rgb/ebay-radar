import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { getAuthorizationUrl } from "@/lib/ebay/oauth";

export const GET = requireAuth(async (_req, { userId }) => {
  try {
    // state = userId; callback'te hangi user'a token yazacağımızı bileceğiz
    const url = getAuthorizationUrl(userId);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[ebay/connect GET]", err);
    return NextResponse.json({ error: "eBay bağlantı URL'si oluşturulamadı" }, { status: 500 });
  }
});
