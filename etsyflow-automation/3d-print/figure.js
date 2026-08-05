import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

/**
 * 3D Print - Figür Otomasyonu
 */
export async function produce3DFigure(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = '3D';
    const SUB_CATEGORY = 'Figure';
    
    // Config dosyasından gelen veya DB'den gelen referansı kullan
    const referenceImageUrl = PRODUCT_REFERENCES['3d-figure'] || dbReferenceImage;
    
    const MASTER_PROMPTS = [
        `Ultra-realistic professional product photography of ONE SINGLE [DETAILS] on a clean minimalist white surface. Sharp focus on the 3D texture and premium finish, soft studio lighting. EXACTLY ONE object in the image.`,
        `Background scene: a warm premium oak work desk. Slightly blurred in the background — a slim open laptop with a soft screen glow, a minimalist metal desk lamp casting warm directional light, and one small luxury desk accessory. Clean wood grain surface. Shallow depth of field. Premium modern workspace atmosphere with soft warm side lighting.`,
        `Background scene: a curated living room wooden bookshelf. Slightly blurred — a row of tasteful hardcover books in muted neutral tones, a small leafy potted plant in a ceramic pot, and one minimalist decorative object. Warm ambient interior lighting from the side. Cozy, sophisticated home interior atmosphere.`
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
