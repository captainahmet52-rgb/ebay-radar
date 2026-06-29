import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLAN_LIST, isOnTrial, trialDaysLeft } from "@/lib/plans";
import { ProPlusCard } from "@/components/pricing/pro-plus-card";
import { Check, Zap } from "lucide-react";

export const metadata = { title: "Paketler — Lean Automation" };

export default async function PricingPage() {
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true, trialEndsAt: true, stripeSubscriptionId: true },
      })
    : null;

  const currentPlan = user?.plan ?? "starter";
  const onTrial = isOnTrial(user?.trialEndsAt ?? null);
  const daysLeft = trialDaysLeft(user?.trialEndsAt ?? null);
  const hasPaid = !!user?.stripeSubscriptionId;

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-10">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-white">Planınızı Seçin</h1>
        {onTrial ? (
          <p className="text-amber-400 font-medium">
            <Zap className="inline h-4 w-4 mr-1" />
            Deneme süreniz devam ediyor — {daysLeft} gün kaldı
          </p>
        ) : (
          <p className="text-slate-400">
            Mağazanıza en uygun planı seçin. İstediğiniz zaman değiştirin.
          </p>
        )}
        <p className="text-xs text-slate-500 max-w-xl mx-auto">
          Her paket <span className="text-slate-300 font-medium">tek bir eBay mağazası</span> içindir.
          Birden fazla mağaza için her mağazaya ayrı abonelik alınır.
        </p>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {PLAN_LIST.map((plan) => {
          const isCurrentPlan = !hasPaid && !onTrial && currentPlan === plan.id;
          const isPopular = plan.id === "growth";
          const features = [
            `${plan.productLimit.toLocaleString("tr-TR")} ürün yükleme limiti`,
            `Günlük ${plan.uploadDailyLimit.toLocaleString("tr-TR")} otomatik yükleme`,
            "Radar — güncel ürün tarayıcı",
            "Toplu ASIN yükleme + ASIN Grabber (Chrome)",
            "15 dk'ya kadar stok & fiyat takibi",
            "Otomatik repricer (hep %20 kâr)",
            "Sipariş-anı canlı doğrulama",
            "Oversell (fazla satış) koruması",
            "Sınırsız takip kodu",
            "Sipariş + ürün yöneticisi",
            "US + UK pazarları",
          ];

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-5 flex flex-col gap-5 transition-all ${
                isPopular
                  ? "border-violet-500 bg-violet-500/10 shadow-xl shadow-violet-500/10"
                  : "border-slate-700/60 bg-slate-800/40 hover:border-slate-600"
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                  <span className="bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                    En Popüler
                  </span>
                </div>
              )}

              {/* Plan info */}
              <div className="space-y-1 pt-1">
                <h3 className="text-white font-bold text-base">{plan.name}</h3>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-extrabold text-white">
                    ${plan.priceMonthly}
                  </span>
                  <span className="text-slate-400 text-sm pb-1">/ay</span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 flex-1">
                {features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="h-4 w-4 text-violet-400 flex-shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="space-y-1.5">
                <button
                  disabled
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all cursor-not-allowed ${
                    isCurrentPlan
                      ? "bg-slate-700/80 text-slate-400"
                      : isPopular
                      ? "bg-violet-600/70 text-white/70"
                      : "bg-slate-700/50 text-slate-400/80"
                  }`}
                >
                  {isCurrentPlan ? "Mevcut Planınız" : "Yakında Aktif"}
                </button>
                {isCurrentPlan && (
                  <p className="text-center text-[10px] text-slate-500">
                    Şu anki planınız
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pro+ yüksek hacim — ayrı kart (dropdown ile 15K / 20K) */}
      <ProPlusCard />

      {/* Trial info */}
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6 text-center space-y-2">
        <Zap className="h-6 w-6 text-violet-400 mx-auto" />
        <h3 className="text-white font-semibold">7 Günlük Ücretsiz Deneme</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          İlk eBay mağazanızı bağladığınızda deneme otomatik başlar. 50 ürüne kadar
          tüm özellikleri kullanabilirsiniz. Kredi kartı gerekmez.
        </p>
      </div>

      {/* Ödeme sistemi notu */}
      <p className="text-center text-slate-600 text-xs">
        Ödeme sistemi (Paddle) entegrasyonu yakında aktif edilecek. Sorular için
        destek ekibiyle iletişime geçin.
      </p>
    </div>
  );
}
