import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

/**
 * 3D Print - Kalemlik Otomasyonu
 */
export async function produce3DPenHolder(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = '3D';
    const SUB_CATEGORY = 'Kalemlik';
    
    const referenceImageUrl = PRODUCT_REFERENCES['3d-pen-holder'] || dbReferenceImage;

    const MASTER_PROMPTS = [
        `Ultra-realistic product photography of ONE SINGLE 3D printed [DETAILS] on a clean white surface. Sharp focus on the holder's geometry and material texture, professional studio lighting. EXACTLY ONE object in the image.`,
        `Background scene: a clean modern office desk. Background (slightly blurred): a slim open laptop on the left edge, a leather-bound notebook with a pen resting on it, an espresso cup. A few pens and markers placed naturally in the foreground. Soft warm office lighting. Productive, organized, premium workspace atmosphere.`,
        `Background scene: a cozy home office desk corner. Background (slightly blurred): a ceramic coffee mug with soft steam wisps, a spiral notebook open to a blank page, a small lush plant in a terracotta pot. Warm natural window light streaming in from one side. Inviting, warm, and organized home workspace.`
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
