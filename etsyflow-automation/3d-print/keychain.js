import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

/**
 * 3D Print - Anahtarlık Otomasyonu
 */
export async function produce3DKeychain(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = '3D';
    const SUB_CATEGORY = 'Anahtarlık';
    
    // Config dosyasından gelen veya DB'den gelen referansı kullan
    const referenceImageUrl = PRODUCT_REFERENCES['3d-keychain'] || dbReferenceImage;
    
    const MASTER_PROMPTS = [
        `Professional studio product photography of ONE SINGLE 3D printed [DETAILS]. High-quality PLA material with subtle, realistic layer lines, vibrant colors, clean finish. Minimalist aesthetic on a light gray background, soft studio lighting, macro shot. EXACTLY ONE object in the image.`,
        `Background scene: a stylish dark leather or tan canvas bag, close-up of the zipper area. The keychain hangs naturally from the zipper pull. Background: softly blurred urban street or café exterior with warm natural afternoon sunlight filtering through. Shallow depth of field. Authentic everyday carry lifestyle shot.`,
        `Background scene: a modern car interior. Car keys rest naturally on the center console or passenger seat fabric. Background: softly blurred clean dashboard, premium car upholstery, warm ambient interior lighting. Shallow depth of field. Everyday automotive lifestyle vibe.`
    ];

    const EXTRA_INSTRUCTIONS = `
        Focus on products that look great when 3D printed: Articulated (movable) animals, geometric minimalist shapes, low-poly designs, or custom typographic keychains.
        The design should clearly look like a high-quality 3D print (PLA or Resin), NOT a generic molded plastic toy.
        Use trendy 3D printing colors: Silk Gold, Matte Navy, Marble White, or Galaxy Black.
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
