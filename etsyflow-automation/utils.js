import 'dotenv/config';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { markDesignAsUsed } from './trend/uploader.js';

// Supabase Bağlantısı — Node 20'de native WebSocket yok, realtime-js'e "ws" paketini
// elle vermek gerekiyor (aksi halde createClient constructor'da çöküyor).
const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { realtime: { transport: ws } }
);

// OpenAI Bağlantısı
const openai = new OpenAI({
    apiKey: process.env.VITE_OPENAI_API_KEY,
});

/**
 * 1. Adım: Fikir Üretme (GPT-4o-mini)
 * Uyumluluk: (category, subCategory, existingIdeas, customDetails, referenceImage)
 */
export async function generateProductIdea(category, subCategory, existingIdeas = [], customDetails = '', referenceImage = null) {
    console.log(`💡 [${subCategory}] için fikir üretiliyor... (Hafıza + Trend kontrol ediliyor)`);
    
    // 🔥 HAFIZA: Bu alt kategoride daha önce üretilen TÜM ürünleri çek — hiçbiri tekrar edilmesin
    try {
        const { data: allProducts } = await supabase
            .from('products')
            .select('title')
            .eq('sub_category', subCategory)
            .order('created_at', { ascending: false });

        if (allProducts && allProducts.length > 0) {
            const allTitles = allProducts.map(p => p.title).filter(Boolean);
            existingIdeas = [...existingIdeas, ...allTitles];
            console.log(`🧠 GPT Hafızası: ${allProducts.length} ürün yüklendi (hiçbiri tekrar edilmeyecek).`);
        }
    } catch (err) {
        console.warn('⚠️ Hafıza çekilirken hata oluştu, devam ediliyor...', err.message);
    }

    // 📊 TREND VERİSİ: Supabase'den en güncel trend analizi çek
    let trendContext = '';
    try {
        const { data: trend } = await supabase
            .from('trend_insights')
            .select('*')
            .eq('category', category)
            .eq('sub_category', subCategory)
            .eq('is_active', true)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (trend) {
            console.log(`📊 Trend verisi bulundu! Arama: "${trend.search_query}" (${trend.scraped_count} ürün analiz edildi)`);

            // Kullanılmış tasarımları hafızaya ekle
            if (trend.used_designs && trend.used_designs.length > 0) {
                existingIdeas = [...existingIdeas, ...trend.used_designs];
            }

            // Gerçek Etsy ürün isimlerini de hafızaya ekle — birebir kopyayı önlemek için
            if (trend.sample_titles && trend.sample_titles.length > 0) {
                existingIdeas = [...existingIdeas, ...trend.sample_titles];
            }

            trendContext = `
REAL MARKET DATA (from Etsy best seller analysis of ${trend.scraped_count} products):
- Trending keywords: ${trend.trending_keywords?.join(', ') || 'N/A'}
- Popular design styles: ${trend.trending_styles?.join(', ') || 'N/A'}
- Target niches: ${trend.trending_niches?.join(', ') || 'N/A'}
- Market summary: ${trend.top_sellers_summary || 'N/A'}
- Average best seller price: $${trend.avg_price || 'N/A'}
${trend.design_directions?.length > 0 ? `- Trend-inspired directions (use as inspiration ONLY): ${trend.design_directions.map(d => d.concept).join(', ')}` : ''}

IMPORTANT: Use this trend data to understand what STYLE and NICHE is selling — but your design must be 100% ORIGINAL. Do NOT copy or closely replicate any existing product. Create something new that fits the trend aesthetic.`;
        } else {
            console.log(`ℹ️ Aktif trend verisi bulunamadı, standart üretim yapılacak.`);
        }
    } catch (err) {
        console.warn('⚠️ Trend verisi çekilirken hata:', err.message);
    }

    const prompt = customDetails
        ? `You are a creative design director for a handmade ${category} shop specializing in ${subCategory}.

    ${customDetails}

    ${trendContext}
    ${existingIdeas.length > 0 ? `CRITICAL: These designs already exist — do NOT repeat or closely imitate any of them: ${existingIdeas.join(', ')}` : ''}

    Return a JSON object:
    {
        "subject": "Short catchy product name (3-6 words)",
        "details": "Full visual description for the image generator — be specific about shapes, colors, characters, style."
    }`
        : `You are a creative design director for a handmade ${category} shop specializing in ${subCategory}.

    Your job is to invent a NEW DESIGN MOTIF to be applied onto an existing handmade product. The product's physical form is already fixed — you are ONLY designing what pattern/character/illustration appears on the front face of the product.

    ${trendContext}
    ${existingIdeas.length > 0 ? `CRITICAL: These designs already exist — do NOT repeat or closely imitate any of them: ${existingIdeas.join(', ')}` : ''}

    RULES:
    - Describe ONLY the design motif/pattern/character — NOT the product itself (shape, material, technique are already set).
    - The design must be simple, clean, and easy to stitch by hand. NO complex gradients, NO photorealistic details, NO impossible geometries.
    - Think flat, graphic, cute (kawaii) or minimal illustrations — like popular Etsy punch needle or crochet items.
    - ONE single motif only. No sets, no pairs.
    - Make it Pinterest-worthy and highly giftable.

    Examples: "a smiling sun with tiny rays in yellow and orange", "a tiny potted cactus with a pink flower", "a sleepy bear face in cream and brown tones".

    Return a JSON object:
    {
        "subject": "Short catchy product name (3-6 words)",
        "details": "Visual description of the design motif ONLY — colors, character, expression, key shapes. Do NOT mention the product type."
    }`;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: prompt }],
        response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result;
}

const RUNWARE_BASE_URL = 'https://api.runware.ai/v1';
// FLUX.2-klein-9B — ~$0.00078/image — Görsel 1 için (referanstan ürün üretme)
const KLEIN_MODEL = 'runware:400@2';
// FLUX.1-Kontext-Pro — $0.04/image — Görsel 2-3 için (ürünü kilitle, arka planı değiştir)
const KONTEXT_MODEL = 'bfl:3@1';

/**
 * Dış URL'yi Runware'e upload et → Runware CDN URL'si döner (seedImage/referenceImages için gerekli)
 */
async function uploadImageToRunware(externalUrl, runwareHeaders) {
    try {
        console.log(`📤 [Runware Upload] İndiriliyor: ${externalUrl}`);
        const imgRes = await axios.get(externalUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.google.com/',
            },
            timeout: 15000,
        });
        const base64 = Buffer.from(imgRes.data).toString('base64');
        console.log(`📤 [Runware Upload] Upload ediliyor (${Math.round(base64.length / 1024)} KB)...`);
        const body = [{
            taskType: 'imageUpload',
            taskUUID: crypto.randomUUID(),
            image: base64,
        }];
        const res = await axios.post(RUNWARE_BASE_URL, body, runwareHeaders);
        const uploadedUrl = res.data?.data?.[0]?.imageURL;
        if (!uploadedUrl) {
            console.warn(`⚠️ [Runware Upload] URL alınamadı. Yanıt:`, JSON.stringify(res.data));
            return null;
        }
        console.log(`✅ [Runware Upload] Başarılı: ${uploadedUrl}`);
        return uploadedUrl;
    } catch (err) {
        console.warn(`⚠️ [Runware Upload] Başarısız: ${err.message}`);
        if (err.response?.data) console.warn(`   Detay:`, JSON.stringify(err.response.data));
        return null;
    }
}

/**
 * FLUX.2-klein I2I — Görsel 1: referanstan yeni ürün üret, stil/ışık/kompozisyon korunur
 */
async function generateKleinImage(imageUrl, prompt, seed, headers) {
    try {
        // Runware dış URL'leri reddediyor — önce Runware'e upload et
        const runwareUrl = await uploadImageToRunware(imageUrl, headers);
        if (!runwareUrl) return null;

        const body = [{
            taskType: 'imageInference',
            taskUUID: crypto.randomUUID(),
            model: KLEIN_MODEL,
            positivePrompt: prompt,
            seedImage: runwareUrl,
            strength: 0.75,
            width: 1024,
            height: 1024,
            seed,
            numberResults: 1,
            outputFormat: 'JPEG'
        }];
        const res = await axios.post(RUNWARE_BASE_URL, body, headers);
        return res.data.data[0].imageURL;
    } catch (err) {
        console.warn(`⚠️ Runware FLUX.2-klein I2I başarısız (seed ${seed}): ${err.message}`);
        return null;
    }
}

/**
 * FLUX.1-Kontext-Pro I2I — Görsel 2-3: ürünü birebir kilitle, SADECE arka planı değiştir
 */
async function generateKontextImage(imageUrl, prompt, seed, headers) {
    try {
        const body = [{
            taskType: 'imageInference',
            taskUUID: crypto.randomUUID(),
            model: KONTEXT_MODEL,
            positivePrompt: prompt,
            referenceImages: [imageUrl],
            width: 1024,
            height: 1024,
            seed,
            numberResults: 1,
            outputFormat: 'JPEG'
        }];
        const res = await axios.post(RUNWARE_BASE_URL, body, headers);
        return res.data.data[0].imageURL;
    } catch (err) {
        console.warn(`⚠️ Runware FLUX.1-Kontext-Pro I2I başarısız (seed ${seed}): ${err.message}`);
        return null;
    }
}

/**
 * FLUX.2-klein text-to-image — referans görsel olmadığında fallback
 */
export async function generateOneImage(prompt, seed) {
    try {
        const headers = {
            headers: {
                'Authorization': `Bearer ${process.env.RUNWARE_API_KEY}`,
                'Content-Type': 'application/json',
            }
        };
        const body = [{
            taskType: 'imageInference',
            taskUUID: crypto.randomUUID(),
            model: KLEIN_MODEL,
            positivePrompt: prompt,
            width: 1024,
            height: 1024,
            seed,
            numberResults: 1,
            outputFormat: 'JPEG'
        }];
        const res = await axios.post(RUNWARE_BASE_URL, body, headers);
        return res.data.data[0].imageURL;
    } catch (err) {
        console.warn(`⚠️ Runware text-to-image başarısız: ${err.message}`);
        return null;
    }
}

/**
 * 2. Adım: 3 Görsel Üretme
 *
 * AKIŞ:
 * - Görsel 1: FLUX.2-klein I2I — referans görsel → SADECE ürünü değiştir, stil/ışık/kompozisyon korunur
 * - Görsel 2 & 3: FLUX.2-klein I2I — görsel 1 baz → ürün KESİNLİKLE değişmez, sadece arka plan değişir
 * - Referans yoksa: Görsel 1 text-to-image, 2-3 yine I2I klonlama
 */
export async function generateProductImages(ideaDetails, masterPrompts, referenceImage = null) {
    const headers = {
        headers: {
            'Authorization': `Bearer ${process.env.RUNWARE_API_KEY}`,
            'Content-Type': 'application/json',
        }
    };

    const promptsArray = Array.isArray(masterPrompts) ? masterPrompts : [masterPrompts, masterPrompts, masterPrompts];
    const baseSeed = Math.floor(Math.random() * 900000000) + 100000000;

    const imageUrls = [];

    // ── GÖRSEL 1: ANA ÜRÜN ──
    let img1 = null;

    if (referenceImage) {
        // Referans görseli Runware'e upload et — dış URL'ler Kontext tarafından reddediliyor
        console.log(`📸 1. görsel üretiliyor... (Kontext I2I — referans Runware'e upload ediliyor)`);
        const runwareRefUrl = await uploadImageToRunware(referenceImage, headers);
        if (runwareRefUrl) {
            const prompt1 = `Edit this reference image. Keep the EXACT same product format: same shape, same construction technique, same materials, same stitching style, same hardware, same photography style, same background, same lighting, same composition. Do NOT change the product type or form in any way. Only apply this new design: ${ideaDetails}. ${promptsArray[0] ? `Style guidance: ${promptsArray[0]}` : ''} The result must look like it was made by the same maker with the same technique — only the design/motif/theme changes.`;
            img1 = await generateKontextImage(runwareRefUrl, prompt1, baseSeed, headers);
        }
    }

    if (!img1) {
        const prompt1Fallback = [
            `A professional product photograph of a single handmade artisan item: ${ideaDetails}.`,
            `${promptsArray[0]}`,
            `Clean background, studio lighting, sharp focus, 8K, highly detailed texture, no text, no watermarks, no people.`
        ].join(' ');
        console.log(`📸 1. görsel üretiliyor... (FLUX.2-klein text-to-image fallback)`);
        img1 = await generateOneImage(prompt1Fallback, baseSeed, headers);
    }

    if (!img1) throw new Error('❌ Ana görsel üretilemedi — işlem durduruluyor.');

    imageUrls.push(img1);
    console.log(`✅ 1. görsel başarıyla üretildi.`);

    // ── GÖRSEL 2 & 3: KONTEXT KLONLAMA (görsel 1 baz alınıyor, ürün dokunulmaz) ──
    for (let i = 1; i < 3; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const scene = promptsArray[i] || promptsArray[0];

        const clonePrompt = `Edit this image: keep the product — ${ideaDetails} — completely unchanged. Do not alter its shape, color, material, texture, or any detail. Only change the background and scene to: ${scene}.`;

        console.log(`📸 ${i + 1}. görsel klonlanıyor... (FLUX.1-Kontext-Pro I2I)`);
        const url = await generateKontextImage(imageUrls[0], clonePrompt, baseSeed + i, headers);

        if (url) {
            imageUrls.push(url);
            console.log(`✅ ${i + 1}. görsel başarıyla klonlandı.`);
        } else {
            console.warn(`⚠️ ${i + 1}. görsel klonlanamadı, 1. görsel kopyalanıyor...`);
            imageUrls.push(imageUrls[0]);
        }
    }

    return await uploadImagesToStorage(imageUrls);
}


/**
 * 3. Adım: SEO Başlık, Açıklama ve Etiket Üretme
 * Uyumluluk: (ideaSubject, category, subCategory, storeCurrency)
 */
export async function generateProductSEO(ideaSubject, category, subCategory, storeCurrency = 'USD') {
    let suggestedPrice = 29.99;
    try {
        const { data: priceData } = await supabase
            .from('subcategory_prices')
            .select('price_try, price_usd')
            .eq('category', category)
            .eq('sub_category', subCategory)
            .eq('is_active', true)
            .single();
        
        if (priceData) {
            suggestedPrice = storeCurrency === 'TRY' ? parseFloat(priceData.price_try) : parseFloat(priceData.price_usd);
            console.log(`💰 Fiyat bulundu: ${suggestedPrice} ${storeCurrency}`);
        }
    } catch (e) {
        console.warn(`⚠️ Fiyat çekilemedi, varsayılan kullanılıyor.`);
    }

    const prompt = `You are an expert Etsy SEO copywriter. Generate an optimized Etsy listing.
    Product: ${ideaSubject}
    Category: ${category}
    Sub-Category: ${subCategory}

    IMPORTANT: Do NOT use any Markdown formatting like **, #, or -. Use only plain text for the description. 
    Separate sections with double newlines.

    Return JSON:
    {
        "title": "...",
        "description": "...",
        "tags": ["..."],
        "suggested_price": ${suggestedPrice}
    }`;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: prompt }],
        response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
}

/**
 * 4. Adım: Cloudinary'ye Yükleme
 */
async function uploadToCloudinary(buffer) {
    try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;
        const timestamp = Math.round((new Date()).getTime() / 1000);
        const signature = crypto.createHash('sha1').update(`timestamp=${timestamp}${apiSecret}`).digest('hex');

        const params = new URLSearchParams();
        params.append('file', `data:image/jpeg;base64,${buffer.toString('base64')}`);
        params.append('timestamp', timestamp);
        params.append('api_key', apiKey);
        params.append('signature', signature);

        const response = await axios.post(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, params.toString());
        return response.data.secure_url;
    } catch (err) {
        return null;
    }
}

async function uploadImagesToStorage(imageUrls) {
    const permanentUrls = [];
    for (const url of imageUrls) {
        try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            const cloudUrl = await uploadToCloudinary(Buffer.from(response.data));
            permanentUrls.push(cloudUrl || url);
        } catch {
            permanentUrls.push(url);
        }
    }
    return permanentUrls;
}

/**
 * 5. Adım: Veritabanına Kaydet
 */
export async function saveProductToDB(storeId, category, subCategory, metadata, imageUrls, digitalFileUrl = null) {
    const { data: storeData } = await supabase.from('stores').select('user_id, currency, client_id').eq('id', storeId).single();
    
    // SEO'dan gelen fiyatı kontrol et (farklı isimlendirmeler için fallbackler)
    const finalPrice = metadata.suggested_price || metadata.price || metadata.suggestedPrice || 29.99;

    const insertPayload = {
        user_id: storeData.user_id,
        store_id: storeId,
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        price: finalPrice,
        currency: storeData.currency || 'USD',
        images: imageUrls,
        category: category,
        sub_category: subCategory,
        status: 'pending',
        upload_status: 'waiting'
    };

    if (digitalFileUrl) {
        insertPayload.digital_file_url = digitalFileUrl;
    }

    const { data, error } = await supabase
        .from('products')
        .insert(insertPayload)
        .select()
        .single();

    if (error) {
        console.error('❌ Ürün DB kayıt hatası:', error);
        throw error;
    }

    // Hafıza: üretilen ürünü trend_insights'a kaydet — bir daha üretilmesin
    markDesignAsUsed(metadata.title, category, subCategory);

    return data;
}

/**
 * Ekstra: Dijital Şablon Fonksiyonları
 */
export async function generateSingleImage(prompt) {
    const images = await generateProductImages(prompt, [prompt]);
    return images[0];
}

export async function generatePatternText(productIdea, category, subCategory) {
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: `Create a DIY pattern for ${productIdea}` }],
    });
    return response.choices[0].message.content;
}

export async function uploadPDFToStorage(localPath) {
    const buffer = fs.readFileSync(localPath);
    const fileName = `patterns/${path.basename(localPath)}`;
    const { data, error } = await supabase.storage.from('product-images').upload(fileName, buffer);
    if (error) return null;
    return supabase.storage.from('product-images').getPublicUrl(fileName).data.publicUrl;
}

/**
 * Sosyal Medya Paylaşım Tetikleyici
 * Buffer (Pinterest kanalı) ve doğrudan Pinterest API üzerinden paylaşım yapar.
 * index.js'deki startSocialOrchestrator() tarafından çağrılır.
 */
export async function triggerSocialPosting(productId, storeId, title, description, imageUrls) {
    try {
        const { postToBuffer } = await import('./social/buffer.js');
        const { createPin } = await import('./social/pinterest.js');

        // Store'un sosyal medya bilgilerini çek
        const { data: store } = await supabase
            .from('stores')
            .select('pinterest_board_id, buffer_profile_id, etsy_shop_link, plan')
            .eq('id', storeId)
            .single();

        if (!store) {
            console.warn(`⚠️ [Sosyal] Store bulunamadı (id: ${storeId}), atlanıyor.`);
            return;
        }

        const firstImage = Array.isArray(imageUrls) && imageUrls.length > 0 ? imageUrls[0] : null;
        if (!firstImage) {
            console.warn(`⚠️ [Sosyal] Görsel URL'si bulunamadı (ürün: ${productId}), atlanıyor.`);
            return;
        }

        const postText = `${title}\n\n${description || ''}`.trim();

        // ── Buffer üzerinden Pinterest paylaşımı ──
        const bufferToken = process.env.BUFFER_ACCESS_TOKEN;
        const bufferProfileId = store.buffer_profile_id || process.env.BUFFER_PINTEREST_PROFILE_ID;

        if (bufferToken && bufferProfileId) {
            await postToBuffer(
                bufferToken,
                bufferProfileId,
                [firstImage],
                postText,
                {
                    link: store.etsy_shop_link || '',
                    board_id: store.pinterest_board_id || ''
                }
            );
        } else {
            console.warn('⚠️ [Sosyal] Buffer token veya profil ID eksik, Buffer paylaşımı atlandı.');
        }

        // ── Doğrudan Pinterest API paylaşımı ──
        const pinterestToken = process.env.PINTEREST_ACCESS_TOKEN;
        if (pinterestToken && store.pinterest_board_id) {
            await createPin(
                pinterestToken,
                store.pinterest_board_id,
                firstImage,
                title,
                description || '',
                store.etsy_shop_link || ''
            );
        } else {
            console.warn('⚠️ [Sosyal] Pinterest token veya boardId eksik, Pinterest paylaşımı atlandı.');
        }

        // Ürünü paylaşıldı olarak işaretle
        await supabase
            .from('products')
            .update({ is_shared_social: true })
            .eq('id', productId);

        console.log(`📱 [Sosyal] Ürün paylaşıldı: ${title}`);
    } catch (err) {
        console.error(`❌ [Sosyal] Paylaşım hatası:`, err.message);
    }
}
