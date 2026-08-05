import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

/**
 * Crochet - Amigurumi Otomasyonu
 */
export async function produceAmigurumi(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = 'Crochet';
    const SUB_CATEGORY = 'Amigurumi';

    // Config dosyasından gelen veya DB'den gelen referansı kullan
    const referenceImageUrl = PRODUCT_REFERENCES['crochet-amigurumi'] || dbReferenceImage;
    
    const MASTER_PROMPTS = [
        `Authentic professional product photography of ONE SINGLE handmade [DETAILS]. High-quality macro shot showing real crochet yarn textures and visible stitches. Placed on a simple, light-colored wooden table with soft natural window light. No neon or artificial lighting. Real, producible Etsy-style handmade toy. EXACTLY ONE object in the image.`,
        `Background scene: a charming children's room open wooden shelf. Background (softly blurred): pastel-toned decorative objects, a tiny wooden toy, a small fabric plush item, gentle muted nursery colors. Natural window light filtered through sheer curtains creating a dreamy soft glow. Warm, innocent, and tender nursery atmosphere.`,
        `Background scene: a cozy handknit throw blanket surface as the base. Background (slightly blurred): soft cream or pale blush textured fabric, two or three fluffy solid-color throw pillows stacked naturally. Warm indoor ambient light. Cottagecore, cozy, heartwarming home atmosphere.`
    ];

    const EXTRA_INSTRUCTIONS = `
        Focus on extremely cute and trendy characters: tiny forest animals (bunny, fox, bear), pastel-colored mythical creatures, or aesthetic stuffed toys.
        The design MUST be detailed, look professionally handmade, and follow the 'kawaii' or 'modern nursery' aesthetic.
        Use a sophisticated color palette (muted pastels, earth tones).
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
