import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

export async function produce3DCandleHolder(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = '3D';
    const SUB_CATEGORY = 'Mum tutucu';

    const referenceImageUrl = PRODUCT_REFERENCES['3d-candle-holder'] || dbReferenceImage;

    const MASTER_PROMPTS = [
        `Ultra-realistic product photograph of ONE SINGLE 3D-printed candle holder featuring [DETAILS], placed on a clean marble or wood surface. A small tealight or pillar candle sits naturally inside. The holder has a smooth or textured matte finish casting beautiful light patterns. Soft warm studio lighting, sharp focus on the sculpted design. EXACTLY ONE holder in the image.`,
        `Background scene: a cozy living room coffee table. The 3D-printed candle holder glows warmly with a lit tealight inside. Background (softly blurred): a soft linen throw blanket, a stack of hardcover books, a small ceramic bowl with dried flowers. Warm candlelight and ambient evening light. Hygge, cozy home atmosphere.`,
        `Background scene: a romantic dinner table or bathroom shelf. The candle holder casts soft warm patterns on the surrounding surface. Background (softly blurred): a glass of wine or a white ceramic bath tray with small pebbles and dried lavender. Deep warm evening light. Luxurious, relaxing lifestyle aesthetic.`
    ];

    const EXTRA_INSTRUCTIONS = `
        IMPORTANT: This is a 3D-printed candle holder for tealights or small pillar candles.
        Great design concepts: geometric lattice or honeycomb patterns that cast beautiful light shadows,
        star/moon celestial cutout patterns, floral/botanical silhouette cutouts,
        skull or gothic cathedral window designs, crystal or faceted geometric shapes,
        forest/tree silhouette cutout lanterns, Moroccan-inspired lattice patterns.
        The holder should have cutout patterns or openings that allow candlelight to shine through.
        Describe it as a SINGLE candle holder with a specific creative design.
        Example: "a single 3D-printed cylindrical candle holder with an intricate forest and deer silhouette cutout pattern, allowing warm candlelight to project the scene onto the walls, matte black finish"
    `;

    try {
        console.log(`🚀 [${SUB_CATEGORY}] Üretim başlıyor...`);
        const idea = await generateProductIdea(CATEGORY, SUB_CATEGORY, [], EXTRA_INSTRUCTIONS, referenceImageUrl);
        const finalPrompts = MASTER_PROMPTS.map(p => p.replace(/\[DETAILS\]/g, idea.details));
        const imageUrls = await generateProductImages(idea.details, finalPrompts, referenceImageUrl);
        const metadata = await generateProductSEO(idea.subject, CATEGORY, SUB_CATEGORY, storeCurrency);
        const product = await saveProductToDB(storeId, CATEGORY, SUB_CATEGORY, metadata, imageUrls);
        console.log(`✅ Ürün Başarıyla Üretildi: ${product.title}`);
        return product;
    } catch (error) {
        console.error(`❌ [${SUB_CATEGORY}] Üretim Hatası:`, error);
        throw error;
    }
}
