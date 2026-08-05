import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

export async function produceMobile(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = 'Crochet';
    const SUB_CATEGORY = 'Dönence';

    // Config dosyasından gelen veya DB'den gelen referansı kullan
    const referenceImageUrl = PRODUCT_REFERENCES['crochet-mobile'] || dbReferenceImage;

    // GPT'ye çok net kısıtlama veriyoruz — sadece crochet baby mobile
    const IDEA_OVERRIDE = {
        subject: null, // GPT üretecek
        details: null  // GPT üretecek ama bizim şablonumuza göre
    };

    // Her çekimde ürün sabit kalacak, sadece açı/ortam değişecek
    const MASTER_PROMPTS = [
        `Authentic professional product photography of ONE SINGLE handmade [DETAILS] baby mobile hanging from a simple wooden arm. Realistic crochet yarn textures, visible stitches, soft natural window light, clean neutral nursery background. Real, producible Etsy-style handmade decor. EXACTLY ONE mobile in the image.`,
        `Background scene: a soft Scandinavian nursery interior. Background (blurred): a natural wooden crib frame below, pale blush or sage green painted walls, white linen crib bedding, a small stuffed animal visible. Warm diffused natural window light. Serene, tender, and magical nursery atmosphere.`,
        `Background scene: a nursery window corner with soft natural morning light streaming in gently. Background (blurred): white sheer curtains glowing with backlight, a wooden crib partially visible below, minimal Scandinavian nursery furniture. Airy, calm, warmly lit atmosphere. Dreamy and peaceful baby room feel.`
    ];

    try {
        console.log(`🚀 [${SUB_CATEGORY}] Üretim başlıyor...`);

        // GPT'den fikir al — ama ne tür ürün olduğunu net belirt
        const idea = await generateProductIdea(CATEGORY, SUB_CATEGORY, [], `
IMPORTANT OVERRIDE: This product is ALWAYS a handmade crochet baby mobile (bebek mobilesi/dönencesi).
The mobile consists of: a white or wooden circular ring at the top, with multiple small crocheted amigurumi figures hanging from white strings.

Focus on ethereal and modern nursery themes: celestial (moon, stars, clouds), underwater (whales, shells), or delicate nature (flowers, butterflies).
The mobile characters must be perfectly shaped, look expensive and professionally made.
Avoid messy or simple designs. Use a cohesive, premium color scheme (monochrome, soft pastels, or earthy tones).
        `, referenceImageUrl);

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
