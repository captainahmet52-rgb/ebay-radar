import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Kullanım Şartları | ${SITE.name}`,
  description: `${SITE.name} kullanım şartları ve hizmet koşulları.`,
  alternates: { canonical: "/terms" },
};

const UPDATED = "23 Haziran 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-slate-200">
      <Link href="/" className="text-sm text-emerald-400 hover:underline">
        ← Ana sayfa
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-white">Kullanım Şartları</h1>
      <p className="mt-2 text-sm text-slate-400">Son güncelleme: {UPDATED}</p>

      <div className="mt-8 space-y-8 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-white">1. Hizmet</h2>
          <p className="mt-2 text-slate-300">
            {SITE.name}, Amazon, eBay ve Etsy pazar yerleri için ürün listeleme,
            fiyatlandırma, stok ve sipariş otomasyonu sağlar. Hizmeti kullanarak bu
            şartları kabul etmiş olursun.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">2. Hesap Sorumluluğu</h2>
          <p className="mt-2 text-slate-300">
            Hesap güvenliğinden ve bağladığın pazar yeri hesaplarındaki işlemlerden sen
            sorumlusun. Doğru ve güncel bilgi vermeyi kabul edersin.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">3. Pazar Yeri Kuralları</h2>
          <p className="mt-2 text-slate-300">
            Bağladığın pazar yerlerinin (eBay, Amazon, Etsy) kendi politikalarına uymak
            senin sorumluluğundadır. {SITE.name}, bu platformların kural değişikliklerinden
            veya hesap işlemlerinden sorumlu tutulamaz.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">4. Ödeme ve Abonelik</h2>
          <p className="mt-2 text-slate-300">
            Ücretli planlar abonelik bazında faturalandırılır. İptal ettiğinde, dönem
            sonuna kadar hizmete erişimin devam eder.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">5. Sorumluluk Sınırı</h2>
          <p className="mt-2 text-slate-300">
            Hizmet "olduğu gibi" sunulur. Otomasyon kaynaklı dolaylı zararlardan
            sorumluluk kabul edilmez. Maksimum sorumluluğumuz son 1 ayda ödediğin tutarla
            sınırlıdır.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">6. İletişim</h2>
          <p className="mt-2 text-slate-300">
            Sorular için:{" "}
            <a href="mailto:captainahmet52@gmail.com" className="text-emerald-400 hover:underline">
              captainahmet52@gmail.com
            </a>
          </p>
        </section>
      </div>

      <p className="mt-12 text-sm text-slate-500">
        Ayrıca bkz.{" "}
        <Link href="/privacy" className="text-emerald-400 hover:underline">
          Gizlilik Politikası
        </Link>
        .
      </p>
    </main>
  );
}
