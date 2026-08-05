import axios from 'axios';

/**
 * Pinterest Otomatik Pinleme Fonksiyonu
 */
export async function createPin(accessToken, boardId, imageUrl, title, description, link) {
    if (!accessToken || !boardId) {
        console.warn('⚠️ [Social] Pinterest token veya boardId eksik, atlanıyor.');
        return null;
    }

    try {
        console.log(`📌 [Pinterest] Pin oluşturuluyor: ${title}`);
        
        const response = await axios.post('https://api.pinterest.com/v5/pins', {
            title: title.substring(0, 100),
            description: description.substring(0, 500),
            link: link,
            board_id: boardId,
            media_source: {
                source_type: 'image_url',
                url: imageUrl
            }
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ [Pinterest] Pin başarıyla oluşturuldu:', response.data.id);
        return response.data.id;
    } catch (error) {
        console.error('❌ [Pinterest] Pinleme hatası:', error.response?.data || error.message);
        return null;
    }
}
