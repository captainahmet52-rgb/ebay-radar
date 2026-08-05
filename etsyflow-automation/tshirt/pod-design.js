import 'dotenv/config';
import axios from 'axios';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { OpenAI } from 'openai';
import { generateProductIdea, generateProductSEO, saveProductToDB } from '../utils.js';
import { compositeDesignOnMockups } from './mockup-composer.js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { realtime: { transport: ws } }
);

const openai = new OpenAI({ apiKey: process.env.VITE_OPENAI_API_KEY });

const RUNWARE_BASE_URL = 'https://api.runware.ai/v1';
// FLUX.2-klein — text-to-image, tasarım üretimi için idealdir
const DESIGN_MODEL = 'runware:400@2';

/**
 * Runware ile düz grafik tasarım üretir (beyaz arka plan, PNG).
 * Tişörte baskılanmak üzere tasarlanmış flat illustration.
 */
async function generateDesignImage(designPrompt) {
    const headers = {
        headers: {
            'Authorization': `Bearer ${process.env.RUNWARE_API_KEY}`,
            'Content-Type': 'application/json',
        }
    };

    const seed = Math.floor(Math.random() * 900000000) + 100000000;

    const body = [{
        taskType: 'imageInference',
        taskUUID: crypto.randomUUID(),
        model: DESIGN_MODEL,
        positivePrompt: designPrompt,
        negativePrompt: 'photograph, realistic, 3d render, t-shirt, clothing, background scenery, people, watermark, text',
        width: 1024,
        height: 1024,
        seed,
        numberResults: 1,
        outputFormat: 'PNG'
    }];

    const res = await axios.post(RUNWARE_BASE_URL, body, headers);
    return res.data.data[0].imageURL;
}

/**
 * Cloudinary'ye buffer yükler, kalıcı URL döner.
 */
async function uploadBufferToCloudinary(buffer) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const timestamp = Math.round(Date.now() / 1000);

    const crypto2 = await import('crypto');
    const signature = crypto2.default
        .createHash('sha1')
        .update(`timestamp=${timestamp}${apiSecret}`)
        .digest('hex');

    const params = new URLSearchParams();
    params.append('file', `data:image/jpeg;base64,${buffer.toString('base64')}`);
    params.append('timestamp', String(timestamp));
    params.append('api_key', apiKey);
    params.append('signature', signature);

    const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        params.toString()
    );
    return res.data.secure_url;
}

/**
 * Tshirt - POD Tasarım Otomasyonu
 *
 * AKIŞ:
 * 1. GPT ile özgün tasarım fikri üret (hafıza + trend verisi)
 * 2. Runware ile flat grafik tasarım üret (PNG, beyaz arka plan)
 * 3. sharp ile 4 mockup template'e yapıştır (multiply blend)
 * 4. 4 görseli Cloudinary'ye yükle
 * 5. DB'ye kaydet
 */
export async function produceTshirt(storeId, storeCurrency = 'USD') {
    const CATEGORY = 'Tshirt';
    const SUB_CATEGORY = 'POD tasarımları';

    try {
        console.log(`🚀 [${SUB_CATEGORY}] Üretim başlıyor...`);

        // 1. Fikir üret (hafıza + trend)
        const idea = await generateProductIdea(CATEGORY, SUB_CATEGORY);
        console.log(`💡 Tasarım fikri: ${idea.subject}`);

        // 2. Tasarım promptu oluştur
        const designPrompt = [
            `Flat vector-style graphic illustration for a t-shirt print:`,
            idea.details,
            `Clean bold lines, vivid colors, pure white background,`,
            `centered composition, no text, no gradients, no shadows,`,
            `no photographic elements, suitable for screen printing on fabric.`
        ].join(' ');

        console.log(`🎨 Tasarım üretiliyor (Runware PNG)...`);
        const designUrl = await generateDesignImage(designPrompt);

        // 3. 4 mockup'a composite et
        console.log(`🖼️ Mockuplara yerleştiriliyor (sharp multiply)...`);
        const mockupBuffers = await compositeDesignOnMockups(designUrl);

        // 4. Cloudinary'ye yükle
        console.log(`☁️ Cloudinary'ye yükleniyor...`);
        const imageUrls = [];
        for (const buffer of mockupBuffers) {
            try {
                const url = await uploadBufferToCloudinary(buffer);
                imageUrls.push(url);
            } catch (err) {
                console.warn('⚠️ Cloudinary yükleme başarısız, atlanıyor:', err.message);
            }
        }

        if (imageUrls.length === 0) {
            throw new Error('❌ Hiçbir görsel Cloudinary\'ye yüklenemedi.');
        }

        // 5. SEO ve DB
        console.log(`📝 SEO metinleri hazırlanıyor...`);
        const metadata = await generateProductSEO(idea.subject, CATEGORY, SUB_CATEGORY, storeCurrency);

        console.log(`💾 Veritabanına kaydediliyor...`);
        const product = await saveProductToDB(storeId, CATEGORY, SUB_CATEGORY, metadata, imageUrls);

        console.log(`✅ [${SUB_CATEGORY}] Ürün başarıyla üretildi: ${product.title}`);
        return product;

    } catch (error) {
        console.error(`❌ [${SUB_CATEGORY}] Hatası:`, error);
        throw error;
    }
}
