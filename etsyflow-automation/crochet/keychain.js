import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

/**
 * Crochet - Anahtarlık Otomasyonu
 */
export async function produceCrochetKeychain(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = 'Crochet';
    const SUB_CATEGORY = 'Anahtarlık';
    
    // Config dosyasından gelen veya DB'den gelen referansı kullan
    const referenceImageUrl = PRODUCT_REFERENCES['crochet-keychain'] || dbReferenceImage;
    
    const MASTER_PROMPTS = [
        `Authentic professional product photography of ONE SINGLE handmade crochet [DETAILS] keychain. High-quality macro shot showing organic cotton yarn textures and visible crochet stitches. Placed on a simple, minimalist wooden surface with soft natural window light. No neon or artificial lighting. Real, producible Etsy-style handmade accessory. EXACTLY ONE object in the image.`,
        `Background scene: a canvas or nylon backpack, close-up of the front zipper area. The keychain hangs naturally from the zipper pull. Background: softly blurred outdoor path or cobblestone city street, warm natural daylight filtering through. Shallow depth of field. Casual outdoor lifestyle shot.`,
        `Background scene: an everyday tote bag or structured handbag strap and top area. The keychain is attached naturally to the handle or clasp. Background: blurred cozy café interior with wooden tables and warm ambient lighting. Shallow depth of field. Chic everyday lifestyle atmosphere.`
    ];

    const EXTRA_INSTRUCTIONS = `
        Focus on recognizable and trendy shapes like: cute flowers (daisy, sunflower), tiny fruits (strawberry, lemon), or popular aesthetic geometric patterns. 
        AVOID simple or messy circular blobs. 
        The design must look high-quality, professional, and visually appealing. 
        Use a specific, trendy color palette (pastel pink, sage green, terracotta, cream).
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
