import 'dotenv/config';
import { ApifyClient } from 'apify-client';

const apify = new ApifyClient({ token: process.env.APIFY_TOKEN });

export async function scrapeEtsyBestSellers(searchQuery, maxResults = 50) {
    console.log(`🕷️ [Apify] Aranıyor: "${searchQuery}"...`);

    const searchUrl = `https://www.etsy.com/search?q=${encodeURIComponent(searchQuery)}&order=most_relevant`;

    try {
        const run = await apify.actor('emastra/etsy-scraper').call({
            searchUrls: [{ url: searchUrl }],
            maxItems: maxResults,
        }, { waitSecs: 120 });

        const { items } = await apify.dataset(run.defaultDatasetId).listItems();
        console.log(`✅ [Apify] ${items.length} ürün çekildi.`);
        return normalizeProducts(items);
    } catch (err) {
        console.warn(`⚠️ [Apify] emastra başarısız (${err.message}), trudax deneniyor...`);

        try {
            const fallbackRun = await apify.actor('trudax/etsy-scraper').call({
                searchUrls: [{ url: searchUrl }],
                maxItems: maxResults,
            }, { waitSecs: 120 });

            const { items } = await apify.dataset(fallbackRun.defaultDatasetId).listItems();
            console.log(`✅ [Apify] trudax ile ${items.length} ürün çekildi.`);
            return normalizeProducts(items);
        } catch (fallbackErr) {
            console.error(`❌ [Apify] Her iki aktör de başarısız:`, fallbackErr.message);
            return [];
        }
    }
}

function normalizeProducts(items) {
    return items
        .map(item => ({
            title: item.title || '',
            price: parseFloat(item.price || item.originalPrice || 0),
            sales_count: parseInt(item.sales || item.totalSales || 0),
            reviews: parseInt(item.reviewCount || item.reviews || 0),
            rating: parseFloat(item.rating || item.stars || 0),
            tags: item.tags || [],
            shop_name: item.shopName || item.shop?.name || '',
            url: item.url || item.link || '',
            image_url: item.mainImage || item.images?.[0] || item.thumbnailUrl || '',
        }))
        .filter(p => p.title && p.price > 0)
        .sort((a, b) => b.sales_count - a.sales_count);
}

export async function scrapeMultipleQueries(queries, maxPerQuery = 50) {
    const allProducts = [];

    for (const query of queries) {
        const products = await scrapeEtsyBestSellers(query, maxPerQuery);
        allProducts.push(...products.map(p => ({ ...p, search_query: query })));
        await new Promise(r => setTimeout(r, 2000));
    }

    const uniqueMap = new Map();
    for (const p of allProducts) {
        if (!uniqueMap.has(p.url)) uniqueMap.set(p.url, p);
    }

    const unique = [...uniqueMap.values()];
    console.log(`📦 Toplam: ${allProducts.length} → Tekrarsız: ${unique.length} ürün`);
    return unique;
}
