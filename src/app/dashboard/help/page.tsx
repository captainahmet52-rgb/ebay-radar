import Link from "next/link";
import {
  LayoutDashboard, Store, List, Package, ShoppingCart, Upload, Chrome,
  CreditCard, Gift, Handshake, Settings, Tag, RefreshCcw, ShieldCheck, ArrowRight,
  DownloadCloud, ToggleRight,
} from "lucide-react";

export const metadata = { title: "Nasıl Çalışır? — Lean Automation" };

const FLOW = [
  { n: 1, title: "Mağaza Bağla", desc: "eBay mağazanı güvenli OAuth ile tek tıkla bağla." },
  { n: 2, title: "Ürün Ekle", desc: "Amazon ürünlerini (ASIN) eklentiyle topla, panele ekle." },
  { n: 3, title: "Otomatik Listele", desc: "Sistem kârlı fiyatı hesaplar ve eBay'e listeler." },
  { n: 4, title: "Sat & Takip", desc: "Stok/fiyat sürekli izlenir; sipariş gelince canlı doğrulanır." },
];

const PAGES = [
  { icon: LayoutDashboard, name: "Panel", desc: "Mağazanın özeti: toplam kâr, aktif listeler, bekleyen siparişler, son siparişler ve başarı oranı. Hesabın boşken 'Başlarken' rehberi burada görünür." },
  { icon: Store, name: "Mağazalarım", desc: "eBay mağazalarını bağlar ve yönetirsin. Her mağaza 7 gün ücretsiz dener; süre bitince paketle devam eder. Sadece aktif mağazalara ürün yüklenir." },
  { icon: List, name: "eBay Listeler", desc: "eBay'de yayında olan ilanların. Her birinin güncel fiyatını, stok adedini ve durumunu (aktif/duraklatılmış) görürsün." },
  { icon: DownloadCloud, name: "İlan İçe Aktar", desc: "Zaten eBay'de yayında olan ilanlarını (başka bir araçla veya elle açtıkların) sisteme aktarır. SKU'daki ASIN'den Amazon ürününe eşleştirir ve SADECE sen onayladıkça stok/fiyat takibine alır. Gölge modu: sen 'takibi aç' demeden hiçbir ilana dokunulmaz." },
  { icon: Package, name: "Ürünler", desc: "Depona eklediğin Amazon ürünleri (ASIN bazlı). Sistem bunların fiyat/stok verisini çeker; buradan eBay'e listeye gönderebilirsin." },
  { icon: ShoppingCart, name: "Siparişler", desc: "Gelen siparişler. Sipariş anında Amazon stok/fiyatı canlı doğrulanır; uygunsa işlenir, kargo takip numarası eklenir." },
  { icon: Upload, name: "Oto Yükleme", desc: "Otomatik listeleme kuralların: kâr marjı, min/max fiyat, günlük limit, yorum/puan/teslimat filtreleri. Bir kez ayarla, sistem her gün kendisi listeler." },
  { icon: Chrome, name: "Eklenti", desc: "Chrome eklentisi. Amazon'da gezerken ürünlerin ASIN'lerini tek tıkla toplar; kopyalayıp panele yapıştırırsın." },
  { icon: CreditCard, name: "Paketler", desc: "Abonelik planların. Ürün sayısı, mağaza sayısı ve günlük yükleme limiti pakete göre değişir (Starter → Enterprise)." },
  { icon: Gift, name: "Davet Et", desc: "Davet kodunu paylaş; davet ettiğin kişi kaydolunca ikiniz de bonus süre kazanırsınız." },
  { icon: Handshake, name: "Ortaklık", desc: "Tanıtım ortağı ol, getirdiğin müşterilerden komisyon kazan (admin onayıyla aktifleşir)." },
  { icon: Settings, name: "Ayarlar", desc: "Hesap ayarların buradan yönetilir. (eBay mağaza bağlama 'Mağazalarım' sayfasında.)" },
];

const RULES = [
  { icon: Tag, title: "Akıllı Fiyatlandırma", desc: "Tüm masraflar (Amazon maliyeti + eBay komisyonu + sabit ücret) düşüldükten sonra satışın net ~%20'si kâr kalacak şekilde eBay fiyatı otomatik hesaplanır. Taban fiyatın altına düşerse listelemez." },
  { icon: RefreshCcw, title: "Otomatik Stok & Fiyat Takibi", desc: "Amazon fiyatı veya stoğu değişince eBay fiyatın otomatik güncellenir. Stok azalınca adet düşürülür, bitince ilan duraklatılır; stok gelince fiyat yeniden hesaplanıp otomatik geri açılır." },
  { icon: ShieldCheck, title: "Sipariş-Anı Doğrulama", desc: "En kritik koruma: sipariş geldiğinde, işlenmeden ÖNCE o ürünün Amazon stok + fiyatı canlı bir kez daha çekilir. Uygunsa onaylanır; stok bittiyse veya fiyat zıpladıysa sipariş iptal edilir. Böylece zarara satış engellenir." },
];

const IMPORT_STEPS = [
  { icon: DownloadCloud, title: "1 · Çek", desc: "Mağazanı bağlayınca eBay'deki tüm mevcut ilanların (binlerce olsa bile) güvenle çekilir. Bu adım ücretsizdir, Amazon'a hiç bakılmaz." },
  { icon: ShieldCheck, title: "2 · Eşleştir (sıfır hata)", desc: "İlanın SKU'sundaki ASIN ile Amazon ürünü eşleştirilir. Sistem yalnızca %100 emin olduğu ilanları 'onaylı' işaretler; en ufak şüphede dokunmaz, 'incele' olarak ayırır." },
  { icon: ToggleRight, title: "3 · Takibi sen aç", desc: "Onaylı ilanların listesini görürsün. Hangisinin stok/fiyat takibine girmesini istersen tek tıkla açarsın — o ana kadar her şey salt-okunur (gölge modu)." },
];

export default function HelpPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Başlık */}
      <div>
        <h1 className="text-2xl font-bold text-white">Nasıl Çalışır?</h1>
        <p className="text-sm text-slate-400 mt-1">
          Lean Automation, Amazon ürünlerini eBay mağazana otomatik listeler ve fiyat/stoğu sürekli takip eder. İşte sistem ve menüdeki her sayfa.
        </p>
      </div>

      {/* Akış */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Sistem 4 adımda</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FLOW.map((s) => (
            <div
              key={s.n}
              className="relative bg-slate-900/50 border border-slate-700/50 rounded-2xl p-5"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-violet-400 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/20">
                {s.n}
              </div>
              <h3 className="text-white font-semibold text-sm mt-3">{s.title}</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Menüdeki sayfalar */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Menüdeki sayfalar</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PAGES.map(({ icon: Icon, name, desc }) => (
            <div
              key={name}
              className="flex gap-4 bg-slate-900/50 border border-slate-700/50 rounded-2xl p-4"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-violet-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-medium text-sm">{name}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* İlan İçe Aktarma — öne çıkan */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-1">Zaten eBay&apos;de ilanların var mı?</h2>
        <p className="text-sm text-slate-400 mb-4 max-w-3xl leading-relaxed">
          Sıfırdan ürün eklemene gerek yok. Başka bir araçla veya elle açtığın mevcut eBay
          ilanlarını <strong className="text-slate-200">İlan İçe Aktar</strong> ile sisteme bağla;
          stok ve fiyat takibi onlar için de çalışsın.{" "}
          <strong className="text-slate-200">Sen &quot;takibi aç&quot; demeden hiçbir ilana dokunulmaz</strong> (gölge modu).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {IMPORT_STEPS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-gradient-to-br from-violet-600/10 to-transparent border border-violet-500/20 rounded-2xl p-5"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Icon className="h-5 w-5 text-violet-400" />
              </div>
              <h3 className="text-white font-semibold text-sm mt-3">{title}</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Önemli kurallar */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Otomasyonun beyni — önemli kurallar</h2>
        <div className="space-y-3">
          {RULES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex gap-4 bg-gradient-to-br from-violet-600/5 to-transparent border border-slate-700/50 rounded-2xl p-5"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-violet-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-semibold text-sm">{title}</h3>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-violet-600/10 to-blue-600/5 border border-violet-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-white font-semibold">Başlamaya hazır mısın?</h3>
          <p className="text-sm text-slate-400 mt-1">Önce eBay mağazanı bağla, sonra ilk ürününü ekle.</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            href="/dashboard/stores"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors"
          >
            eBay Bağla <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard/products"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
          >
            Ürün Ekle
          </Link>
        </div>
      </section>
    </div>
  );
}
