import { NextResponse } from "next/server";

// Liveness probe — uygulama sunucusunun ayağa kalkıp HTTP servis ettiğini doğrular.
// DB'ye BAĞIMLI DEĞİL: kasıtlı olarak basit tutuldu ki geçici DB dalgalanmasında
// "unhealthy" deyip gereksiz restart/route-kesme tetiklemesin (flap önleme).
// Deploy sonrası doğrulama: `curl -i https://leanautomation.pro/api/healthz` → 200.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", ts: new Date().toISOString() });
}
