import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

/**
 * Punch Needle - Yastık Kılıfı Otomasyonu
 */
export async function producePillowcase(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = 'Punch Needle';
    const SUB_CATEGORY = 'Yastık kılıfı';
    
    const referenceImageUrl = PRODUCT_REFERENCES['punch-pillowcase'] || dbReferenceImage;

    const MASTER_PROMPTS = [
        `Ultra-realistic top-down macro photograph of ONE SINGLE handmade [DETAILS] pillowcase laid flat on a clean white surface. The pillowcase features a tightly stitched amigurumi crochet or dense punch needle texture, made of thick yarn with highly visible, neat, uniform stitches. Sharp focus on the yarn embroidery texture and handmade details, soft studio lighting. EXACTLY ONE pillowcase in the image.`,
        `Background scene: a modern light linen sofa in a minimal living room. Background (softly blurred): a thin knit throw blanket draped naturally over the armrest, a small green potted plant on a side table, clean Scandinavian décor visible. Soft natural afternoon light from a nearby window. Calm, aspirational living room atmosphere.`,
        `Background scene: a neatly made bed with crisp white or ivory linen bedding. Two or three complementary solid-color throw pillows surround the product pillow naturally. Background (blurred): a minimal bedside table with a small warm lamp, soft neutral walls. Gentle warm morning light. Calm, cozy, and aspirational bedroom aesthetic.`
    ];

    try {
        console.log(`🚀 [${SUB_CATEGORY}] Üretim başlıyor...`);
        const idea = await generateProductIdea(CATEGORY, SUB_CATEGORY, [], '', referenceImageUrl);
        
        // details içinde "[DETAILS]" kısmını GPT'den gelen detaylarla değiştiriyoruz
        const finalPrompts = MASTER_PROMPTS.map(p => p.replace(/\[DETAILS\]/g, idea.details));
        
        const imageUrls = await generateProductImages(idea.details, finalPrompts, referenceImageUrl);
        const metadata = await generateProductSEO(idea.subject, CATEGORY, SUB_CATEGORY, storeCurrency);
        return await saveProductToDB(storeId, CATEGORY, SUB_CATEGORY, metadata, imageUrls);
    } catch (error) {
        console.error(`❌ [${SUB_CATEGORY}] Hatası:`, error);
        throw error;
    }
}
