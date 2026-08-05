import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

export async function produce3DPlanter(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = '3D';
    const SUB_CATEGORY = 'Saksı';

    const referenceImageUrl = PRODUCT_REFERENCES['3d-planter'] || dbReferenceImage;

    const MASTER_PROMPTS = [
        `Ultra-realistic top-down macro photograph of ONE SINGLE 3D-printed decorative planter pot featuring [DETAILS], placed on a clean white surface. The planter has a smooth matte finish with precise layer-free 3D print quality. A small succulent or air plant sits naturally inside. Soft diffused studio lighting, sharp focus on the sculpted surface details. EXACTLY ONE planter in the image.`,
        `Background scene: a bright Scandinavian windowsill bathed in soft morning light. The 3D-printed planter sits centered on the sill with a small succulent inside. Background (softly blurred): white-painted wooden window frame, sheer linen curtain, a ceramic coffee mug resting nearby. Warm golden morning light. Clean, minimal, plant-lover lifestyle aesthetic.`,
        `Background scene: a minimal home office desk. The planter sits on the corner of a light oak desk alongside one or two other small plants in simple pots. Background (softly blurred): a slim laptop, a candle in a matte holder, soft warm desk lamp. Warm ambient lighting. Calm, productive, plant-filled workspace aesthetic.`
    ];

    const EXTRA_INSTRUCTIONS = `
        IMPORTANT: This is a 3D-printed decorative planter or pot designed for small succulents, cacti, or air plants.
        Great design concepts: character faces (smiling, sleeping, surprised expressions on the pot),
        geometric faceted shapes, animal-shaped planters (cat, bear, sloth, fox), architectural forms,
        fantasy creatures, cute food shapes, skull or gothic styles, minimalist geometric patterns.
        The design should be sculptural and visually interesting as a standalone object.
        Describe it as a SINGLE planter with a specific creative theme.
        Example: "a single 3D-printed planter shaped like a sleepy bear face with round ears and closed eyes, in a smooth matte white finish"
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
