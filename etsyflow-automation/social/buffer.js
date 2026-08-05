import axios from 'axios';

/**
 * Buffer API - Otomatik Paylaşım (Pinterest & Instagram Desteğiyle)
 */
export async function postToBuffer(accessToken, profileId, images, text, options = {}) {
    if (!accessToken || !profileId || !images || images.length === 0) {
        console.warn('⚠️ [Buffer] Parametreler eksik, atlanıyor.');
        return null;
    }

    try {
        console.log(`📤 [Buffer] Paylaşım gönderiliyor (Profil: ${profileId}, Görsel: ${images.length})...`);
        
        const params = new URLSearchParams();
        params.append('text', text);
        
        // profileId string de olabilir, array de olabilir
        const ids = Array.isArray(profileId) ? profileId : profileId.split(',');
        ids.forEach(id => {
            if (id) params.append('profile_ids[]', id.trim());
        });
        params.append('access_token', accessToken);
        params.append('now', 'true');

        // Pinterest'e özel alanlar
        if (options.link) {
            params.append('extra_data[link]', options.link);
        }
        if (options.board_id) {
            params.append('extra_data[board_id]', options.board_id);
        }

        // Görselleri ekle (Çoklu görsel desteği)
        if (images.length === 1) {
            params.append('media[picture]', images[0]);
        } else {
            // Instagram ve Pinterest için çoklu görsel formatı
            images.forEach((url, index) => {
                params.append(`media[photos][${index}]`, url);
            });
        }

        const response = await axios.post('https://api.bufferapp.com/1/updates/create.json', 
            params.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        console.log('✅ [Buffer] Paylaşım başarıyla Buffer kuyruğuna eklendi.');
        return response.data;
    } catch (error) {
        console.error('❌ [Buffer] Paylaşım hatası:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Buffer hesabındaki tüm bağlı profilleri getirir.
 */
export async function getBufferProfiles(accessToken) {
    if (!accessToken) return [];
    try {
        const response = await axios.get(`https://api.bufferapp.com/1/profiles.json?access_token=${accessToken}`);
        return response.data || [];
    } catch (error) {
        console.error('❌ [Buffer] Profiller çekilemedi:', error.message);
        return [];
    }
}
