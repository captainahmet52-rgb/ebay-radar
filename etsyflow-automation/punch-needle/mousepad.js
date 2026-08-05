import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

/**
 * Punch Needle - Mousepad Otomasyonu
 */
export async function produceMousepad(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = 'Punch Needle';
    const SUB_CATEGORY = 'Mousepad';
    
    const referenceImageUrl = PRODUCT_REFERENCES['punch-mousepad'] || dbReferenceImage;

    const MASTER_PROMPTS = [
        `Ultra-realistic top-down macro photograph of ONE SINGLE 2-piece handmade [DETAILS] mousepad set (mousepad + wrist rest) laid flat on a light natural wood grain desk. The products have a tightly stitched amigurumi crochet or dense punch needle texture, made of thick yarn with highly visible, neat, uniform stitches. They have a perfectly flat but slightly plush, firm shape. Sharp focus on the yarn texture and handmade feel, professional studio lighting. EXACTLY ONE set in the image.`,
        `Background scene: a clean modern desk workspace. A wireless mouse rests naturally on the mousepad in active-use position. Background (slightly blurred): a slim mechanical keyboard, an open laptop displaying a soft screen glow, a minimal desk lamp. Organized desk surface. Soft warm-cool mixed lighting. Productive modern workspace.`,
        `Background scene: a cozy home office desk. Background (slightly blurred): a ceramic coffee mug with faint steam, an open spiral notebook with a pen resting across it, a small lush desktop plant. Warm natural window light from one side. Soft, inviting, and organized home workspace atmosphere.`
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
