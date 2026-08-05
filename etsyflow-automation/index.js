import 'dotenv/config';
import express from 'express';
// Forced redeploy trigger - 2026-04-26
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { runTrendAnalysis, ensureTrendForCategory } from './trend/runner.js';
import { produceSingleSidedKeychain } from './punch-needle/single-sided-keychain.js';
import { producePillowcase } from './punch-needle/pillowcase.js';
import { produceCoaster } from './punch-needle/coaster.js';
import { produceBrooch } from './punch-needle/brooch.js';
import { produceMousepad } from './punch-needle/mousepad.js';

import { produceCrochetKeychain } from './crochet/keychain.js';
import { produceAmigurumi } from './crochet/amigurumi.js';
import { produceMobile } from './crochet/mobile.js';

import { produce3DKeychain } from './3d-print/keychain.js';
import { produce3DFigure } from './3d-print/figure.js';
import { produce3DPenHolder } from './3d-print/pen-holder.js';
import { produce3DPlanter } from './3d-print/planter.js';
import { produce3DToothbrushHolder } from './3d-print/toothbrush-holder.js';
import { produce3DPhoneStand } from './3d-print/phone-stand.js';
import { produce3DDeskOrganizer } from './3d-print/desk-organizer.js';
import { produce3DCarFreshener } from './3d-print/car-freshener.js';
import { produceTshirt } from './tshirt/pod-design.js';
import { produceGlassClock } from './glass-clock/interior-design.js';
import { generateAmigurumiPattern } from './digital-pattern/amigurumi.js';
import { generateClothingPattern } from './digital-pattern/clothing.js';
import { generateBagPattern } from './digital-pattern/bags.js';
import { produceMetalWallArt } from './metal-wall-art/wall-art.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

console.log('🔗 Supabase Bağlantısı Denetleniyor...');

// 🚀 DİREKT REFERANS GÖRSEL VERME ALANI
// Buraya bir URL yapıştırırsan, bütün mağazalar bu görseli baz alır.
// Boş bırakmak istersen null yapabilirsin.
const GLOBAL_REFERENCE_IMAGE = null; 

console.log('📍 URL:', supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : 'YOK!');

const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: ws } });

const AUTOMATION_MAP = {
    'Punch Needle': {
        'Tek Taraflı Anahtarlık': produceSingleSidedKeychain,
        'Yastık kılıfı': producePillowcase,
        'Bardak altlığı': produceCoaster,
        'Broş': produceBrooch,
        'Mousepad': produceMousepad,
    },
    'Crochet': {
        'Anahtarlık': produceCrochetKeychain,
        'Amigurumi': produceAmigurumi,
        'Dönence': produceMobile,
    },
    '3D': {
        'Anahtarlık':      produce3DKeychain,
        'Figure':          produce3DFigure,
        'Kalemlik':        produce3DPenHolder,
        'Saksı':           produce3DPlanter,
        'Diş fırçalığı':   produce3DToothbrushHolder,
        'Telefon standı':  produce3DPhoneStand,
        'Masa organizeri': produce3DDeskOrganizer,
'Araba parfümü':   produce3DCarFreshener,
    },
    'Tshirt': {
        'POD tasarımları': produceTshirt,
    },
    'Cam Saat': {
        'Farklı temalı iç tasarımlar': produceGlassClock,
    },
    'Digital': {
        'Amigurumi Crochet Pattern PDF': generateAmigurumiPattern,
        'Knitted Clothing Pattern PDF': generateClothingPattern,
        'Crochet Bag Pattern PDF': generateBagPattern,
    },
    'Metal Wall Art': {
        'Metal Pano': produceMetalWallArt,
    }
};

let lastExchangeRateUpdate = null;
let isOrchestratorRunning = false;

async function updateExchangeRate() {
    const now = new Date();
    // Eğer son güncellemeden bu yana 1 saat geçmemişse tekrar çekme (API limitleri için)
    if (lastExchangeRateUpdate && (now - lastExchangeRateUpdate) < 60 * 60 * 1000) return;

    try {
        console.log('🌐 [DÖVİZ] Güncel dolar kuru çekiliyor...');
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        
        if (data && data.rates && data.rates.TRY) {
            const rate = data.rates.TRY.toFixed(2);
            const { error } = await supabase
                .from('app_settings')
                .upsert({ 
                    key: 'usd_try_rate', 
                    value: rate, 
                    updated_at: new Date().toISOString() 
                }, { onConflict: 'key' });

            if (error) throw error;
            lastExchangeRateUpdate = now;
            console.log(`✅ [DÖVİZ] Kur güncellendi: 1 USD = ${rate} ₺`);
        }
    } catch (err) {
        console.error('❌ [DÖVİZ] Kur güncellenirken hata:', err.message);
    }
}

async function startOrchestrator() {
    if (isOrchestratorRunning) {
        console.log('⏳ Önceki denetim hâlâ devam ediyor, bu tur atlandı.');
        return;
    }
    isOrchestratorRunning = true;

    try {
        await _runOrchestrator();
    } finally {
        isOrchestratorRunning = false;
    }
}

async function _runOrchestrator() {
    await updateExchangeRate(); // Döviz kurunu kontrol et/güncelle
    const now = new Date().toISOString();
    console.log(`--- 🤖 EtsyFlow Denetimi [${new Date().toLocaleTimeString()}] ---`);
    console.log(`🕒 Sunucu Saati: ${now}`);

    try {
        // 1. TAM DENETİM: Veritabanındaki HER ŞEYİ bir görelim
        const { data: allRows, error: fetchAllErr } = await supabase
            .from('cron_jobs')
            .select('id, next_run_at, is_active, store_id');
        
        if (fetchAllErr) console.error('❌ Tablo okunurken hata:', fetchAllErr);
        
        console.log(`📊 DB DURUMU: Toplam ${allRows?.length || 0} satır var.`);
        allRows?.forEach(row => {
            console.log(`   - [Job ${row.id}] Mağaza: ${row.store_id} | Aktif: ${row.is_active} | Vakit: ${row.next_run_at}`);
        });

        const { data: jobs, error } = await supabase
            .from('cron_jobs')
            .select(`
                *,
                stores (id, name, category, sub_category)
            `)
            .eq('is_active', true)
            .lte('next_run_at', now);

        if (error) throw error;

        if (!jobs || jobs.length === 0) {
            console.log('☕ Şartları sağlayan (aktif + vakti gelmiş) iş yok.');
            return;
        }

        console.log(`🚀 HAREKET BAŞLADI! ${jobs.length} mağaza işleme alınıyor.`);

        for (const job of jobs) {
            // 3. GÜNCEL MAĞAZA VERİSİNİ ÇEK (Senkronizasyon garantisi için)
            const { data: freshStore, error: storeErr } = await supabase
                .from('stores')
                .select('id, name, category, sub_category, currency, reference_image, profiles(plan_expires_at)')
                .eq('id', job.store_id)
                .single();

            if (storeErr || !freshStore) {
                console.warn(`⚠️ [Job ${job.id}] İçin güncel mağaza verisi alınamadı!`);
                continue;
            }

            // 1. ABONELİK SÜRESİ KONTROLÜ
            const now = new Date();
            const planExpiresAt = freshStore.profiles?.plan_expires_at;
            const subEnd = planExpiresAt ? new Date(planExpiresAt) : null;

            if (subEnd && now > subEnd) {
                console.log(`🛑 [ABONELİK DOLDU] Mağaza: ${freshStore.name} | Süre Bitiş: ${subEnd.toLocaleDateString('tr-TR')}`);
                continue; // Bir sonraki mağazaya geç, bunu üretme
            }

            // 2. KATEGORİ SENKRONİZASYONU: Sadece stores tablosundaki taze veriye güven
            const category = freshStore.category;
            const subCategory = freshStore.sub_category;

            console.log(`🔍 [SYNC KONTROL] Mağaza: ${freshStore.name} | DB Kategori: ${category} | DB Alt Kategori: ${subCategory}`);

            const targetSubCategory = subCategory || category;
            console.log(`🛠️ [${freshStore.name}] (${freshStore.id}) için ÜRETİM BAŞLIYOR: ${category} -> ${targetSubCategory}`);

            // 3. ÜRETİM FONKSİYONU KONTROLÜ
            const produceFunc = AUTOMATION_MAP[category]?.[targetSubCategory];

            if (!produceFunc) {
                console.warn(`⚠️ [${category} -> ${subCategory}] için otomasyon bulunamadı!`);
                continue;
            }

            // 4. OPTİMİSTİK KİLİT: Job'ı anında claim et
            // next_run_at'ı ileriye çek, böylece bir sonraki döngü bu job'ı tekrar almaz.
            // .eq('next_run_at', job.next_run_at) şartı: başka bir runner zaten aldıysa
            // güncelleme 0 satır döner → biz de atlıyoruz.
            const nextRun = new Date();
            nextRun.setHours(nextRun.getHours() + (job.interval_hours || 8));

            const { data: claimed } = await supabase
                .from('cron_jobs')
                .update({
                    last_run_at: new Date().toISOString(),
                    next_run_at: nextRun.toISOString()
                })
                .eq('id', job.id)
                .eq('next_run_at', job.next_run_at)
                .select();

            if (!claimed || claimed.length === 0) {
                console.log(`⏭️ [${freshStore.name}] başka bir çalışma tarafından alındı, atlanıyor.`);
                continue;
            }

            // 5. ÜRETİM FONKSİYONUNU ÇALIŞTIR
            try {
                // Trend verisi yoksa veya süresi dolduysa önce güncelle
                await ensureTrendForCategory(category, targetSubCategory);

                const finalReference = GLOBAL_REFERENCE_IMAGE || freshStore.reference_image;
                await produceFunc(freshStore.id, freshStore.currency || 'USD', finalReference);
                console.log(`✅ [${freshStore.name}] üretimi tamamlandı ve bir sonraki vakit set edildi: ${nextRun.toLocaleString()}`);
            } catch (prodError) {
                console.error(`❌ [${freshStore.name}] üretim hatası:`, prodError);
                // Üretim başarısız olursa next_run_at'ı geri al ki tekrar denensin
                await supabase.from('cron_jobs').update({
                    next_run_at: job.next_run_at
                }).eq('id', job.id);
            }
        }
    } catch (err) {
        console.error('🚨 KRİTİK MOTOR HATASI:', err);
    }
}

async function startSocialOrchestrator() {
    console.log(`📱 Sosyal Medya Denetimi Başladı... [${new Date().toLocaleTimeString()}]`);
    try {
        const { triggerSocialPosting } = await import('./utils.js');

        // 1. Yüklenmiş ama sosyal medyada paylaşılmamış ürünleri bul
        const { data: pendingProducts, error } = await supabase
            .from('products')
            .select('*, stores(id, name, etsy_shop_link, plan, pinterest_board_id)')
            .eq('upload_status', 'uploaded')
            .or('is_shared_social.eq.false,is_shared_social.is.null')
            .limit(5); // Her turda en fazla 5 ürün işle (API limitleri için)

        if (error) throw error;

        if (!pendingProducts || pendingProducts.length === 0) {
            console.log('☕ Paylaşılacak taze ürün bulunamadı.');
            return;
        }

        console.log(`🚀 ${pendingProducts.length} ürün sosyal medyada paylaşılıyor...`);

        for (const product of pendingProducts) {
            const imgs = product.images || product.image_urls || [];
            await triggerSocialPosting(
                product.id,
                product.store_id,
                product.title,
                product.description,
                imgs
            );
        }
    } catch (err) {
        console.error('🚨 SOSYAL MEDYA MOTORU HATASI:', err.message);
    }
}

const app = express();
app.get('/', (req, res) => res.send('🤖 EtsyFlow Motor Aktif!'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🌍 Sunucu Port ${PORT} üzerinde dinliyor...`);
    
    // Motorları başlat
    startOrchestrator();
    startSocialOrchestrator();

    // Periyodik denetimler
    setInterval(startOrchestrator, 30 * 1000);       // 30 saniyede bir ürün üretimi
    setInterval(startSocialOrchestrator, 60 * 1000); // 60 saniyede bir sosyal paylaşım
    // Trend analizi artık ayrı timer yerine her üretimden önce otomatik çalışır

    // Render free tier'da instance uyumasın diye kendi kendine ping
    const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    setInterval(async () => {
        try { await fetch(SELF_URL); } catch (_) {}
    }, 10 * 60 * 1000); // her 10 dakikada bir
});
