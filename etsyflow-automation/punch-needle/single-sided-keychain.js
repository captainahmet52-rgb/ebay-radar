import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB } from '../utils.js';
import { PRODUCT_REFERENCES } from '../config.js';

/**
 * Punch Needle - Tek Taraflı Anahtarlık Otomasyonu
 */
export async function produceSingleSidedKeychain(storeId, storeCurrency = 'USD', dbReferenceImage = null) {
    const CATEGORY = 'Punch Needle';
    const SUB_CATEGORY = 'Tek Taraflı Anahtarlık';
    
    // Config dosyasından gelen veya DB'den gelen referansı kullan
    const referenceImageUrl = PRODUCT_REFERENCES['punch-single-keychain'] || dbReferenceImage;
    
    // 🎨 BU ALT KATEGORİYE ÖZEL GÖRSEL STİL (MASTER PROMPT)
    const MASTER_PROMPTS = [
        `Ultra-realistic top-down macro photograph of ONE SINGLE [DETAILS] laid flat on a light natural wood grain surface. The product has a tightly stitched amigurumi crochet or dense punch needle texture, made of thick yarn with highly visible, neat, uniform stitches. It has a flat but slightly plush, perfectly firm shape. Attached to the top is a standard silver metal keychain ring with a short metal chain. Soft, warm natural lighting, extreme detail on the yarn texture. EXACTLY ONE object in the image.`,
        `Background scene: a stylish crossbody bag or leather tote, close-up of the zipper area. The keychain hangs naturally from the zipper pull. Background: softly blurred outdoor café terrace or leafy urban street with warm golden-hour natural light. Shallow depth of field. Chic everyday carry lifestyle shot.`,
        `Background scene: a modern car center console or passenger seat area. A set of car keys lies naturally on the surface with the keychain clearly visible. Background: softly blurred premium car interior — clean dashboard, warm ambient lighting, smooth upholstery. Shallow depth of field. Everyday automotive lifestyle aesthetic.`
    ];

    try {
        console.log(`🚀 [${SUB_CATEGORY}] Üretim başlıyor...`);

        // 1. Fikir Üret
        const idea = await generateProductIdea(CATEGORY, SUB_CATEGORY, [], '', referenceImageUrl);
        console.log(`💡 Fikir Bulundu: ${idea.subject}`);

        // details içinde "[DETAILS]" kısmını GPT'den gelen detaylarla değiştiriyoruz
        const finalPrompts = MASTER_PROMPTS.map(p => p.replace(/\[DETAILS\]/g, idea.details));

        // 2. Görsel Üret
        console.log(`🎨 Görsel üretiliyor...`);
        const imageUrls = await generateProductImages(idea.details, finalPrompts, referenceImageUrl);

        // 3. Metadata Üret (Başlık, Açıklama, Etiketler)
        console.log(`📝 Metinler hazırlanıyor...`);
        const metadata = await generateProductSEO(idea.subject, CATEGORY, SUB_CATEGORY, storeCurrency);

        // 4. Veritabanına Kaydet
        console.log(`💾 Veritabanına kaydediliyor...`);
        const product = await saveProductToDB(storeId, CATEGORY, SUB_CATEGORY, metadata, imageUrls);

        console.log(`✅ Ürün Başarıyla Üretildi: ${product.title}`);
        return product;

    } catch (error) {
        console.error(`❌ [${SUB_CATEGORY}] Üretim Hatası:`, error);
        throw error;
    }
}
