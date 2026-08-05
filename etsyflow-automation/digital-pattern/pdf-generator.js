import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

/**
 * Görseli ve metni birleştirerek şık bir 'Tutorial Card' PDF'i oluşturur
 */
export async function createPatternPDF(title, content, fileName, imageUrl = null) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({
                margin: 0, // Kart tam sayfa olsun
                size: 'A4'
            });

            const outputDir = path.join(process.cwd(), 'output', 'patterns');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const filePath = path.join(outputDir, fileName);
            const stream = fs.createWriteStream(filePath);

            doc.pipe(stream);

            // 1. FONT YÜKLEME (Türkçe karakterler için harici font, yoksa PDFKit built-in Helvetica)
            // Hem Windows hem Linux/Render ortamında çalışacak şekilde
            const fontPaths = [
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',  // Linux/Render
                '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', // Linux alternatif
                'C:/Windows/Fonts/arial.ttf',  // Windows
            ];
            const availableFont = fontPaths.find(fp => fs.existsSync(fp));
            if (availableFont) {
                doc.font(availableFont);
            } else {
                // Harici font bulunamadı — PDFKit built-in Helvetica kullan
                doc.font('Helvetica');
            }

            // 2. GÖRSELİ PDF'E EKLE (Eğer varsa)
            if (imageUrl) {
                try {
                    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                    const imageBuffer = Buffer.from(response.data);
                    doc.image(imageBuffer, 0, 0, { width: 595.28 }); // A4 genişliği
                } catch (imgErr) {
                    console.warn('⚠️ PDF içine görsel eklenemedi:', imgErr.message);
                }
            } else {
                // Görsel yoksa en azından başlığı yazalım (yedek plan)
                doc.fillColor('#2c3e50').fontSize(24).text(title.toUpperCase(), 50, 50, { align: 'center' });
            }

            doc.addPage({ margin: 50 });

            // İçerik (Düz metin olarak işleyelim)
            const lines = content.split('\n');
            doc.fillColor('#34495e').fontSize(12);

            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed === '') {
                    doc.moveDown(0.5);
                } else if (trimmed === trimmed.toUpperCase() && trimmed.length > 3) {
                    // Tamamı büyük harf olan satırları başlık yapalım
                    doc.moveDown().fontSize(14).fillColor('#2c3e50').text(trimmed, { bold: true }).fontSize(12).fillColor('#34495e');
                } else {
                    doc.text(line, {
                        align: 'left',
                        lineGap: 2
                    });
                }
            });

            doc.end();

            stream.on('finish', () => resolve(filePath));
            stream.on('error', (err) => reject(err));

        } catch (error) {
            reject(error);
        }
    });
}
