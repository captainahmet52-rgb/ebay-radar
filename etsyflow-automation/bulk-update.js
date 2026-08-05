import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const automationDir = __dirname;

const categories = ['punch-needle', 'crochet', '3d-print', 'tshirt', 'glass-clock'];

const NEW_PROMPTS_TEMPLATE = `    const MASTER_PROMPTS = [
        "1. PROMPT (ANA GÖRSEL): Buraya ana görselin detaylarını yaz...",
        "2. PROMPT: Buraya ikinci konseptini yaz...",
        "3. PROMPT: Buraya üçüncü konseptini yaz..."
    ];`;

function updateFiles() {
    categories.forEach(cat => {
        const catPath = path.join(automationDir, cat);
        if (!fs.existsSync(catPath)) return;

        const files = fs.readdirSync(catPath).filter(f => f.endsWith('.js'));

        files.forEach(file => {
            const filePath = path.join(catPath, file);
            let content = fs.readFileSync(filePath, 'utf8');

            // 1. MASTER_PROMPT değişkenini MASTER_PROMPTS dizisiyle değiştir
            content = content.replace(/const MASTER_PROMPT = `[^`]*`;/g, NEW_PROMPTS_TEMPLATE);
            content = content.replace(/const MASTER_PROMPT = "[^"]*";/g, NEW_PROMPTS_TEMPLATE);
            content = content.replace(/const MASTER_PROMPT = '[^']*';/g, NEW_PROMPTS_TEMPLATE);

            // 2. generateProductImages çağrısını güncelle
            content = content.replace(/generateProductImages\(idea\.details, MASTER_PROMPT\)/g, 'generateProductImages(idea.details, MASTER_PROMPTS)');
            
            // 3. Değişken ismini güncelle (imageUrl -> imageUrls)
            content = content.replace(/const imageUrl = await/g, 'const imageUrls = await');
            content = content.replace(/saveProductToDB\(storeId, CATEGORY, SUB_CATEGORY, metadata, imageUrl\)/g, 'saveProductToDB(storeId, CATEGORY, SUB_CATEGORY, metadata, imageUrls)');
            content = content.replace(/saveProductToDB\(storeId, category, subCategory, metadata, imageUrl\)/g, 'saveProductToDB(storeId, category, subCategory, metadata, imageUrls)');

            fs.writeFileSync(filePath, content);
            console.log(`✅ Güncellendi: ${cat}/${file}`);
        });
    });
}

updateFiles();
