import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAuth } from "@/lib/api-helpers";
import { getAuthorizationUrl } from "@/lib/ebay/oauth";
import { signState } from "@/lib/oauth-state";

export const GET = requireAuth(async (_req, { userId }) => {
  try {
    // CSRF koruması: ham userId değil, imzalı + kısa ömürlü state kullanılır.
    const nonce = randomBytes(16).toString("hex");
    const state = signState({ userId, nonce });
    const url = getAuthorizationUrl(state);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[ebay/connect GET]", err);
    return NextResponse.json({ error: "eBay bağlantı URL'si oluşturulamadı" }, { status: 500 });
  }
});
