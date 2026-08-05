import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

export async function produce3DToothbrushHolder(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = '3D';
    const SUB_CATEGORY = 'Diş fırçalığı';

    const referenceImageUrl = PRODUCT_REFERENCES['3d-toothbrush-holder'] || dbReferenceImage;

    const MASTER_PROMPTS = [
        `Ultra-realistic product photograph of ONE SINGLE 3D-printed toothbrush holder featuring [DETAILS], placed on a clean white bathroom countertop. The holder has a smooth matte finish with precise sculpted details. One or two toothbrushes are placed naturally inside. Soft diffused studio lighting, sharp focus on the surface texture and design. EXACTLY ONE holder in the image.`,
        `Background scene: a modern minimalist bathroom vanity. The 3D-printed toothbrush holder sits beside a clean white ceramic sink. Background (softly blurred): a matte soap dispenser, a small folded hand towel, light-toned marble or white tile surface. Soft natural daylight from a frosted window. Clean, fresh, spa-like bathroom aesthetic.`,
        `Background scene: a neatly organized bathroom shelf or countertop. The holder is placed alongside a matching soap dish and a small scented candle. Background (softly blurred): white subway tile wall, a rolled linen hand towel, a small plant. Warm ambient bathroom lighting. Cozy, organized, home bathroom aesthetic.`
    ];

    const EXTRA_INSTRUCTIONS = `
        IMPORTANT: This is a 3D-printed toothbrush holder designed for a bathroom countertop.
        Great design concepts: character-shaped holders (tooth with a face, animal shapes like cat/bear/bunny),
        architectural or geometric cylinders with cutout patterns, cactus or plant shapes,
        mini house or building shapes, castle tower design, rocket ship, lighthouse.
        The holder should have openings/slots to hold 1-3 toothbrushes upright.
        Describe it as a SINGLE holder with a specific creative theme.
        Example: "a single 3D-printed toothbrush holder shaped like a smiling tooth character with big eyes and a wide grin, smooth matte white finish"
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
