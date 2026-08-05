import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB, generateOneImage, generatePatternText, uploadPDFToStorage } from '../utils.js';
import { createPatternPDF } from './pdf-generator.js';

/**
 * Dijital Ürün Üretim Motoru (Amigurumi, Kıyafet, Çanta)
 */
export async function produceDigitalPattern(storeId, subCategoryType, storeCurrency = 'USD') {
    const CATEGORY = 'Digital';
    let subCategory = '';
    let extraPrompt = '';

    // Alt kategoriye göre özelleştirme
    if (subCategoryType === 'amigurumi') {
        subCategory = 'Amigurumi Crochet Pattern PDF';
        extraPrompt = 'Focus on cute animals, characters, or decorative toys with detailed tight stitching.';
    } else if (subCategoryType === 'clothing') {
        subCategory = 'Knitted Clothing Pattern PDF';
        extraPrompt = 'Focus on aesthetic sweaters, cardigans, or baby vests with modern boho lace designs.';
    } else if (subCategoryType === 'bags') {
        subCategory = 'Crochet Bag Pattern PDF';
        extraPrompt = 'Focus on stylish tote bags, shoulder bags, or handbags with intricate textures.';
    }

    try {
        console.log(`🚀 [${subCategory}] Üretim başlıyor...`);

        // 1. Fikir Üret (English Subject/Details)
        const idea = await generateProductIdea(CATEGORY, subCategory, [], extraPrompt);
        console.log(`💡 Fikir: ${idea.subject}`);

        // 2. 3 Adet Görsel Üret (Runware FLUX.2-klein)
        const baseSeed = Math.floor(Math.random() * 900000000);

        const infographicPrompt = `A professional high-quality crochet pattern infographic sheet for "${idea.subject}". In the center, there is a large, beautiful finished ${idea.details}. Surrounding the central image are several smaller circular step-by-step detail shots of the crochet process. The top says "${idea.subject.toUpperCase()} PATTERN". 8k, sharp focus.`;

        const lifestylePrompt = `A high-end lifestyle photography of the finished ${idea.details} styled in a cozy modern boho home setting. Natural morning sunlight, aesthetic background. 8k, realistic.`;

        const detailPrompt = `Macro extreme close-up of the ${idea.details}, showing the intricate tight yarn stitches and handmade texture. Focus on the craftsmanship. 8k, sharp focus.`;

        console.log('📸 3 adet görsel Runware FLUX.2 ile üretiliyor...');
        const url1 = await generateOneImage(infographicPrompt, baseSeed);
        const url2 = await generateOneImage(lifestylePrompt, baseSeed + 1);
        const url3 = await generateOneImage(detailPrompt, baseSeed + 2);
        const imageUrls = [url1, url2, url3].filter(u => u !== null);

        // 3. Tarif Metni (GPT-4o-mini)
        console.log('📝 Profesyonel tarif yazılıyor...');
        const patternText = await generatePatternText(idea.subject, idea.details);

        // 4. PDF Oluştur (Karakter fixli ve Görsel Gömülü)
        console.log('📄 PDF Şablonu hazırlanıyor...');
        const safeTitle = idea.subject.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const pdfFileName = `${Date.now()}_${safeTitle}.pdf`;
        const localPdfPath = await createPatternPDF(idea.subject, patternText, pdfFileName, url1);

        // 5. Buluta Yükle
        console.log('☁️ PDF buluta yükleniyor...');
        const digitalFileUrl = await uploadPDFToStorage(localPdfPath);

        // 6. Metadata ve Kayıt (Tamamen İngilizce)
        const metadata = await generateProductSEO(idea.subject, CATEGORY, subCategory, storeCurrency);
        metadata.title = `[PDF PATTERN] ${metadata.title}`;
        metadata.description = `THIS IS A DIGITAL PDF PATTERN DOWNLOAD, NOT A PHYSICAL PRODUCT.\n\n${metadata.description}`;

        return await saveProductToDB(storeId, CATEGORY, subCategory, metadata, imageUrls, digitalFileUrl);

    } catch (error) {
        console.error(`❌ [${subCategory}] Üretim Hatası:`, error);
        throw error;
    }
}
