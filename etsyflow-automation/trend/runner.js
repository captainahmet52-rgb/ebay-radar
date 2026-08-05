import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { scrapeMultipleQueries } from './scraper.js';
import { analyzeTrends } from './analyzer.js';
import { uploadTrendInsight, hasActiveTrend } from './uploader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Tek bir kategori+alt kategori için trend analizi yapar.
 * Aktif veri varsa anında döner (bekleme yok).
 * Her otomasyon üretiminden önce çağrılır.
 */
export async function ensureTrendForCategory(category, subCategory) {
    const active = await hasActiveTrend(category, subCategory);
    if (active) {
        console.log(`⏭️  [TREND] Güncel veri mevcut: ${category} → ${subCategory}`);
        return;
    }

    console.log(`🔍 [TREND] Veri yok, scrape başlıyor: ${category} → ${subCategory}`);

    let queries;
    try {
        queries = JSON.parse(readFileSync(join(__dirname, 'search-queries.json'), 'utf8'));
    } catch (e) {
        console.warn('⚠️ [TREND] search-queries.json okunamadı, trend atlanıyor:', e.message);
        return;
    }

    const searchTerms = queries?.[category]?.[subCategory];
    if (!searchTerms || searchTerms.length === 0) {
        console.warn(`⚠️ [TREND] ${category} → ${subCategory} için arama terimi bulunamadı.`);
        return;
    }

    try {
        const products = await scrapeMultipleQueries(searchTerms, 50);

        if (products.length === 0) {
            await uploadTrendInsight({
                search_query: searchTerms[0],
                trending_keywords: [], trending_styles: [], trending_niches: [],
                top_sellers_summary: '', design_directions: [], sample_titles: [],
                avg_price: 0, avg_sales: 0, scraped_count: 0
            }, category, subCategory, 1).catch(() => {});
            return;
        }

        const trendData = await analyzeTrends(products, searchTerms[0], category, subCategory);
        await uploadTrendInsight(trendData, category, subCategory);
        console.log(`✅ [TREND] Güncellendi: ${category} → ${subCategory}`);
    } catch (err) {
        console.warn(`⚠️ [TREND] Scrape başarısız, üretim devam ediyor: ${err.message}`);
    }
}

export async function runTrendAnalysis() {
    console.log(`\n📊 [TREND] Analiz turu başlıyor... [${new Date().toLocaleTimeString()}]`);

    let queries;
    try {
        queries = JSON.parse(readFileSync(join(__dirname, 'search-queries.json'), 'utf8'));
    } catch (e) {
        console.error('❌ [TREND] search-queries.json okunamadı:', e.message);
        return;
    }

    let processed = 0;
    let skipped = 0;

    for (const [category, subCategories] of Object.entries(queries)) {
        for (const [subCategory, searchTerms] of Object.entries(subCategories)) {

            // Aktif ve süresi dolmamış trend varsa atla
            const active = await hasActiveTrend(category, subCategory);
            if (active) {
                skipped++;
                console.log(`⏭️  [TREND] Atlandı (aktif veri var): ${category} → ${subCategory}`);
                continue;
            }

            console.log(`\n🔍 [TREND] İşleniyor: ${category} → ${subCategory}`);

            try {
                // Scrape
                const products = await scrapeMultipleQueries(searchTerms, 50);

                if (products.length === 0) {
                    console.warn(`⚠️ [TREND] Sonuç bulunamadı: ${category} → ${subCategory}. 24 saat sonra tekrar denenecek.`);
                    // 24 saatlik placeholder kayıt — tekrar atlanmasın
                    await uploadTrendInsight({
                        search_query: searchTerms[0],
                        trending_keywords: [],
                        trending_styles: [],
                        trending_niches: [],
                        top_sellers_summary: '',
                        design_directions: [],
                        sample_titles: [],
                        avg_price: 0,
                        avg_sales: 0,
                        scraped_count: 0
                    }, category, subCategory, 1).catch(() => {});
                    continue;
                }

                // Analyze
                const trendData = await analyzeTrends(
                    products,
                    searchTerms[0],
                    category,
                    subCategory
                );

                // Upload
                await uploadTrendInsight(trendData, category, subCategory);

                processed++;
                console.log(`✅ [TREND] Tamamlandı: ${category} → ${subCategory}`);

                // Kategoriler arası bekleme (Apify rate limit)
                await new Promise(r => setTimeout(r, 5000));

            } catch (err) {
                console.error(`❌ [TREND] Hata (${category} → ${subCategory}):`, err.message);
            }
        }
    }

    console.log(`\n📊 [TREND] Tur bitti. İşlenen: ${processed}, Atlanan: ${skipped}`);
}
