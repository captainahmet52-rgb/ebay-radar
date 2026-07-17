// AI Meta kampanya taslağı — İKİ AŞAMALI akış (sahibin kararı, 2026-07-18):
//   1. ARAŞTIRMA: AI önce ürünü tanır — depo verisinden (başlık, kategori, fiyat,
//      puan, satış sayısı) hedef kitleyi ve satış açısını ÇIKARIR.
//   2. ÜRETİM: o araştırmaya dayanarak reklam metni + başlık + kitle önerisi yazar.
// İki aşama TEK istekte yürür (model önce researchNotes doldurur, sonra metinleri
// yazar) — iki ayrı çağrıdan hem ucuz hem tutarlı.
//
// Model: claude-haiku-4-5 — SAHİBİN AÇIK KARARI ("haiku kullanalım"), maliyet-öncelikli.
// Taslak başına maliyet ~<$0.01. Çıktı saf JSON + Zod doğrulama, 1 retry.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 1500;

export function isCampaignDraftConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface ProductResearchInput {
  title: string;
  category: string | null;
  salePriceUsd: number;
  aliRating: number;
  aliOrders: number;
  shopDomain: string;
}

const DraftSchema = z.object({
  // Aşama 1 — araştırma çıktısı (kullanıcıya da gösterilir: "AI ürünü böyle okudu")
  researchNotes: z.object({
    productSummary: z.string().min(10),
    targetAudience: z.string().min(10),
    sellingAngle: z.string().min(10),
  }),
  // Aşama 2 — kampanya taslağı
  campaignName: z.string().min(3).max(80),
  headline: z.string().min(3).max(60),
  primaryTexts: z.array(z.string().min(20)).min(2).max(3),
  audienceSuggestions: z.array(z.string().min(3)).min(3).max(6),
  dailyBudgetSuggestionUsd: z.number().min(5).max(100),
});

export type CampaignDraft = z.infer<typeof DraftSchema>;

function buildPrompt(input: ProductResearchInput): string {
  return [
    "Sen bir e-ticaret performans pazarlamacısısın. Aşağıdaki dropshipping ürünü için",
    "Meta (Facebook/Instagram) reklam kampanyası taslağı hazırlayacaksın.",
    "",
    "ÖNCE ürünü araştır/analiz et (researchNotes): bu ürün ne işe yarar, kim satın alır",
    "(yaş/ilgi alanı), en güçlü satış açısı ne (fiyat mı, sorun çözme mi, görsellik mi)?",
    "SONRA o analize dayanarak reklam metinlerini yaz.",
    "",
    "ÜRÜN VERİSİ:",
    `- Başlık: ${input.title}`,
    `- Kategori: ${input.category ?? "bilinmiyor"}`,
    `- Satış fiyatı: $${input.salePriceUsd.toFixed(2)}`,
    `- AliExpress puanı: ${input.aliRating.toFixed(1)}/5 (${input.aliOrders} satış — talep kanıtı)`,
    `- Mağaza: ${input.shopDomain}`,
    "",
    "KURALLAR:",
    "- Reklam metinleri İNGİLİZCE (hedef pazar global), researchNotes TÜRKÇE.",
    "- primaryTexts: 2-3 farklı ton (ör. sorun-çözüm, sosyal kanıt, aciliyet). Emoji az ve yerinde.",
    "",
    "METİN DİLİ (300K başarılı reklam analizi — bu kurallara UY):",
    "- Cilalı/kurumsal reklam dili YASAK. Konuşma dili yaz — hafif kusurlu, doğal,",
    "  gerçek bir insan telefonuna yazıyormuş gibi ('ok so I wasn't expecting this...').",
    "- Metin ÜRÜNÜ DENEMİŞ birinin ağzından: satıcı değil, kullanıcı anlatır —",
    "  tecrübesini aktarır ya da o anı yaşıyormuş gibi sunar.",
    "- ASLA nötr giriş yapma: ilk cümle merak/duygu kancası — okuyan ne deneyim",
    "  bulacağını ilk saniyede hisseder.",
    "- Bağ kur: gülümset, ortak derde taş at ('we've all bought junk that broke in a week...'),",
    "  aynı ortamda olma hissi ver.",
    "- Şablon havası verme — metin bu ürüne ÖZEL el yazımı hissiyatında olmalı.",
    "",
    "- audienceSuggestions: Meta'da aratılabilecek somut ilgi alanları (İngilizce).",
    "- headline max 40 karakter, tıklama odaklı, abartısız (Meta reklam politikasına uygun:",
    "  'kesin sonuç' vaadi yok, sağlık iddiası yok).",
    "- dailyBudgetSuggestionUsd: yeni ürün testi için makul günlük bütçe (genelde 10-30).",
    "",
    "YALNIZ şu şemada saf JSON döndür (markdown yok, açıklama yok):",
    `{"researchNotes":{"productSummary":"...","targetAudience":"...","sellingAngle":"..."},`,
    `"campaignName":"...","headline":"...","primaryTexts":["...","..."],`,
    `"audienceSuggestions":["...","..."],"dailyBudgetSuggestionUsd":15}`,
  ].join("\n");
}

/** Model yanıtından JSON gövdesini çıkarır (kod bloğu sarmalına karşı dayanıklı). */
function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Yanıtta JSON bulunamadı");
  return text.slice(start, end + 1);
}

export async function generateCampaignDraft(input: ProductResearchInput): Promise<CampaignDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY tanımlı değil — AI kampanya taslağı yapılandırılmamış");

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(input);

  // 1 retry: ilk yanıt şemaya uymazsa bir kez daha dene (Radar'daki callAgentJson deseni)
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      });

      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      return DraftSchema.parse(JSON.parse(extractJson(text)));
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `Kampanya taslağı üretilemedi: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}
