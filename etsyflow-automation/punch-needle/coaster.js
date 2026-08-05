import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

/**
 * Punch Needle - Bardak Altlığı Otomasyonu
 */
export async function produceCoaster(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = 'Punch Needle';
    const SUB_CATEGORY = 'Bardak altlığı';
    
    const referenceImageUrl = PRODUCT_REFERENCES['punch-coaster'] || dbReferenceImage;
    
    const MASTER_PROMPTS = [
        `Ultra-realistic top-down macro photograph of ONE SINGLE round [DETAILS] laid flat on a light natural wood grain table. The coaster has a tightly stitched amigurumi crochet or dense punch needle texture, made of thick yarn with highly visible, neat, uniform stitches. It has a perfectly flat, firm circular shape. Soft, warm natural top-down lighting, extreme detail on the yarn texture. EXACTLY ONE coaster in the image.`,
        `Background scene: a warm oak café or kitchen table surface. A classic white ceramic coffee mug with a rich espresso rests on top of the coaster. Background: softly blurred warm café interior atmosphere — wooden furniture, ambient warm lighting. Soft morning side light. Cozy coffee ritual aesthetic.`,
        `Background scene: a light marble or oak living room coffee table surface. A glass of water or a stemmed coffee cup sits on the coaster. Background (slightly blurred): a hardcover book lying open face-down, a small pillar candle, a minimalist ceramic vase. Warm ambient home lighting. Relaxed, aspirational lifestyle scene.`
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
