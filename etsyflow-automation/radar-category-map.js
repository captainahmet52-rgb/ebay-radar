/**
 * ETSYFLOW ↔ RADAR KATEGORİ EŞLEŞTİRMESİ
 *
 * Radar (urun-radari), Amazon'a geçmeden önce bu AYNI el yapımı ürün işi
 * için yazılmış bir "Etsy Fikir Motoru" içeriyor (gerçek talep sinyaline
 * dayalı, somut ürün/motif fikirleri üretiyor). Burada onu, etsyflow'un her
 * (kategori, alt kategori) çiftini Radar'daki KARŞILIK GELEN ürüne — ürün
 * ürün, isim isim kontrol edilerek — eşliyoruz.
 *
 * KURAL: Sadece Radar'da GERÇEKTEN aynı fiziksel ürünü temsil eden bir kayıt
 * varsa eşleştirildi. Karşılığı olmayanlar burada YOK — o alt kategoriler
 * için otomasyon Radar'a hiç sormaz, doğrudan kendi GPT fikir üretimine
 * (utils.js generateProductIdea) döner.
 */

export const RADAR_CATEGORY_MAP = {
    'Crochet': {
        'Anahtarlık': 'tığ işi',   // Radar ürünü: "anahtarlık (tığ işi anahtarlık)"
        'Amigurumi': 'tığ işi',    // Radar ürünü: "amigurumi"
        'Dönence':   'tığ işi',    // Radar ürünü: "dönence"
        // Not eşleşti: Radar'daki "4lü bardak altlığı set", "araba aksesuarı
        // (dikiz aynası)", "koltuk aksesuarı" — etsyflow'un Crochet haritasında
        // karşılığı yok.
    },
    'Punch Needle': {
        'Broş':                    'punch', // Radar ürünü: "4lü broş set"
        'Bardak altlığı':          'punch', // Radar ürünü: "4lü bardak altlığı (12cm 4lü set)"
        'Mousepad':                'punch', // Radar ürünü: "mousepad set (2li)"
        'Tek Taraflı Anahtarlık':  'punch', // Radar ürünü: "punch keychain" (en yakın eşleşme — Radar'da "tek taraflı" ayrımı yok)
        // Not eşleşti: "Yastık kılıfı" — Radar'ın "punch" listesinde karşılığı
        // yok (kitap ayracı/tablo/kapı süsü/ayna gibi başka ürünler var, ama
        // yastık kılıfı yok).
    },
    '3D': {
        'Saksı':          '3D Baskı', // Radar ürünü: "saksı (5saksı)"
        'Diş fırçalığı':  '3D Baskı', // Radar ürünü: "diş fırçalığı"
        'Kalemlik':       '3D Baskı', // Radar ürünü: "kalemlik"
        'Anahtarlık':     '3D Baskı', // Radar ürünü: "3d anahtarlık"
        'Figure':         '3D Baskı', // Radar ürünü: "figür"
        'Telefon standı': '3D Baskı', // Radar ürünü: "3D Telefon Standı"
        // Not eşleşti: "Masa organizeri", "Mum tutucu", "Araba parfümü" —
        // Radar'ın "3D Baskı" listesinde bu üçünün karşılığı yok (Radar'da
        // bunun yerine "3D çanta", "kulaklık standı", "gözlük standı" var —
        // etsyflow'da onlar için üretici yok, o yüzden ikisi de eşleşmedi).
    },
    'Metal Wall Art': {
        'Metal Pano': 'Metal Kesim Tablo', // Radar ürünü: "metal kesim tablolar" — ideaType TASARIM, motif önerisi, birebir uyumlu.
    },
    // Tshirt, Cam Saat, Digital: Radar'da bu kategorilerin hiç karşılığı yok
    // (Radar hiç POD tişört, cam saat ya da dijital PDF tarif ürünü
    // içermiyor) — hepsi kendi GPT fikir üretimine düşer.
};
