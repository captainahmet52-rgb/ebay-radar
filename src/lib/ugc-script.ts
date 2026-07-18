// UGC video SENARYO üretici — sahibin 300K-data stüdyo kurallarına göre yazar
// (hafıza: ugc-metin-kurallari-300k-data). Video RENDER motoru ayrı aşama;
// bu modül çekilebilir/seslendirilebilir hazır senaryo üretir.
//
// campaign-draft ile aynı desen: İKİ AŞAMALI tek istek (önce araştırma, sonra
// senaryo), model claude-haiku-4-5 (sahibin maliyet-öncelikli kararı), saf JSON
// + Zod doğrulama, 1 retry.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 2500;

export function isUgcScriptConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface UgcScriptInput {
  title: string;
  category: string | null;
  salePriceUsd: number;
  aliRating: number;
  aliOrders: number;
}

const SceneSchema = z.object({
  label: z.string().min(2), // TÜRKÇE sahne etiketi (çekim rehberi)
  voiceover: z.string().min(10), // İNGİLİZCE konuşma metni
  broll: z.string().min(5), // TÜRKÇE görüntü önerisi
  // 300K kural 10: video asla aynı tempoda ilerlemez
  tempo: z.enum(["hızlı", "sakin", "yükselen"]),
});

const UgcScriptSchema = z.object({
  // Aşama 1 — araştırma (kullanıcıya "AI ürünü böyle okudu" olarak gösterilir)
  researchNotes: z.object({
    productSummary: z.string().min(10),
    targetAudience: z.string().min(10),
    sellingAngle: z.string().min(10),
  }),
  // Aşama 2 — senaryo
  hooks: z.array(z.string().min(10)).min(3).max(5),
  scenes: z.array(SceneSchema).min(4).max(7),
  caption: z.string().min(10),
  hashtags: z.array(z.string().min(2)).min(5).max(10),
  durationSeconds: z.number().min(15).max(60),
});

export type UgcScript = z.infer<typeof UgcScriptSchema>;

function buildPrompt(input: UgcScriptInput): string {
  return [
    "Sen UGC (kullanıcı üretimi içerik) reklam videoları yazan bir senaristsin.",
    "Aşağıdaki dropshipping ürünü için telefonla çekilecek KISA UGC reklam videosu",
    "senaryosu yazacaksın (Meta/TikTok reklamı).",
    "",
    "ÖNCE ürünü araştır/analiz et (researchNotes, TÜRKÇE): ne işe yarar, kim alır,",
    "en güçlü satış açısı ne? SONRA o analize göre senaryoyu yaz.",
    "",
    "ÜRÜN VERİSİ:",
    `- Başlık: ${input.title}`,
    `- Kategori: ${input.category ?? "bilinmiyor"}`,
    `- Satış fiyatı: $${input.salePriceUsd.toFixed(2)}`,
    `- AliExpress puanı: ${input.aliRating.toFixed(1)}/5 (${input.aliOrders} satış — talep kanıtı)`,
    "",
    "SENARYO KURALLARI (300.000 başarılı video analizinden — HEPSİNE UY):",
    "- voiceover İNGİLİZCE, KUSURLU konuşma dili: gerçek bir insan telefonuna",
    "  çekiyormuş gibi ('ok so I didn't think this would work but...'). Cilalı",
    "  reklam/stüdyo dili YASAK; mükemmel gramer şart değil.",
    "- Anlatıcı ÜRÜNÜ DENEMİŞ KULLANICI: tecrübesini aktarır ya da o anı",
    "  yaşarken çeker — satıcı gibi değil.",
    "- hooks: 3-5 alternatif AÇILIŞ cümlesi. ASLA nötr olmasın — ilk saniyede",
    "  izleyen ne deneyim bulacağını hisseder. Kusurlu-doğal, ürüne ÖZEL el",
    "  yazımı hissi (şablon havası = çöp).",
    "- Bağ kur: gülümset, ortak derde taş at ('we've all bought junk that broke",
    "  in a week'), izleyenle aynı ortamda olma hissi ver.",
    "- 0'DAN OLMA SÜRECİ göster: kutu açılışı / kurulum / ilk kullanım /",
    "  önce-sonra dönüşümü sahnelerde mutlaka olsun.",
    "- TEMPO DEĞİŞKEN: sahneler aynı hızda akmaz — tempo alanıyla hızlı/sakin/",
    "  yükselen dalgalanma kur.",
    "- Kanıtlanmış UGC formatını bu ürüne UYARLA (remaster) — deneysel konsept değil.",
    "- Sahne sayısı 4-7; her sahnede: label (TÜRKÇE kısa çekim etiketi),",
    "  voiceover (EN konuşma), broll (TÜRKÇE görüntü önerisi), tempo.",
    "- caption: reklam metni (EN, aynı kusurlu-doğal dil). hashtags: EN, # ile.",
    "- durationSeconds: toplam hedef süre (15-60 sn, genelde 20-35 ideal).",
    "- Abartılı vaat / sağlık iddiası YOK (Meta reklam politikası).",
    "",
    "YALNIZ şu şemada saf JSON döndür (markdown yok, açıklama yok):",
    `{"researchNotes":{"productSummary":"...","targetAudience":"...","sellingAngle":"..."},`,
    `"hooks":["...","...","..."],`,
    `"scenes":[{"label":"...","voiceover":"...","broll":"...","tempo":"hızlı"}],`,
    `"caption":"...","hashtags":["#...","#..."],"durationSeconds":30}`,
  ].join("\n");
}

/** Model yanıtından JSON gövdesini çıkarır (kod bloğu sarmalına dayanıklı). */
function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Yanıtta JSON bulunamadı");
  return text.slice(start, end + 1);
}

export async function generateUgcScript(input: UgcScriptInput): Promise<UgcScript> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY tanımlı değil — UGC senaryo üretici yapılandırılmamış");

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(input);

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

      return UgcScriptSchema.parse(JSON.parse(extractJson(text)));
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `UGC senaryosu üretilemedi: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}
