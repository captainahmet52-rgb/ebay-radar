import axios from 'axios';

/**
 * Instagram Graph API - Otomatik Post Paylaşımı
 * Not: Business veya Creator hesabı gerektirir.
 */
export async function postToInstagram(accessToken, igUserId, imageUrl, caption) {
    if (!accessToken || !igUserId) {
        console.warn('⚠️ [Social] Instagram token veya igUserId eksik, atlanıyor.');
        return null;
    }

    try {
        console.log(`📸 [Instagram] Medya konteyneri oluşturuluyor...`);
        
        // 1. Medya konteyneri oluştur (Container)
        const containerRes = await axios.post(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
            image_url: imageUrl,
            caption: caption,
            access_token: accessToken
        });

        const creationId = containerRes.data.id;
        console.log(`⏳ [Instagram] Medya işleniyor (ID: ${creationId})...`);

        // 2. Medyayı yayınla (Publish)
        // Not: Gerçek senaryoda medyanın işlenmesi için 5-10 saniye beklemek gerekebilir.
        await new Promise(r => setTimeout(r, 10000));

        const publishRes = await axios.post(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
            creation_id: creationId,
            access_token: accessToken
        });

        console.log('✅ [Instagram] Post başarıyla yayınlandı:', publishRes.data.id);
        return publishRes.data.id;
    } catch (error) {
        console.error('❌ [Instagram] Paylaşım hatası:', error.response?.data || error.message);
        return null;
    }
}
