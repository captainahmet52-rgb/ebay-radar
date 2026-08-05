import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

/**
 * Metal Wall Art - Duvar Sanatı Otomasyonu
 */
export async function produceMetalWallArt(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = 'Metal Wall Art';
    const SUB_CATEGORY = 'Metal Pano';

    const referenceImageUrl = PRODUCT_REFERENCES['metal-wall-art'] || dbReferenceImage;

    const MASTER_PROMPTS = [
        `Ultra-realistic product photograph of a single square laser-cut metal wall art panel featuring [DETAILS], mounted flush on a clean warm-grey wall. The panel has a matte black powder-coated finish with precise laser-cut edges casting subtle soft shadows on the wall. Small mounting holes visible at the four corners. Soft diffused studio lighting from above, sharp focus on the intricate cutout pattern and metallic texture. Square composition, minimal professional product photography, no other objects in the frame.`,
        `Background scene: a modern minimalist living room. The square metal wall art panel is mounted as the central focal piece on a light off-white accent wall. Background (softly blurred): a low-profile linen sofa with textured throw pillows, a marble coffee table with a single white candle, a tall fiddle-leaf fig plant in a matte ceramic pot. Warm ambient floor lamp lighting, subtle shadows cast by the cutout panel. Aspirational contemporary Scandinavian home interior.`,
        `Background scene: a calm, elegant bedroom or entrance hallway. The square metal wall art panel hangs centered on a warm white wall. Background (softly blurred): a natural oak console table below with a small ceramic vase holding dried pampas grass, a linen runner draped over the table edge. Soft warm morning natural light from a nearby window. Calm, aspirational, cozy Boho-Nordic home aesthetic.`
    ];

    const EXTRA_INSTRUCTIONS = `
        IMPORTANT: This product is a square laser-cut metal wall art panel with a matte black powder-coat finish.
        Generate a single intricate, symmetrical design concept that looks stunning as a laser-cut pattern.
        The design MUST be a flat 2D cutout pattern — symmetrical and ornate, like the reference image.

        Great themes: mandala patterns, floral geometry, botanical/leaf lattice, compass rose, celestial (sun/moon/stars),
        geometric lotus, celtic knot inspired, arabesque tile pattern, snowflake geometry, tree of life mandala,
        Moroccan tile design, Art Nouveau floral, sacred geometry.

        The pattern must be symmetrical (radial or bilateral) and dense enough to look impressive when laser-cut.
        Avoid: realistic scene illustrations, text, asymmetric designs, silhouettes of animals/people alone (no surrounding pattern).

        The 'details' field must clearly describe the specific ornamental pattern for the image AI.
        Example: "a symmetrical mandala with eight overlapping petal shapes radiating from a central flower, surrounded by circular arcs and small leaf motifs at the corners, all as flat cutout silhouettes in matte black metal on a square panel"
    `;

    try {
        console.log(`🚀 [${SUB_CATEGORY}] Üretim başlıyor...`);
        const idea = await generateProductIdea(CATEGORY, SUB_CATEGORY, [], EXTRA_INSTRUCTIONS, referenceImageUrl);
        console.log(`💡 Fikir Bulundu: ${idea.subject}`);

        const finalPrompts = MASTER_PROMPTS.map(p => p.replace(/\[DETAILS\]/g, idea.details));

        console.log(`🎨 Görsel üretiliyor...`);
        const imageUrls = await generateProductImages(idea.details, finalPrompts, referenceImageUrl);

        console.log(`📝 Metinler hazırlanıyor...`);
        const metadata = await generateProductSEO(idea.subject, CATEGORY, SUB_CATEGORY, storeCurrency);

        console.log(`💾 Veritabanına kaydediliyor...`);
        const product = await saveProductToDB(storeId, CATEGORY, SUB_CATEGORY, metadata, imageUrls);

        console.log(`✅ Ürün Başarıyla Üretildi: ${product.title}`);
        return product;

    } catch (error) {
        console.error(`❌ [${SUB_CATEGORY}] Üretim Hatası:`, error);
        throw error;
    }
}
