import 'dotenv/config';
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.VITE_OPENAI_API_KEY });

export async function analyzeTrends(products, searchQuery, category, subCategory) {
    console.log(`🧠 [GPT] Trend analizi başlıyor... (${products.length} ürün, ${category} → ${subCategory})`);

    const topSellers = products
        .sort((a, b) => b.sales_count - a.sales_count)
        .slice(0, 20);

    const productSummary = topSellers.map((p, i) =>
        `${i + 1}. "${p.title}" — $${p.price}, ${p.sales_count} satış, ${p.reviews} yorum, ⭐${p.rating}`
    ).join('\n');

    const prompt = `You are an expert Etsy market analyst specializing in handmade products.

Category: ${category} — Sub-category: ${subCategory}
Search query: "${searchQuery}"

Top-selling Etsy products found:
${productSummary}

Analyze these best sellers and extract:

1. trending_keywords: Top 10 most recurring keywords from titles (English, lowercase)
2. trending_styles: Top 5 design/style patterns you observe
3. trending_niches: Top 5 target audience niches
4. top_sellers_summary: 2-3 sentence summary of what dominates this market RIGHT NOW
5. design_directions: 5 SPECIFIC and UNIQUE design ideas inspired by trends but NOT copying any existing product. Each must be a detailed visual description for an AI image generator.
6. avg_price: Average price of top sellers (number only)

CRITICAL: design_directions must be ORIGINAL — inspired by trends but completely unique.

Return JSON:
{
    "trending_keywords": ["keyword1", ...],
    "trending_styles": ["style1", ...],
    "trending_niches": ["niche1", ...],
    "top_sellers_summary": "...",
    "design_directions": [
        {"concept": "Short name", "visual_prompt": "Detailed AI image description"},
        ...
    ],
    "avg_price": 24.50
}`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7
    });

    const result = JSON.parse(response.choices[0].message.content);

    console.log(`✅ [GPT] Analiz tamamlandı!`);
    console.log(`   📌 Keywords: ${result.trending_keywords?.slice(0, 5).join(', ')}`);
    console.log(`   🎨 Styles: ${result.trending_styles?.slice(0, 3).join(', ')}`);
    console.log(`   💡 ${result.design_directions?.length || 0} tasarım fikri üretildi`);

    return {
        search_query: searchQuery,
        trending_keywords: result.trending_keywords || [],
        trending_styles: result.trending_styles || [],
        trending_niches: result.trending_niches || [],
        top_sellers_summary: result.top_sellers_summary || '',
        design_directions: result.design_directions || [],
        sample_titles: topSellers.slice(0, 10).map(p => p.title),
        avg_price: result.avg_price || 0,
        avg_sales: Math.round(topSellers.reduce((s, p) => s + p.sales_count, 0) / topSellers.length),
        scraped_count: products.length
    };
}
