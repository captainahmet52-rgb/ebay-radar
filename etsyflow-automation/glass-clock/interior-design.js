import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

/**
 * Cam Saat - İç Tasarım Otomasyonu
 */
export async function produceGlassClock(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = 'Cam Saat';
    const SUB_CATEGORY = 'Farklı temalı iç tasarımlar';
    
    const referenceImageUrl = PRODUCT_REFERENCES['glass-clock'] || dbReferenceImage;
    
    const MASTER_PROMPTS = [
        `Ultra-realistic straight-on photograph of ONE SINGLE modern, frameless round glass wall clock with [DETAILS] mounted on a dark charcoal textured wall. The clock is 12 inches (30cm) in diameter, realistic proportions. The clock features a smooth, highly reflective high-gloss glass surface with slightly beveled edges. Soft, diffused studio lighting highlighting the glossy glass surface. EXACTLY ONE clock in the image.`,
        `Background scene: a modern minimalist living room wall in matte neutral tones. Below and in front: the top edge of a sleek light gray sofa and a slim console table with a small vase of dried flowers. Subtle warm ambient lighting. Premium, uncluttered, gallery-like interior atmosphere. Shallow depth of field toward the room.`,
        `Background scene: a clean modern home office wall in matte white or pale gray. Below: a tidy white desk with a slim open laptop and a small designer desk lamp. A single minimal bookshelf partially visible to one side. Bright natural daylight from a nearby window. Professional, sleek, and aspirational atmosphere.`
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
