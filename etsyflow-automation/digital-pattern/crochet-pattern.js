import { generateProductIdea, generateProductImages, generateProductSEO, saveProductToDB, generateOneImage, generatePatternText, uploadPDFToStorage } from '../utils.js';
import { createPatternPDF } from './pdf-generator.js';
import path from 'path';

/**
 * Dijital Ürün - Amigurumi Tarif (Pattern) Otomasyonu
 */
export async function produceDigitalCrochetPattern(storeId, storeCurrency = 'USD') {
    const CATEGORY = 'Digital';
    const SUB_CATEGORY = 'Crochet Pattern PDF';
    
    try {
        console.log(`🚀 [${SUB_CATEGORY}] Üretim başlıyor (Tamamen Dijital Akış)...`);

        // 1. Fikir Üret (GPT-4o-mini)
        const idea = await generateProductIdea(CATEGORY, SUB_CATEGORY);
        console.log(`💡 Fikir: ${idea.subject}`);

        // 2. Görsel Üret (Runware FLUX.2-klein — INFOGRAPHIC / TUTORIAL SHEET STYLE)
        const baseSeed = Math.floor(Math.random() * 900000000);

        const infographicPrompt = `A professional high-quality crochet pattern infographic sheet for "${idea.subject}". In the center, there is a large, beautiful finished amigurumi ${idea.details}. Surrounding the central image are several smaller circular step-by-step detail shots of the crochet process (yarn, stitches, parts). The background is a clean aesthetic craft table. At the top, there is elegant text that says "${idea.subject.toUpperCase()} CROCHET PATTERN". The overall layout is clean, colorful, and organized like a professional tutorial card. 8k, sharp focus, high resolution.`;

        const coverPrompt = `Aesthetic professional Etsy listing cover for a crochet pattern. The finished ${idea.details} is displayed beautifully. A stylish badge says "PDF PATTERN INCLUDED". Minimalist, bright, high-end photography.`;

        console.log('📸 Görseller Runware FLUX.2 ile üretiliyor...');
        const url1 = await generateOneImage(infographicPrompt, baseSeed);
        const url2 = await generateOneImage(coverPrompt, baseSeed + 1);
        const imageUrls = [url1, url2].filter(u => u !== null);

        // 3. Tarif Metni Üret (GPT-4o-mini)
        console.log('📝 Tarif metni yazılıyor (GPT-4o-mini)...');
        const patternText = await generatePatternText(idea.subject, idea.details);

        // 4. PDF Oluştur (GÖRSEL KART + METİN TARİF)
        console.log('📄 Profesyonel Tutorial Card PDF\'i hazırlanıyor...');
        const safeTitle = idea.subject.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const pdfFileName = `${Date.now()}_${safeTitle}.pdf`;
        const localPdfPath = await createPatternPDF(idea.subject, patternText, pdfFileName, url1);

        // 5. PDF'i Storage'a Yükle
        console.log('☁️ PDF buluta yükleniyor...');
        const digitalFileUrl = await uploadPDFToStorage(localPdfPath);

        // 6. Metadata ve DB Kaydı
        const metadata = await generateProductSEO(idea.subject, CATEGORY, SUB_CATEGORY, storeCurrency);
        // Metadata'yı dijital ürüne göre hafifçe süsleyelim
        metadata.title = `[PDF PATTERN] ${metadata.title}`;
        metadata.description = `THIS IS A DIGITAL DOWNLOAD (PDF PATTERN), NOT A PHYSICAL PRODUCT.\n\n${metadata.description}`;

        return await saveProductToDB(storeId, CATEGORY, SUB_CATEGORY, metadata, imageUrls, digitalFileUrl);

    } catch (error) {
        console.error(`❌ [${SUB_CATEGORY}] Hatası:`, error);
        throw error;
    }
}
