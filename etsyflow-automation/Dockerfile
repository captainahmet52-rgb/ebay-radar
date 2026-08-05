# EtsyFlow otomasyon motoru — eskiden Render.com'da çalışıyordu, artık EBAY PROJE
# ile aynı VPS'te, aynı repo/Coolify deploy akışıyla çalışıyor. Sadece dış API'lere
# (Supabase, OpenAI, Runware, Apify, Cloudinary, Buffer) istek atan bağımsız bir
# arka plan servisi — EBAY PROJE'nin postgres/redis'ine hiç dokunmaz.
FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
CMD ["node", "index.js"]
