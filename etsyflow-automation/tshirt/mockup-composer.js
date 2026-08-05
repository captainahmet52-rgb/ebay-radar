import sharp from 'sharp';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCKUPS_DIR = path.join(__dirname, '../assets/mockups/tshirt');

/**
 * Her mockup için tasarımın yapıştırılacağı alan (piksel koordinatları).
 *
 * Gerçek görsel boyutları:
 *   female-model.png  → 1122 x 1402 (dikey)
 *   flat-clean.png    → 1254 x 1254 (kare)
 *   flat-boho.png     → 1254 x 1254 (kare)
 *   male-model.png    → 1254 x 1254 (kare)
 *
 * Koordinatları ayarlamak için test scriptini çalıştır:
 *   node automation/tshirt/test-mockup.js
 */
const MOCKUP_CONFIGS = [
    {
        file: 'female-model.png',
        label: 'model-kadin',
        // 1122x1402 — göğüs merkezi ~560x555, oversized tişört
        design: { left: 410, top: 420, width: 300, height: 280 }
    },
    {
        file: 'flat-clean.png',
        label: 'flat-temiz',
        // 1254x1254 — düz yatış, temiz arka plan
        design: { left: 427, top: 300, width: 400, height: 380 }
    },
    {
        file: 'flat-boho.png',
        label: 'flat-boho',
        // 1254x1254 — düz yatış, boho aksesuarlar kenarlarda
        design: { left: 420, top: 230, width: 415, height: 395 }
    },
    {
        file: 'male-model.png',
        label: 'model-erkek',
        // 1254x1254 — erkek model, iç mekan
        design: { left: 485, top: 360, width: 285, height: 265 }
    }
];

/**
 * AI'ın ürettiği tasarım görselini 4 mockup template'e yapıştırır.
 * @param {string} designUrl - Runware'den gelen tasarım PNG URL'si
 * @returns {Buffer[]} - Composited görsel buffer'ları
 */
export async function compositeDesignOnMockups(designUrl) {
    // Tasarım görselini indir
    const designResponse = await axios.get(designUrl, { responseType: 'arraybuffer' });
    const designBuffer = Buffer.from(designResponse.data);

    const results = [];

    for (const config of MOCKUP_CONFIGS) {
        try {
            const templatePath = path.join(MOCKUPS_DIR, config.file);
            const { left, top, width, height } = config.design;

            // Tasarımı print alanına sığdır (beyaz dolgu ile)
            const resizedDesign = await sharp(designBuffer)
                .resize(width, height, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                })
                .png()
                .toBuffer();

            // Multiply blend mode: beyaz alanlar şeffaf gibi davranır
            // → tasarım tişört kumaşı ile doğal şekilde karışır
            const composited = await sharp(templatePath)
                .composite([{
                    input: resizedDesign,
                    blend: 'multiply',
                    left,
                    top
                }])
                .jpeg({ quality: 92 })
                .toBuffer();

            results.push(composited);
            console.log(`✅ [Mockup] ${config.label} tamamlandı`);
        } catch (err) {
            console.warn(`⚠️ [Mockup] ${config.label} başarısız: ${err.message}`);
        }
    }

    if (results.length === 0) {
        throw new Error('❌ Hiçbir mockup compositing başarılı olmadı.');
    }

    return results;
}
