eBay–Amazon Otomasyon Sistemi — Proje Planı

Bu dosya projenin tek referans kaynağıdır. Claude Code her oturumda bunu
okumalı ve buradaki kararlara uymalıdır. Yeni bir karar alındığında bu
dosya güncellenir.


0. DİL KİLİDİ — EN ÖNEMLİ KURAL (asla ihlal etme)
Bu proje %100 TypeScript'tir. Python / FastAPI / SQLAlchemy KESİNLİKLE YASAK.

Backend, API, worker, scriptler → hepsi TypeScript (Node.js çalışma zamanı).
Web + API → Next.js 15 (App Router). ORM → Prisma. Auth → NextAuth.
Eğer projede .py dosyası, requirements.txt, asyncpg, uvicorn, fastapi,
alembic veya herhangi bir Python izi görürsen: bunlar yanlıştır, sil ve
TypeScript karşılığıyla yeniden kur.
Token şifreleme Python Fernet ile değil, Node'un yerleşik crypto modülüyle yapılır.
Yeni dosya açarken dilden emin değilsen: cevap her zaman TypeScript.


1. Sistem nedir?
Çok kiracılı (multi-tenant) bir Amazon → eBay otomasyon SaaS'ı.
Kullanıcılar kendi eBay mağazalarını sisteme bağlar; sistem Amazon ürünlerini
otomatik bulur, listeler ve fiyat/stok değişimlerini sürekli takip ederek günceller.
Akış (boru hattı):

NOT: eBay ürün radarı (mağaza takibi + otomatik ürün bulma) 2026-07-05'te
KALDIRILDI — proje sahibi kararı. Depo artık radar ile DEĞİL; toplu ASIN
yükleme, ASIN Grabber eklentisi ve ilan içe aktarma ile doldurulur.
Depo — ürünleri veritabanında biriktirir (ASIN bazlı)
Veri kaynağı — Amazon fiyat + stok verisini çeker
Fiyat + stok motoru (repricer) — eBay fiyatını hesaplar, otomatik ayarlar
eBay listeleme — kullanıcı mağazalarına listeler/günceller
Sipariş-anı kontrol — satış anında veriyi canlı doğrular


2. Teknoloji yığını (stack)

Stack, mevcut Claude Code agent'larına göre sabitlendi. Agent'lar
(back " 128Aend-doctor, builder, ui-agent) Next.js + Prisma + NextAuth varsayıyor;
proje de bunu kullanır ki agent'lar kutudan çıktığı gibi çalışsın.

KatmanSeçimNotTam yığınNext.js 15 (App Router) + TypeScriptWeb + API + panel tek projede. Yapı src/ altındaORM / DBPrisma + PostgreSQLŞema prisma/schema.prisma, client src/lib/prisma.tsKimlikNextAuthauthOptions her zaman @/lib/auth'tan. Roller: seller / adminAuth yardımcılarısrc/lib/api-helpers.tsrequireAuth, requireSeller, requireAdminİş kuyruğuRedis + BullMQTarama + repricer; ayrı worker process (Next.js dışında)FrontendReact 19 + Tailwind v4 + shadcn/uiMüşteri paneliReverse proxynginx veya Caddy + SSLAmazon verisiHazır e-ticaret scraper APIDIY scraper KURMA. Ucuz, erişilebilir API (örn. ScrapingBee)eBay entegrasyonueBay Sell / Inventory APIOAuth ile kullanıcı mağazası bağlamaBarındırmaTek VPS (Hetzner/DigitalOcean ~20–40$/ay)Next.js + worker + Redis + Postgres burada
Cron/worker notu: Repricer ve tarama, Next.js request handler'ı içinde değil,
ayrı bir BullMQ worker process'inde çalışır (aynı repo, aynı Prisma client).
Korumalı cron route'ları Authorization: Bearer ${CRON_SECRET} ile kontrol edilir.
Önemli mimari kararı: Scraping işini KENDİMİZ yapmıyoruz. Residential proxy +
anti-bot + parser bakımı çok pahalı ve kırılgan. Bunun yerine hazır bir e-ticaret
scraper API'si kullanıyoruz — proxy/CAPTCHA/parser işini onlar hallediyor, biz ASIN
verip JSON alıyoruz. Oxylabs pahalı olduğu için tercih edilmez; e-ticarete özel
ucuz API'ler (Decodo vb.) seçilir.

2b. Skills (yetenekler) — .claude/skills/
Bu skill'ler .claude/skills/ klasöründe dosya olarak durur (içerikleri bu
dosyaya kopyalanmaz; gerektiğinde yüklenirler). Önemli: subagent'lar skill'leri
otomatik bulmaz — her skill, kullanacak agent'ın skills: frontmatter alanında
açıkça bildirilmiştir.
SkillNe işe yararBağlı agentapi-designAPI route, server action, Zod doğrulama, hata/yanıt şekli kurallarıbuilder, backend-doctorfrontend-designProje tasarım token'ları: renk, boşluk, tipografi, bileşen kurallarıui-agentsenior-frontendReact/Next/TS bileşen üretimi, performans, bundle analiziui-agentui-ux-pro-max50+ stil, 161 renk paleti, 57 font eşleşmesi, 99 UX kuralıui-agentvercel-composition-patternsReact kompozisyon: compound component, render props, React 19ui-agentvercel-react-best-practicesVercel'in 70 React/Next performans kuralı (inceleme için)reviewerweb-design-guidelinesUI/erişilebilirlik/UX uyumluluk denetimireviewerframer-motion-reactFramer Motion + React: AnimatePresence, motion, SSRui-agentframer-motion-gesturesSürükle, tap, hover, dokunma animasyonları(gerekince ui-agent'a ekle)framer-motion-layoutlayoutId, paylaşılan layout geçişleri, AnimatePresence(gerekince ui-agent'a ekle)framer-motion-scrollScroll'a bağlı animasyon, parallax, ilerleme göstergesi(gerekince ui-agent'a ekle)framer-motion-variantsOrkestralı/staggered animasyon, variant state machine(gerekince ui-agent'a ekle)
Kurulum: skills/ klasörünün tamamını projenin köküne .claude/skills/
olarak kopyala. Yapı şöyle olmalı:
.claude/
├── agents/      ← 7 agent .md dosyası
└── skills/
    ├── api-design/SKILL.md
    ├── frontend-design/SKILL.md
    ├── senior-frontend/ (SKILL.md + scripts/ + references/)
    ├── ui-ux-pro-max/SKILL.md
    ├── vercel-composition-patterns/ (SKILL.md + rules/)
    ├── vercel-react-best-practices/ (SKILL.md + rules/)
    ├── web-design-guidelines/SKILL.md
    └── framer-motion-*/SKILL.md  (5 adet)
Context notu: Bir agent'a ne kadar çok skill bağlarsan, o agent her
çalıştığında o kadar çok bağlam yüklenir. ui-agent'a 5 skill bağlı; yavaşlık
hissedersen az kullandıklarını frontmatter'dan çıkar. 4 ekstra framer-motion
skill'i sadece o tür animasyon yapacağın agent'a, gerektiğinde eklenir.

3. Fiyatlandırma kuralları (repricer'ın beyni)
Hedef: Tüm maliyetler düşüldükten sonra satışın net %20'si kâr kalmalı.
Formül:
eBay_fiyatı = (amazon_maliyeti + sabit_ücret) / (1 - komisyon_oranı - 0.20)

sabit_ücret = eBay sipariş başına ücret: 0.40$ (10$ üstü), 0.30$ (10$ altı)
komisyon_oranı = eBay final value fee. Kategoriye göre değişir.
Varsayılan ~0.136 (%13.6); bazı kategoriler %6.7–%15.3 arası. Sabit yazma,
ürün kategorisinden çek.

Örnek: Amazon 100$ → eBay fiyatı = (100 + 0.40) / (1 − 0.136 − 0.20)
= 100.40 / 0.664 = ~151$ → net kâr ~30$ (satışın %20'si).
Koruma kuralları:

Taban (floor): Hesaplanan fiyat belirlenen tabanın altındaysa listeleme.
Otomatik takip: Amazon fiyatı artar/azalırsa eBay fiyatı otomatik
yeniden hesaplanır (her iki yönde, kullanıcıya sormadan).
Aşırı zıplama freni: Amazon fiyatı tek taramada %50'den fazla artarsa,
güncelleme yapma — listeyi kısa süre otomatik duraklat, sonraki tarama
fiyatı doğrularsa yeni fiyattan otomatik geri aç. (Kullanıcıya sorma.)
Minimum ürün fiyatı: Çok ucuz ürünlerde sabit ücret marjı yer. Ürün
eklemede bir alt eşik uygula (örn. 15$ altını alma).


4. Stok kuralları
Amazon genelde kesin sayı vermez; üç sinyal verir: "bol stokta",
"sadece N kaldı", "tükendi".
Amazon durumuYapılacakBol stoktaeBay'de tavan 2 adet göster"Sadece 3 kaldı"eBay adedini 1'e düşür + ürünü hızlı tarama grubuna al"Sadece 1–2 kaldı"Listeyi duraklat (qty 0)TükendiListeyi duraklat (qty 0)
Duraklat = sil DEĞİL. Liste durur, qty 0 olur; stok gelince geri açılır.
Geri açarken: Önce veriyi yeniden çek → fiyatı yeniden hesapla → SONRA aç.
Asla eski fiyattan açma.
Scraper gereği: API'nin "az kaldı / Only N left" sinyalini ayrı parse et,
sadece var/yok yetmez.

MÜNHASIRLIK (2026-07-06): Bir depo ürünü YALNIZ BİR mağazaya yüklenir/dağıtılır.
ebay-auto-upload: herhangi bir kullanıcıda kapatılmamış (ended olmayan) listing'i
olan ASIN havuzdan düşer; distribute-products: distributions none:{} (hiç
dağıtılmamış). Listing "ended" olursa ASIN yeniden boşa çıkar.

5. Tarama (polling) — kademeli
SADECE YÜKLENMİŞ ÜRÜN TARANIR (2026-07-06): dispatch-polls yalnız "takibe
değer" listing'i olan ürünleri tarar (eBay'de yayınlanmış+kapatılmamış, yayın
hattında aktif, ya da hatasız stok-duraklatmalı recovery adayı). Depoda boşta
duran / yayına hiç çıkmamış / tüm listeleri kapatılmış ürüne ScrapingBee
kredisi yakılmaz. Admin /admin/depot sayfasında "Yüklendi / Boşta" filtresi var.
Hepsini sık taramak hem pahalı hem gereksiz. Risk grubuna göre ayır:
GrupKapsamSıklıkSıcakaz stoklu / çok satan / pahalı15 dk (gerekirse 10 dk)Normalortalama ürünler1–3 saatÖlübol stok, satmıyor, ucuz12 saat
Bir ürün az-stok bölgesine girince otomatik sıcak gruba taşınır.
Sipariş-anı doğrulama (en kritik koruma): eBay sipariş webhook'u tetiklenince,
sipariş işlenmeden ÖNCE o ürünün Amazon fiyat + stoğu canlı bir kez daha çekilir.
Uygunsa işlenir; stok bitmiş / fiyat zıplamışsa sipariş iptal/iade edilir.
Bu, tarama aralığındaki "gecikme penceresi" zararını kapatan parçadır.

6. Veritabanı şeması (taslak)
sql-- Kullanıcılar (kiracılar)
users (
  id, email, password_hash, plan, created_at
)

-- Bağlı eBay mağazaları
ebay_accounts (
  id, user_id FK, ebay_user_id,
  oauth_token_encrypted,        -- ŞİFRELİ saklanacak
  refresh_token_encrypted,      -- ŞİFRELİ saklanacak
  token_expires_at
)

-- Ürün deposu
products (
  id, asin, title, category, ebay_fee_rate,
  amazon_price, amazon_stock_status,   -- in_stock / low(N) / out
  ebay_price, target_margin,           -- varsayılan 0.20
  floor_price, poll_tier,              -- hot / normal / dead
  last_scraped_at, status              -- active / paused
)

-- Kullanıcı listelemeleri (hangi ürün hangi mağazada)
listings (
  id, user_id FK, product_id FK, ebay_listing_id,
  current_qty, current_price, status
)

-- Siparişler
orders (
  id, user_id FK, listing_id FK,
  sold_price, verified_at, fulfillment_status
)

7. Güvenlik (ihlal edilemez)

eBay OAuth token'ları ŞİFRELİ saklanır (at-rest encryption). Düz saklama yok.
API anahtarları (.env), koda asla gömülmez.
Token yenileme (refresh) akışı düzgün kurulur.
Müşteri verisi sızarsa proje biter — bu en yüksek öncelik.


8. Operasyonel kurallar

Günlük otomatik DB yedeği baştan kurulur.
Uptime izleme (örn. UptimeRobot) baştan kurulur. Sistem çökerse
müşterilerin listeleri güncellenmez = zarar = churn.
Tek VPS = tek arıza noktası. Büyüyünce işçi katmanı ayrı sunucuya alınır.
Gerçek maliyet sunucu değil, scraper API istek sayısıdır → kademeli
tarama ile kontrol edilir.


9. Build yol haritası (sırayla — bir anda hepsini yapma)

Kural: Her adım çalışıp test edilmeden sonrakine geçilmez.


 Adım 1 — Çekirdek motor. Komut satırı scripti: ASIN ver →
scraper API'den fiyat + stok çek → repricer formülünü uygula →
Amazon fiyatı, eBay fiyatı, net kâr, stok durumunu yazdır.
Veritabanı yok, arayüz yok. Sadece bu.
 Adım 2 — Hafıza. Sonucu PostgreSQL products tablosuna yaz.
 Adım 3 — Tek mağaza listeleme. eBay Sell API ile KENDİ hesabına
bir ürün listele. Multi-tenant henüz yok.
 Adım 4 — Otomasyon. Adım 1–3'ü iş kuyruğuna koy; kademeli
tarama ile kendi kendine dönsün. Stok/fiyat kurallarını uygula.
 Adım 5 — Sipariş-anı doğrulama. eBay webhook → canlı kontrol.
 Adım 6 — Multi-tenant. Kullanıcı kaydı, OAuth ile mağaza bağlama,
token şifreleme.
 Adım 7 — Müşteri paneli. Frontend: ürün ekleme, kural ayarları, raporlar.
 Adım 8 — Ödeme + plan. Stripe/Paddle, abonelik.
 Adım 9 — Yedek, izleme, ölçek. Operasyonel sağlamlaştırma.


10. İlk Claude Code görevi (Adım 1)
Önce: Bir scraper API'sine ücretsiz deneme ile kaydol, API anahtarını al.
Sonra Claude Code'a ver:
Bir TypeScript scripti yaz (scripts/test-repricer.ts). Komut satırından
bir Amazon ASIN'i alsın. [scraper API adı] kullanarak o ürünün güncel
fiyatını ve stok durumunu çeksin. Sonra şu formülle eBay satış fiyatını
hesaplasın:

eBay_fiyatı = (amazon_fiyatı + 0.40) / (1 - komisyon - 0.20)
komisyon varsayılan 0.136 olsun.

Konsola yazdırsın: Amazon fiyatı, hesaplanan eBay fiyatı, net kâr,
stok durumu. API anahtarını .env dosyasından oku (process.env), koda gömme.

`npx tsx scripts/test-repricer.ts <ASIN>` ile çalışsın. Başka hiçbir şey
ekleme — ne veritabanı, ne web arayüzü, ne Next.js. Sadece bu script.

Not — politika riski (bilinçli kabul edildi)
eBay, Amazon'dan perakende dropshipping'i (retail arbitrage) politikasında
yasaklıyor; tespit halinde hesap askıya alma riski vardır ve bu risk SaaS'ta
müşteri hesaplarına biner. Proje sahibi bu riski bilerek bu modelle ilerlemeyi
seçmiştir. Alternatif (onaylı toptancı tedarikçi modeli) ileride değerlendirilebilir;
mimari aynı kalır, sadece veri kaynağı değişir.