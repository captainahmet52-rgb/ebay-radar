import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

export async function uploadTrendInsight(trendData, category, subCategory, expiresInDays = 7) {
    console.log(`📤 [Supabase] Trend kaydediliyor: ${category} → ${subCategory}`);

    // Aynı kategori+subKategori için eski kayıtları deaktif et
    await supabase
        .from('trend_insights')
        .update({ is_active: false })
        .eq('category', category)
        .eq('sub_category', subCategory);

    const payload = {
        category,
        sub_category: subCategory,
        search_query: trendData.search_query,
        trending_keywords: trendData.trending_keywords,
        trending_styles: trendData.trending_styles,
        trending_niches: trendData.trending_niches,
        top_sellers_summary: trendData.top_sellers_summary,
        design_directions: trendData.design_directions,
        sample_titles: trendData.sample_titles,
        avg_price: trendData.avg_price,
        avg_sales: trendData.avg_sales,
        scraped_count: trendData.scraped_count,
        is_active: true,
        expires_at: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    };

    const { data, error } = await supabase
        .from('trend_insights')
        .insert(payload)
        .select()
        .single();

    if (error) throw error;

    console.log(`✅ [Supabase] Kaydedildi! ID: ${data.id} — ${new Date(data.expires_at).toLocaleDateString('tr-TR')}'e kadar geçerli`);
    return data;
}

export async function hasActiveTrend(category, subCategory) {
    const { data } = await supabase
        .from('trend_insights')
        .select('id, expires_at, scraped_count')
        .eq('category', category)
        .eq('sub_category', subCategory)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .gt('scraped_count', 0)  // boş kayıtları aktif sayma
        .limit(1)
        .maybeSingle();

    return !!data;
}

export async function markDesignAsUsed(designTitle, category, subCategory) {
    try {
        const { data } = await supabase
            .from('trend_insights')
            .select('id, used_designs')
            .eq('category', category)
            .eq('sub_category', subCategory)
            .eq('is_active', true)
            .maybeSingle();

        if (!data) return;

        const current = data.used_designs || [];
        if (current.includes(designTitle)) return;

        await supabase
            .from('trend_insights')
            .update({ used_designs: [...current, designTitle] })
            .eq('id', data.id);

        console.log(`🧠 [Hafıza] Kaydedildi: "${designTitle}"`);
    } catch (err) {
        console.warn('⚠️ [Hafıza] Tasarım kaydedilemedi:', err.message);
    }
}
