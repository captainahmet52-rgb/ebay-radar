import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// Handler'a geçen birleşik context: oturum bilgisi + Next.js 15 route params
export interface RouteContext {
  userId: string;
  plan: string;
  // Next.js 15'te params Promise'dir; await ile okunur
  params: Promise<Record<string, string>>;
}

type Handler = (req: NextRequest, ctx: RouteContext) => Promise<NextResponse>;

// Next.js 15 route handler'larının aldığı ikinci argüman tipi.
// params non-optional: Next.js tüm handler'ları (statik dahil) context ile çağırır.
// Tip: { params: Promise<any> } — .next/types ParamCheck'ini geçmesi için zorunlu.
type NextRouteContext = { params: Promise<Record<string, string>> };

/** Giriş yapmış kullanıcı gerektiren route wrapper'ı */
export function requireAuth(handler: Handler) {
  return async (req: NextRequest, routeCtx: NextRouteContext): Promise<NextResponse> => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
    }
    return handler(req, {
      userId: session.user.id,
      plan: session.user.plan ?? "free",
      params: routeCtx.params,
    });
  };
}

/** Pro veya Enterprise plan gerektiren route wrapper'ı */
export function requireSeller(handler: Handler) {
  return requireAuth(async (req, ctx) => {
    if (ctx.plan === "free") {
      return NextResponse.json({ error: "Bu özellik Pro plana gerektirir" }, { status: 403 });
    }
    return handler(req, ctx);
  });
}

/** Sadece admin route'ları için — ADMIN_EMAIL env'den kontrol edilir */
export function requireAdmin(handler: Handler) {
  return requireAuth(async (req, ctx) => {
    // ADMIN_EMAIL virgülle ayrılmış email listesi olabilir
    const adminEmails = (process.env.ADMIN_EMAIL ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    const session = await auth();
    if (!session?.user?.email || !adminEmails.includes(session.user.email)) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
    return handler(req, ctx);
  });
}

/** Cron job'ları için Bearer token doğrulama */
export function requireCron(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token || token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }
    return handler(req);
  };
}
