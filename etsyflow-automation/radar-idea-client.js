import axios from 'axios';
import { RADAR_CATEGORY_MAP } from './radar-category-map.js';

let categoryCache = null;
let categoryCacheAt = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 dakika — kategori listesi sık değişmez

async function getRadarAuth() {
    const password = process.env.RADAR_APP_PASSWORD;
    return password ? { username: '', password } : undefined;
}

async function getRadarCategories(baseUrl) {
    if (categoryCache && (Date.now() - categoryCacheAt) < CACHE_TTL_MS) return categoryCache;
    try {
        const res = await axios.get(`${baseUrl}/api/categories`, {
            auth: await getRadarAuth(),
            timeout: 8000,
        });
        categoryCache = res.data?.data ?? null;
        categoryCacheAt = Date.now();
        return categoryCache;
    } catch (err) {
        console.warn('⚠️ [Radar] Kategori listesi alınamadı:', err.message);
        return null;
    }
}

/**
 * Radar'ın Etsy Fikir Motoru'ndan bu (kategori, alt kategori) için fikir
 * ister. RADAR_CATEGORY_MAP'te eşleşme yoksa, Radar'a hiç ulaşılamıyorsa
 * veya istek başarısız olursa null döner — çağıran taraf (utils.js
 * generateProductIdea) kendi GPT fikir üretimine düşer. Üretim bu isteğe
 * ASLA bağımlı kalmaz: Radar kapalıysa/yavaşsa bile üretim durmaz.
 */
export async function fetchRadarIdea(category, subCategory) {
    const radarCategoryName = RADAR_CATEGORY_MAP[category]?.[subCategory];
    if (!radarCategoryName) return null; // Bu alt kategori Radar'a hiç eşlenmemiş

    const baseUrl = process.env.RADAR_API_URL;
    if (!baseUrl) return null; // Radar entegrasyonu yapılandırılmamış

    try {
        const categories = await getRadarCategories(baseUrl);
        const match = categories?.find(c => c.name === radarCategoryName);
        if (!match) {
            console.warn(`⚠️ [Radar] "${radarCategoryName}" kategorisi Radar'da bulunamadı (silinmiş/yeniden adlandırılmış olabilir).`);
            return null;
        }

        const res = await axios.post(
            `${baseUrl}/api/categories/${match.id}/ideas`,
            {},
            { auth: await getRadarAuth(), timeout: 25000 }
        );

        const cards = res.data?.data;
        if (!Array.isArray(cards) || cards.length === 0) return null;

        // Radar fikirleri zaten skora göre üretiyor (spec: en fazla 3, kalite > adet) — ilkini al
        const best = cards[0];
        console.log(`📡 [Radar] Fikir alındı: "${best.title}" (skor: ${best.score}) — ${best.why}`);

        // "title" zaten Radar'ın kendi kuralı gereği somut/görsel bir tasarım
        // fikri (ör. "Pembe Doktor Ayıcık Anahtarlık") — hem subject hem
        // details olarak kullanılabilir. "why" pazar gerekçesi, görsel
        // üretim prompt'una karıştırılmaz.
        return {
            subject: best.title,
            details: best.title,
        };
    } catch (err) {
        console.warn('⚠️ [Radar] Fikir isteği başarısız, GPT üretimine düşülüyor:', err.message);
        return null;
    }
}
