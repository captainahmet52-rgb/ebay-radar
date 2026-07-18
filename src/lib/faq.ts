/**
 * Sık Sorulan Sorular — hem görünür SSS bölümünde hem de
 * FAQPage JSON-LD (AEO) içinde kullanılır. Tek kaynak.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ: FaqItem[] = [
  {
    q: "Lean Automation nedir?",
    a: "Lean Automation; Amazon, eBay, Etsy ve Shopify satıcıları için yapay zeka destekli bir pazar yeri otomasyon platformudur. Ürün listeleme, fiyatlandırma, stok takibi ve sipariş yönetimini tek panelden otomatikleştirir.",
  },
  {
    q: "eBay otomasyonu nasıl çalışır?",
    a: "eBay mağazanı güvenli şekilde bağlarsın, listelemek istediğin ürünleri seçersin ve sistem fiyatları, stokları ve siparişleri otomatik yönetir. Fiyat ve stok değişimleri sürekli takip edilip eBay listelerin otomatik güncellenir.",
  },
  {
    q: "Ücretsiz deneme var mı?",
    a: "Evet. Mağazanı bağladığında 7 gün boyunca 50 ürüne kadar ücretsiz kullanabilirsin. Deneme süresinde kredi kartı gerekmez.",
  },
  {
    q: "Hangi pazar yerleri destekleniyor?",
    a: "eBay otomasyonu (eBayBot) tam aktiftir ve mağazanı hemen bağlayabilirsin. Amazon (AmazonBot) ve Shopify (ShopifyBot) motoru hazır, resmi API onayları tamamlanınca açılacak. Etsy (EtsyBot) entegrasyonu geliştirme aşamasındadır.",
  },
  {
    q: "Fiyatlandırma nasıl?",
    a: "Mağazanı bağladıktan sonra ihtiyacına uygun paketi seçebilirsin. Farklı ürün limitleri ve özelliklere sahip 5 paket sunulur; küçük satıcıdan kurumsal işletmeye kadar her ölçeğe uygun bir seçenek vardır.",
  },
  {
    q: "Fiyat ve stok güncellemeleri ne sıklıkla yapılır?",
    a: "Ürünler risk grubuna göre kademeli taranır: az stoklu veya çok satan ürünler sık (yaklaşık 15 dakikada bir), normal ürünler saatlik, hareketsiz ürünler günde birkaç kez kontrol edilir. Böylece hem güncellik hem maliyet dengelenir.",
  },
  {
    q: "eBay repricer nedir ve nasıl çalışır?",
    a: "Repricer, eBay satış fiyatını maliyet ve komisyonlara göre otomatik hesaplayıp güncelleyen sistemdir. Lean Automation'ın repricer'ı kaynak fiyat değiştiğinde eBay fiyatını iki yönde de otomatik ayarlar, kategori bazlı eBay komisyonunu hesaba katar ve belirlediğin taban fiyatın altına asla inmez.",
  },
  {
    q: "eBay mağazamı bağlamak güvenli mi?",
    a: "Evet. Bağlantı eBay'in resmi OAuth sistemi üzerinden yapılır; şifreni bizimle paylaşmazsın, yetkiyi doğrudan eBay'e verirsin. Erişim token'ları veritabanında AES-256 ile şifreli saklanır ve dilediğin zaman eBay hesabından yetkiyi iptal edebilirsin.",
  },
  {
    q: "İstediğim zaman iptal edebilir miyim?",
    a: "Evet. Uzun süreli taahhüt yoktur; aboneliğini istediğin an iptal edebilirsin. İptal sonrası dönem sonuna kadar erişimin sürer, listelerin ve verilerin hesabında korunur.",
  },
];
