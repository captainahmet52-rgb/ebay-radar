import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

export async function produce3DPhoneStand(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = '3D';
    const SUB_CATEGORY = 'Telefon standı';

    const referenceImageUrl = PRODUCT_REFERENCES['3d-phone-stand'] || dbReferenceImage;

    const MASTER_PROMPTS = [
        `Ultra-realistic product photograph of ONE SINGLE 3D-printed phone stand featuring [DETAILS], placed on a clean light wood surface. A smartphone rests naturally in the stand at a comfortable viewing angle. The stand has a smooth matte finish with precise sculpted details. Soft diffused studio lighting, sharp focus on the design and surface texture. EXACTLY ONE stand in the image.`,
        `Background scene: a clean modern home office desk. The phone stand holds a smartphone at reading angle. Background (softly blurred): a slim laptop, a mechanical keyboard, a small succulent plant, soft warm desk lamp casting gentle light. Organized, productive workspace aesthetic.`,
        `Background scene: a cozy bedside table. The phone stand sits on a light oak nightstand with a phone resting inside. Background (softly blurred): a warm glowing bedside lamp, a folded book, a small glass of water. Soft warm evening light. Relaxed, cozy bedroom lifestyle aesthetic.`
    ];

    const EXTRA_INSTRUCTIONS = `
        IMPORTANT: This is a 3D-printed phone stand/holder for a desk or bedside table.
        Great design concepts: character-shaped stands (astronaut, animal holding the phone, robot, dinosaur),
        architectural shapes (arch, minimalist geometric frame), nature-inspired (tree, mountain silhouette as base),
        gaming/pop culture themed stands, abstract sculptural bases.
        The stand must be functional — the phone should lean at a stable viewing angle.
        Describe it as a SINGLE phone stand with a specific creative theme.
        Example: "a single 3D-printed phone stand shaped like a friendly robot with outstretched arms cradling the phone, smooth matte grey finish"
    `;

    try {
        console.log(`🚀 [${SUB_CATEGORY}] Üretim başlıyor...`);
        const idea = await generateProductIdea(CATEGORY, SUB_CATEGORY, [], EXTRA_INSTRUCTIONS, referenceImageUrl);
        const finalPrompts = MASTER_PROMPTS.map(p => p.replace(/\[DETAILS\]/g, idea.details));
        const imageUrls = await generateProductImages(idea.details, finalPrompts, referenceImageUrl);
        const metadata = await generateProductSEO(idea.subject, CATEGORY, SUB_CATEGORY, storeCurrency);
        const product = await saveProductToDB(storeId, CATEGORY, SUB_CATEGORY, metadata, imageUrls);
        console.log(`✅ Ürün Başarıyla Üretildi: ${product.title}`);
        return product;
    } catch (error) {
        console.error(`❌ [${SUB_CATEGORY}] Üretim Hatası:`, error);
        throw error;
    }
}
