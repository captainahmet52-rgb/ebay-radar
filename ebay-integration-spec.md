# eBay Entegrasyonu — Claude Code Görev Spec'i

> Bu dosyayı Claude Code'a context olarak ver (repo köküne `ebay-integration-spec.md` olarak koy ve CLAUDE.md'den referans ver). Aşağıdaki kurallara harfiyen uy.

## 0. Temel Kurallar (DEĞİŞTİRİLEMEZ)

- Dil kilidi: **TypeScript + Next.js 15 App Router**. Python/FastAPI YASAK.
- Stack: Prisma + NextAuth + Redis + BullMQ. Yeni bağımlılık eklemeden önce gerekçe yaz.
- eBay API sürekli değişiyor. **Endpoint imzalarını, request/response şemalarını ezberden yazma — aşağıdaki resmi dokümanı fetch edip oradan doğrula.** Bir alan/enum konusunda emin değilsen dokümanı oku, uydurma.
- Her external call idempotent ve retry-safe olacak. Hiçbir yerde sessiz `catch {}` yok — hatayı logla ve sırasına göre kuyruğa geri koy.

## 1. Compliance Guardrail'leri (zorunlu, koda gömülecek)

Bunlar "hatasız çalışma"nın yarısı. eBay bunlara uymayan çağrıları reddediyor veya listelemeyi gizliyor:

1. **Immutable User ID kullan, username DEĞİL.** DB şemasında satıcıyı/alıcıyı kalıcı (immutable) eBay user ID ile sakla. username alanını primary key veya foreign key olarak kullanma — eBay bunu değiştirilemez ID'lerle değiştirdi, username'e bağlarsan sonra migration çekersin.
2. **Condition details zorunlu.** Belirli kategorilerde listeleme oluştururken/güncellerken standart `conditionDescriptors` / condition details göndermeden çağrı atma. Kategori bazında zorunluluğu Taxonomy API'den kontrol et.
3. **Beden standardizasyonu (Giyim & Ayakkabı).** Bu kategorilerde aspect'leri eksik/standart-dışı gönderme — yoksa listeleme gizlenebilir/engellenebilir. Stok parser'ın bu kategorilerde beden alanını normalize etmeden offer publish etmesin.
4. **EU iade (ROW reason).** `getReturnDetails` dönüşünde bilinmeyen/yeni iade reason enum'ları gelebilir — kod bunları crash etmeden handle etsin (unknown → safe default).

## 2. OAuth Akışı (multi-tenant mağaza bağlama)

Bu sistemin kalbi. İki ayrı token tipi var, karıştırma:

- **User access token (Authorization Code Grant)** → her satıcı mağazası için. Müşteri "eBay'e bağlan" deyince bu akış çalışır.
  - Authorization Code → access token + **refresh token** al.
  - Refresh token'ı şifreli olarak (envelope encryption, ham değil) Prisma'da sakla, tenant'a bağla.
  - Access token kısa ömürlü → BullMQ'da bir refresh job'ı access token'ı süresi dolmadan önce yeniler. Refresh token'ın da son kullanma tarihi var, onu da takip et.
- **Application token (Client Credentials Grant)** → app-seviyesi, kullanıcıya bağlı olmayan işler (örn. Taxonomy okuma).

Referans: https://developer.ebay.com/api-docs/static/oauth-tokens.html

Görev: `lib/ebay/oauth.ts` — `getAuthUrl(tenantId)`, `exchangeCode(code, tenantId)`, `refreshAccessToken(tenantId)`, `getValidToken(tenantId)` (gerekirse otomatik refresh). Token'lar asla log'a yazılmayacak.

## 3. Listeleme Zinciri — Inventory API (REST)

Senin daha önce çözdüğün SKU/offerId/listingId konusu burada yaşıyor. Zinciri ayrı tut:

```
inventory_item (senin SKU'n)  →  offer (offerId)  →  publishOffer  →  listingId (eBay'in döndürdüğü)
```

- `createOrReplaceInventoryItem` → SKU + ürün verisi (başlık, açıklama, görsel, aspect, condition).
- `createOffer` → offerId üretir, fiyat + politika + kategori burada bağlanır.
- `publishOffer` → canlıya alır, **listingId** döner. Bu üçünü DB'de ayrı kolonlarda tut, asla aynı alana yazma.

Referans (method listesi): https://developer.ebay.com/api-docs/sell/inventory/resources/methods

Görev: `lib/ebay/inventory.ts` — bu zinciri tek bir `publishListing(tenantId, product)` fonksiyonunda orkestre et, her adım ayrı try/retry. Ara adımda hata olursa hangi aşamada kaldığını DB'ye yaz (resume edilebilir olsun).

## 4. Politikalar — Account API (listeleme ÖN KOŞULU)

Offer publish etmeden önce satıcının **fulfillment (kargo), payment, return** politikaları eBay'de tanımlı olmalı. Yoksa publish 400 döner.

Görev: `lib/ebay/account.ts` — mağaza bağlandığında politikaları çek/cache'le. Eksikse kullanıcıya "şu politikayı eBay'de tanımla" uyarısı dön. Offer'da bu policy ID'lerini referansla.

Referans: https://developer.ebay.com/api-docs/sell/account/resources/methods

## 5. Sipariş & Order-Time Verification — Fulfillment API

Senin kilit güvenlik mekanizman. Sipariş geldiğinde, kargolamadan önce Amazon tarafında stok/fiyat hâlâ geçerli mi diye doğrula.

Görev: `lib/ebay/fulfillment.ts` — `getOrders` ile yeni siparişleri çek (webhook yoksa polling), BullMQ'da `verify-order` job'ı: Amazon scrape → stok var & fiyat marj koruyorsa devam, değilse siparişi flag'le / iptal akışına sok. `createShippingFulfillment` ile takip no gir.

Referans: https://developer.ebay.com/api-docs/sell/fulfillment/resources/methods

## 6. Kategori & Aspect — Taxonomy API

Listeleme sırasında zorunlu alanları (item specifics / aspects) buradan al. Hard-code etme — kategori bazında değişiyor.

Görev: `lib/ebay/taxonomy.ts` — `getCategoryTree`, `getItemAspectsForCategory`. Sonuçları Redis'te cache'le (kategori ağacı sık değişmez, TTL uzun). Compliance §1.2 ve §1.3 kontrolleri buradan beslenir.

Referans: https://developer.ebay.com/api-docs/commerce/taxonomy/resources/methods

## 7. Rate Limit, Hata ve Kuyruk Stratejisi

- eBay'in çağrı başına günlük limitleri var. Her API ailesi için limiti `getRateLimits` (Developer Analytics) ile çek, BullMQ rate limiter'ına besle.
- `429` ve `5xx` → exponential backoff ile retry (jitter ekle). `4xx` (auth hariç) → retry etme, hatayı kalıcı işaretle.
- Token expired (`401`/invalid_token) → otomatik refresh + tek sefer retry.
- Senin polling tier'ların (15 dk / 1-3 saat / 12 saat) BullMQ repeatable job'ları olarak; rate limit bütçesini tier'lara göre dağıt, hot ürünler bütçeyi yemesin.

## 8. Claude Code İçin Çalışma Talimatı

1. Önce bu dosyayı ve repo'daki CLAUDE.md'yi oku.
2. §2 → §4 → §6 → §3 → §5 sırasıyla kur (önce auth ve ön koşullar, sonra listeleme, en son sipariş).
3. Her modül için: önce ilgili eBay doküman URL'ini fetch et, gerçek şemayı doğrula, sonra TypeScript tipi + fonksiyon + Prisma migration yaz.
4. Her modülden sonra Sandbox ortamında bir smoke test yaz (production'a dokunma).
5. Token, API key, refresh token hiçbir log/hata mesajında görünmesin — bunu lint kuralı gibi uygula.

## 9. Önce Sandbox

Production erişimi ayrı başvuru gerektiriyor ve dropshipping iş modeli eBay'in onay sürecinde sorgulanabilir. Tüm geliştirmeyi **Sandbox**'ta yap, production'a ancak başvuru onayı sonrası geç.
