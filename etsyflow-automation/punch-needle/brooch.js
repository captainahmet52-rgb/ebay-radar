import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

/**
 * Punch Needle - Broş Otomasyonu
 */
export async function produceBrooch(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = 'Punch Needle';
    const SUB_CATEGORY = 'Broş';
    
    const referenceImageUrl = PRODUCT_REFERENCES['punch-brooch'] || dbReferenceImage;
    
    const MASTER_PROMPTS = [
        `Produce a realistic product image of a 4-piece flat punch-needle brooch set that looks truly handmade and physically producible. The items MUST be flat, 2D embroidered patches made with dense punch needle yarn loops (rug hooking style). They are absolutely NOT 3D amigurumi or stuffed crochet toys. Keep the layout, spacing, lighting, background, and product photography style identical to the reference image. Only change the theme of the four brooches, inspired by [DETAILS]. Each brooch MUST use an authentic flat punch-needle embroidery technique. The final result should look like a real, handmade 4-piece flat punch needle brooch set ready for sale.`,
        `Background scene: a denim jacket collar and chest lapel area in the foreground, brooches pinned naturally. Background: softly blurred outdoor lifestyle scene — a cobblestone street, green foliage, or casual café terrace in warm afternoon light. Shallow depth of field. Urban casual fashion lifestyle aesthetic.`,
        `Background scene: a canvas tote bag or handknit shoulder bag surface and strap area in the foreground, brooches attached naturally. Background: blurred outdoor market or open-air café scene with warm dappled sunlight. Casual, artisan, everyday chic lifestyle atmosphere.`
    ];
    const EXTRA_INSTRUCTIONS = `
        IMPORTANT: This product is a 4-piece set of brooches. 
        You MUST generate a cohesive, fun, and trendy theme for a 4-piece set. 
        Do NOT describe just one item. Provide a creative theme name and list exactly 4 distinct items that belong to that theme.
        For example: "King of the Couch set featuring a comfy couch, a golden crown, a TV remote, and a coffee mug".
        Another example: "Forest Explorer set featuring a pine tree, a cute bear, a compass, and a tiny tent".
        CRITICAL RULE: Emphasize that these are FLAT, 2D punch needle embroidered patches. They are NOT 3D amigurumi or stuffed toys. Describe them as flat textile art pieces made with dense yarn loops.
        The 'details' field must clearly describe the 4 distinct flat objects so the image AI knows exactly what 4 shapes to draw.
    `;

    try {
        console.log(`🚀 [${SUB_CATEGORY}] Üretim başlıyor...`);
        const idea = await generateProductIdea(CATEGORY, SUB_CATEGORY, [], EXTRA_INSTRUCTIONS, referenceImageUrl);

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

