import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AMAZON_PLAN_LIST as PLAN_LIST, isOnTrial, trialDaysLeft } from "@/lib/plans";
import { AmazonProPlusCard } from "@/components/amazon/pro-plus-card";
import { AmazonPlanCheckoutButton } from "@/components/amazon/plan-checkout-button";
import { AMZ_ACCENT } from "@/components/amazon/shared";
import { Check, Zap } from "lucide-react";

export const metadata = { title: "Paketler — AmazonBot" };

export default async function AmazonPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const { account: accountId } = await searchParams;
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { amazonTrialEndsAt: true },
      })
    : null;

  const onTrial = isOnTrial(user?.amazonTrialEndsAt ?? null);
  const daysLeft = trialDaysLeft(user?.amazonTrialEndsAt ?? null);

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-10">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-white">AmazonBot Planınızı Seçin</h1>
        {onTrial ? (
          <p className="font-medium" style={{ color: AMZ_ACCENT }}>
            <Zap className="inline h-4 w-4 mr-1" />
            Deneme süreniz devam ediyor — {daysLeft} gün kaldı
          </p>
        ) : (
          <p className="text-slate-400">
            Amazon hesabınıza en uygun planı seçin. İstediğiniz zaman değiştirin.
          </p>
        )}
        <p className="text-xs text-slate-500 max-w-xl mx-auto">
          Her paket <span className="text-slate-300 font-medium">tek bir Amazon satıcı hesabı</span> içindir.
          Birden fazla hesap için her hesaba ayrı abonelik alınır.
        </p>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {PLAN_LIST.map((plan) => {
          const isPopular = plan.id === "growth";
          const features = [
            `${plan.productLimit.toLocaleString("tr-TR")} ürün yükleme limiti`,
            `Günlük ${plan.uploadDailyLimit.toLocaleString("tr-TR")} otomatik yükleme`,
            "AliExpress → Amazon otomatik oto-yükleme",
            "Pazar başına özel kâr marjı",
            "Amazon radar ile sürekli yeni ürün keşfi",
            "Satışta otomatik AliExpress sipariş (oto-buy)",
            "Sipariş + takip kodu yöneticisi",
            "US + UK + BAE + Suudi pazarları",
            "Canlı destek",
          ];

          return (
            <div
              key={plan.id}
              className="relative rounded-2xl border p-5 flex flex-col gap-5 transition-all"
              style={
                isPopular
                  ? { borderColor: AMZ_ACCENT, background: `${AMZ_ACCENT}1a`, boxShadow: `0 20px 40px -20px ${AMZ_ACCENT}55` }
                  : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.025)" }
              }
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                  <span className="text-black text-xs font-bold px-3 py-1 rounded-full shadow-lg"
                    style={{ background: AMZ_ACCENT }}>
                    En Popüler
                  </span>
                </div>
              )}

              <div className="space-y-1 pt-1">
                <h3 className="text-white font-bold text-base">{plan.name}</h3>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-extrabold text-white">${plan.priceMonthly}</span>
                  <span className="text-slate-400 text-sm pb-1">/ay</span>
                </div>
              </div>

              <ul className="space-y-2.5 flex-1">
                {features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: AMZ_ACCENT }} />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <AmazonPlanCheckoutButton
                plan={plan.id}
                accountId={accountId}
                label="Satın Al"
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${
                  isPopular ? "text-black" : "bg-white/10 hover:bg-white/15 text-white"
                }`}
                {...(isPopular ? { style: { background: AMZ_ACCENT } } : {})}
              />
            </div>
          );
        })}
      </div>

      {/* Pro+ yüksek hacim */}
      <AmazonProPlusCard accountId={accountId} />

      {/* Trial info */}
      <div className="rounded-2xl border p-6 text-center space-y-2"
        style={{ borderColor: `${AMZ_ACCENT}33`, background: `${AMZ_ACCENT}0d` }}>
        <Zap className="h-6 w-6 mx-auto" style={{ color: AMZ_ACCENT }} />
        <h3 className="text-white font-semibold">7 Günlük Ücretsiz Deneme</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          İlk Amazon hesabınızı bağladığınızda deneme otomatik başlar. 50 ürüne kadar
          tüm özellikleri kullanabilirsiniz. Kredi kartı gerekmez.
        </p>
      </div>

      <p className="text-center text-slate-600 text-xs">
        Satın alma işlemi canlı destek üzerinden tamamlanır — &quot;Satın Al&quot;a tıkla,
        sohbet açılır. Her paket tek bir Amazon hesabı içindir; istediğin zaman iptal edebilirsin.
      </p>
    </div>
  );
}
