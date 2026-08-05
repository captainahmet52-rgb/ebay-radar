import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

export async function produce3DDeskOrganizer(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = '3D';
    const SUB_CATEGORY = 'Masa organizeri';

    const referenceImageUrl = PRODUCT_REFERENCES['3d-desk-organizer'] || dbReferenceImage;

    const MASTER_PROMPTS = [
        `Ultra-realistic product photograph of ONE SINGLE 3D-printed desk organizer featuring [DETAILS], placed on a clean light wood surface. The organizer holds pens, pencils, and small stationery items naturally arranged inside. Smooth matte finish, precise sculpted design. Soft diffused studio lighting, sharp focus on the surface details and compartments. EXACTLY ONE organizer in the image.`,
        `Background scene: a minimal modern office desk. The 3D-printed desk organizer sits center-frame with pens and a ruler neatly organized inside. Background (softly blurred): a slim laptop, a small potted succulent, a wireless mouse, a soft warm desk lamp. Clean, productive workspace aesthetic.`,
        `Background scene: a cozy home study or student desk. The organizer holds colorful pens and highlighters. Background (softly blurred): an open spiral notebook, a stack of textbooks, a small mug of tea, soft natural window light. Warm, organized, creative study space aesthetic.`
    ];

    const EXTRA_INSTRUCTIONS = `
        IMPORTANT: This is a 3D-printed desk organizer for holding pens, pencils, scissors, and small office items.
        Great design concepts: character-shaped organizers (animal busts like fox, cat, bear with open top),
        architectural shapes (mini castle, city skyline compartments, house shape),
        geometric multi-compartment designs, nature-inspired (tree stump, mountain range),
        pop culture themed (spaceship, TARDIS, Minecraft block style).
        The organizer should have a clear opening/compartment to hold items upright.
        Describe it as a SINGLE organizer with a specific creative theme.
        Example: "a single 3D-printed desk organizer shaped like a fox sitting upright with its hollow back forming the pen compartment, smooth matte terracotta finish"
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
