// UGC video konuşma metni — Lumina AI'daki görüntülü (vision) Haiku adımının portu.
// Fark: metin İNGİLİZCE (global Meta/TikTok reklamı) ve 300K-data stüdyo kuralları
// (hafıza: ugc-metin-kurallari-300k-data) prompt'a işlenmiş durumda.
// Karakter + ürün görselini GÖRÜR: cinsiyet tespiti (doğru ses için) + sahne
// talimatı (ürün karaktere nasıl uygulanacak) + konuşma metni tek çağrıda.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5";

async function imageToBase64(url: string): Promise<{ data: string; mime: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Görsel indirilemedi (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    data: buf.toString("base64"),
    mime: res.headers.get("content-type") || "image/jpeg",
  };
}

/** İstenen video süresine göre yaklaşık kelime sayısı (~2.3 kelime/sn EN). */
function wordTarget(seconds: number): number {
  return Math.round(seconds * 2.3);
}

export interface SpeechInput {
  characterImageUrl: string;
  productImageUrl: string;
  productName: string;
  seconds: number;
}

export interface SpeechResult {
  /** Karakterin görünen cinsiyeti — ses seçimi için. */
  gender: "male" | "female";
  /** Karakterin söyleyeceği İNGİLİZCE metin (ElevenLabs v3 etiketleri dahil). */
  text: string;
  /** Görüntü düzenleme modeli için İngilizce sahne talimatı. */
  scene: string;
}

const SUPPORTED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function generateUgcSpeech(input: SpeechInput): Promise<SpeechResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY eksik.");

  const [character, product] = await Promise.all([
    imageToBase64(input.characterImageUrl),
    imageToBase64(input.productImageUrl),
  ]);

  const words = wordTarget(input.seconds);

  const instruction = `Görsel 1 = videoda konuşacak KARAKTER. Görsel 2 = tanıtılacak ÜRÜN.
ÜRÜN ADI: ${input.productName}

GÖREV: Bu karakterin telefon kamerasına konuşurken söyleyeceği İNGİLİZCE metni yaz.
Bu bir reklam DEĞİL — ürünü DENEMİŞ gerçek bir insanın arkadaşlarına anlattığı video.

300K BAŞARILI VİDEO ANALİZİ KURALLARI (hepsine uy):
- KUSURLU konuşma dili: "ok so", "like", "honestly", "I don't know", "wait" gibi dolgu
  ifadeleri DOĞAL yerlerde (her cümlede değil). Yarım cümle + kendini düzeltme serbest:
  "I've been using it for two weeks... no wait, three actually"
- İLK CÜMLE ASLA NÖTR DEĞİL: merak/duygu kancası — izleyen ilk saniyede ne deneyim
  bulacağını hisseder ("ok I genuinely didn't expect this to work...")
- Kişisel mini hikâye: nereden duydu, ilk şüphesi, ne değişti (0'dan olma süreci)
- Kusur/şüphe ekle, %100 övgü YAPMA: "I wasn't sure at first", "it's not perfect but"
- Bağ kur: gülümset, ortak derde taş at ("we've all bought junk that broke in a week")

KESİNLİKLE YASAK (yapay zekâ/reklam kokan ifadeler):
- "highly recommend", "life-changing", "game-changer", "revolutionary", "must-have"
- "amazing", "incredible", "perfect", "don't miss out"
- Ürün özelliklerini liste gibi saymak; kusursuz kurulmuş uzun cümleler
- Sağlık iddiası / kesin sonuç vaadi (Meta reklam politikası)

SES ETİKETLERİ (ElevenLabs v3): en fazla 2-3 tane, doğal anlarda: [laughs], [sighs],
[exhales]. Örnek: "I was like no way [laughs] but it actually works."

UZUNLUK: yaklaşık ${words} kelime (~${input.seconds} saniyelik doğal konuşma).

ÇIKTI FORMATI — tam olarak şöyle, kod bloğu/açıklama YOK:
1. satır → GENDER: male  (veya  GENDER: female — Görsel 1'deki karakterin görünen cinsiyeti)
2. satır → SCENE: <İNGİLİZCE tek satır görüntü düzenleme talimatı: Görsel 2'deki ürün
Görsel 1'deki karaktere GÖRSEL olarak nasıl uygulanmalı? Giyilebilirse karakter onu
GİYMİŞ/TAKMIŞ; elde tutulursa kameraya gösterir şekilde ELİNDE. Yüz kimliği ve arka
plan korunur. Örn: "The woman from image 1 holding the small white device from image 2
up to the camera, keep her face identity and background unchanged, realistic photo">
Sonraki satırlar → sadece söylenecek İngilizce konuşma metni.`;

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: (SUPPORTED_MIME.has(character.mime) ? character.mime : "image/jpeg") as
                | "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: character.data,
            },
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: (SUPPORTED_MIME.has(product.mime) ? product.mime : "image/jpeg") as
                | "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: product.data,
            },
          },
          { type: "text", text: instruction },
        ],
      },
    ],
  });

  const raw = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return parseSpeechResult(raw);
}

/** Claude çıktısını ayıklar; format bozulsa bile konuşma metnini kurtarır. */
function parseSpeechResult(raw: string): SpeechResult {
  let cleaned = raw.replace(/```[a-z]*\n?/gi, "").trim();

  let gender: SpeechResult["gender"] = "female";
  const genderMatch = cleaned.match(
    /^\s*(?:GENDER|CINSIYET|CİNSİYET)\s*[:=]\s*(male|female|erkek|kadin|kadın)\s*/im
  );
  if (genderMatch) {
    const g = genderMatch[1].toLowerCase();
    gender = g === "male" || g === "erkek" ? "male" : "female";
    cleaned = cleaned.replace(genderMatch[0], "").trim();
  }

  let scene = "";
  const sceneMatch = cleaned.match(/^\s*(?:SCENE|SAHNE)\s*[:=]\s*(.+)\s*$/im);
  if (sceneMatch) {
    scene = sceneMatch[1].trim();
    cleaned = cleaned.replace(sceneMatch[0], "").trim();
  }

  if (!cleaned) throw new Error("Claude boş metin döndürdü.");
  return { gender, text: cleaned, scene };
}
