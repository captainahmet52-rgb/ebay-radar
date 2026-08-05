import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

export async function produce3DCarFreshener(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = '3D';
    const SUB_CATEGORY = 'Araba parfümü';

    const referenceImageUrl = PRODUCT_REFERENCES['3d-car-freshener'] || dbReferenceImage;

    const MASTER_PROMPTS = [
        `Ultra-realistic top-down macro photograph of ONE SINGLE 3D-printed car air freshener clip featuring [DETAILS], laid flat on a clean light surface. The piece has a smooth matte finish with precise sculpted details. A thin elastic cord or metal clip is attached at the top. Soft warm studio lighting, extreme detail on the surface texture. EXACTLY ONE piece in the image.`,
        `Background scene: a car dashboard vent area in the foreground. The 3D-printed air freshener clips naturally onto the vent slat. Background (softly blurred): clean car interior — steering wheel visible, soft dashboard surface, warm ambient car lighting. Premium car interior lifestyle aesthetic.`,
        `Background scene: a hand holding the car air freshener against a softly blurred urban street or parking lot background. The design details are clearly visible. Background: warm golden-hour city light, soft bokeh of parked cars or street lamps. Everyday urban lifestyle aesthetic.`
    ];

    const EXTRA_INSTRUCTIONS = `
        IMPORTANT: This is a 3D-printed car air freshener clip that hangs from or clips onto a car dashboard vent.
        Great design concepts: cute character faces (animals, cartoon characters, food items),
        nature shapes (leaf, flower, cloud, sun), geometric shapes with cutouts,
        pop culture icons, mini figurines (astronaut, cactus, mushroom, bear, cat),
        seasonal themes (snowflake, pumpkin, heart).
        The design should be compact (fits in a hand), lightweight, and visually charming.
        Describe it as a SINGLE air freshener piece with a specific creative theme.
        Example: "a single 3D-printed car air freshener shaped like a sleepy cloud with a tiny rainbow, smooth pastel white and pastel pink finish, with a small metal clip at the top"
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
