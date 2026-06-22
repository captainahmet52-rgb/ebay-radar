import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Gizlilik Politikası | ${SITE.name}`,
  description: `${SITE.name} gizlilik politikası — kişisel verilerin işlenmesi, saklanması ve korunması.`,
  alternates: { canonical: "/privacy" },
};

const UPDATED = "23 Haziran 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-slate-200">
      <Link href="/" className="text-sm text-emerald-400 hover:underline">
        ← Ana sayfa
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-white">Gizlilik Politikası</h1>
      <p className="mt-2 text-sm text-slate-400">Son güncelleme: {UPDATED}</p>

      <div className="mt-8 space-y-8 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-white">1. Sorumlu Veri İşleyen</h2>
          <p className="mt-2 text-slate-300">
            {SITE.name} ({SITE.url}), Amazon, eBay ve Etsy pazar yerleri için
            otomasyon hizmeti sunan bir platformdur. Bu politika, hizmetimizi
            kullanırken topladığımız verileri ve bunları nasıl koruduğumuzu açıklar.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">2. Topladığımız Veriler</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-slate-300">
            <li>Hesap bilgileri: e-posta adresi ve şifrelenmiş parola.</li>
            <li>
              Bağlı pazar yeri hesapları: eBay, Amazon ve Etsy OAuth jetonları
              (her zaman <strong>şifreli</strong> olarak saklanır).
            </li>
            <li>Ürün, listeleme, fiyat ve sipariş verileri.</li>
            <li>Kullanım ve teknik kayıtlar (IP, tarayıcı, hata günlükleri).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">3. Verileri Nasıl Kullanırız</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-slate-300">
            <li>Pazar yeri listeleme, fiyatlandırma ve sipariş otomasyonunu çalıştırmak.</li>
            <li>Hesabını yönetmek ve destek sağlamak.</li>
            <li>Hizmet güvenliğini ve dolandırıcılık önlemeyi sağlamak.</li>
          </ul>
          <p className="mt-2 text-slate-300">
            Verilerini asla satmayız ve pazarlama amacıyla üçüncü taraflarla paylaşmayız.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">4. eBay, Amazon ve Etsy Verileri</h2>
          <p className="mt-2 text-slate-300">
            Pazar yeri hesabını bağladığında, yalnızca otomasyon için gerekli izinleri
            (kapsamları) talep ederiz. Erişim jetonların şifreli saklanır ve sadece senin
            adına işlem yapmak için kullanılır. eBay üzerinden gelen{" "}
            <strong>hesap silme/kapatma bildirimleri</strong> otomatik işlenir ve ilgili
            veriler sistemden kaldırılır. Bağlantıyı istediğin zaman panelden kaldırabilirsin.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">5. Veri Saklama ve Güvenlik</h2>
          <p className="mt-2 text-slate-300">
            Veriler şifreli bağlantılar (HTTPS) üzerinden iletilir. OAuth jetonları
            AES-256-GCM ile şifrelenerek saklanır. Hesabını sildiğinde, ilgili kişisel
            verilerin ve pazar yeri jetonların makul süre içinde kalıcı olarak silinir.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">6. Haklarınız</h2>
          <p className="mt-2 text-slate-300">
            Verilerine erişme, düzeltme ve silinmesini talep etme hakkına sahipsin.
            Bu talepler için bizimle iletişime geçebilirsin.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">7. İletişim</h2>
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
        <Link href="/terms" className="text-emerald-400 hover:underline">
          Kullanım Şartları
        </Link>
        .
      </p>
    </main>
  );
}
