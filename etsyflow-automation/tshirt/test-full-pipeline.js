/**
 * T-shirt tam pipeline testi — gerçek tasarım üretir ve mockuplara yapıştırır.
 * Çalıştır: node automation/tshirt/test-full-pipeline.js
 *
 * Supabase'e kaydetmez, sadece görselleri üretip test-output klasörüne kaydeder.
 */

import 'dotenv/config';
import axios from 'axios';
import crypto from 'crypto';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { compositeDesignOnMockups } from './mockup-composer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '../assets/mockups/tshirt/test-output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const RUNWARE_BASE_URL = 'https://api.runware.ai/v1';

async function generateTestDesign() {
    const headers = {
        headers: {
            'Authorization': `Bearer ${process.env.RUNWARE_API_KEY}`,
            'Content-Type': 'application/json',
        }
    };

    const prompt = [
        'Flat vector-style graphic illustration for a t-shirt print:',
        'A cute astronaut cat floating in space with stars and a crescent moon around it.',
        'Clean bold lines, vivid colors, pure white background,',
        'centered composition, no text, no gradients, no shadows,',
        'no photographic elements, suitable for screen printing on fabric.'
    ].join(' ');

    const body = [{
        taskType: 'imageInference',
        taskUUID: crypto.randomUUID(),
        model: 'runware:400@2',
        positivePrompt: prompt,
        negativePrompt: 'photograph, realistic, 3d render, t-shirt, clothing, background scenery, people, watermark, text',
        width: 1024,
        height: 1024,
        seed: Math.floor(Math.random() * 900000000) + 100000000,
        numberResults: 1,
        outputFormat: 'PNG'
    }];

    console.log('🎨 Runware ile test tasarımı üretiliyor...');
    const res = await axios.post(RUNWARE_BASE_URL, body, headers);
    return res.data.data[0].imageURL;
}

async function run() {
    try {
        // 1. Test tasarımı üret
        const designUrl = await generateTestDesign();
        console.log(`✅ Tasarım üretildi: ${designUrl}`);

        // 2. Tasarımı kaydet
        const designRes = await axios.get(designUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(path.join(OUTPUT_DIR, 'test-design.png'), Buffer.from(designRes.data));
        console.log('💾 test-design.png kaydedildi');

        // 3. Mockuplara composite et
        console.log('🖼️  4 mockup\'a yapıştırılıyor...');
        const buffers = await compositeDesignOnMockups(designUrl);

        // 4. Sonuçları kaydet
        const labels = ['model-kadin', 'flat-temiz', 'flat-boho', 'model-erkek'];
        buffers.forEach((buf, i) => {
            const outPath = path.join(OUTPUT_DIR, `result-${labels[i]}.jpg`);
            fs.writeFileSync(outPath, buf);
            console.log(`✅ result-${labels[i]}.jpg kaydedildi`);
        });

        console.log(`\n📁 Sonuçlar: ${OUTPUT_DIR}`);
    } catch (err) {
        console.error('❌ Hata:', err.message);
    }
}

run();
