/**
 * Mockup koordinat test scripti.
 * Çalıştır: node automation/tshirt/test-mockup.js
 *
 * Her mockup üzerine kırmızı yarı-saydam bir kutu çizer.
 * Kutu tişörtün göğüs baskı alanına tam denk geliyorsa koordinatlar doğrudur.
 * Denk gelmiyorsa mockup-composer.js içindeki MOCKUP_CONFIGS'i ayarla.
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCKUPS_DIR = path.join(__dirname, '../assets/mockups/tshirt');
const OUTPUT_DIR = path.join(__dirname, '../assets/mockups/tshirt/test-output');

const MOCKUP_CONFIGS = [
    { file: 'female-model.png',  label: 'model-kadin', design: { left: 410, top: 420, width: 300, height: 280 } },
    { file: 'flat-clean.png',    label: 'flat-temiz',  design: { left: 427, top: 300, width: 400, height: 380 } },
    { file: 'flat-boho.png',     label: 'flat-boho',   design: { left: 420, top: 230, width: 415, height: 395 } },
    { file: 'male-model.png',    label: 'model-erkek', design: { left: 485, top: 360, width: 285, height: 265 } },
];

import fs from 'fs';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

for (const config of MOCKUP_CONFIGS) {
    const { left, top, width, height } = config.design;

    // Kırmızı yarı-saydam kutu oluştur
    const overlay = await sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: 255, g: 0, b: 0, alpha: 0.45 }
        }
    }).png().toBuffer();

    await sharp(path.join(MOCKUPS_DIR, config.file))
        .composite([{ input: overlay, left, top }])
        .jpeg({ quality: 88 })
        .toFile(path.join(OUTPUT_DIR, `test-${config.label}.jpg`));

    console.log(`✅ test-${config.label}.jpg oluşturuldu`);
}

console.log(`\n📁 Çıktılar: ${OUTPUT_DIR}`);
console.log('Kırmızı kutu baskı alanına tam oturuyorsa koordinatlar doğru.');
console.log('Ayar gerekirse mockup-composer.js → MOCKUP_CONFIGS değerlerini değiştir.');
