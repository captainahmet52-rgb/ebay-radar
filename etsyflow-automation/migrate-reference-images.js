import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import crypto from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY
);

async function uploadToCloudinary(buffer) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const timestamp = Math.round(Date.now() / 1000);
    const signature = crypto.createHash('sha1').update(`timestamp=${timestamp}${apiSecret}`).digest('hex');

    const params = new URLSearchParams();
    params.append('file', `data:image/jpeg;base64,${buffer.toString('base64')}`);
    params.append('timestamp', timestamp);
    params.append('api_key', apiKey);
    params.append('signature', signature);
    params.append('folder', 'reference-images');

    const res = await axios.post(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, params.toString());
    return res.data.secure_url;
}

async function downloadImage(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.google.com/',
        },
        timeout: 15000,
    });
    return Buffer.from(res.data);
}

async function main() {
    console.log('🔍 Tüm mağazalar çekiliyor...');

    const { data: stores, error } = await supabase
        .from('stores')
        .select('id, name, reference_image')
        .not('reference_image', 'is', null);

    if (error) {
        console.error('❌ Mağazalar çekilemedi:', error.message);
        return;
    }

    console.log(`📦 ${stores.length} mağaza bulundu.\n`);

    for (const store of stores) {
        const url = store.reference_image;

        if (!url || url.includes('cloudinary.com')) {
            console.log(`⏭️  [${store.name}] Zaten Cloudinary'de, atlanıyor.`);
            continue;
        }

        console.log(`🔄 [${store.name}] Imgur → Cloudinary: ${url}`);

        try {
            const buffer = await downloadImage(url);
            console.log(`   ✅ İndirildi (${Math.round(buffer.length / 1024)} KB)`);

            const cloudUrl = await uploadToCloudinary(buffer);
            console.log(`   ✅ Cloudinary'e yüklendi: ${cloudUrl}`);

            const { error: updateError } = await supabase
                .from('stores')
                .update({ reference_image: cloudUrl })
                .eq('id', store.id);

            if (updateError) throw updateError;

            console.log(`   ✅ DB güncellendi!\n`);
        } catch (err) {
            console.error(`   ❌ [${store.name}] Başarısız: ${err.message}\n`);
        }
    }

    console.log('🎉 Migrasyon tamamlandı!');
}

main();
