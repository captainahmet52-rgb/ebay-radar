// ElevenLabs — metin → ses (Lumina AI'dan port; burada dil İNGİLİZCE:
// Shopify kanalının reklamları global Meta/TikTok pazarına gider).
// Model eleven_v3: [laughs], [sighs] gibi etiketleri gerçek insan tepkisine çevirir.

const DEFAULT_MODEL = "eleven_v3";

// Cinsiyete göre varsayılan sesler (env ile ezilebilir) — hesapta hazır gelen sesler.
const DEFAULT_VOICES = {
  female: "EXAVITQu4vr4xnSDxMaL", // Sarah
  male: "pNInz6obpgDQGcFmaJgB", // Adam
} as const;

export type VoiceGender = keyof typeof DEFAULT_VOICES;

function pickVoice(gender: VoiceGender): string {
  const forced = process.env.ELEVENLABS_VOICE_ID;
  if (forced) return forced;
  if (gender === "male") {
    return process.env.ELEVENLABS_VOICE_ID_MALE || DEFAULT_VOICES.male;
  }
  return process.env.ELEVENLABS_VOICE_ID_FEMALE || DEFAULT_VOICES.female;
}

export async function textToSpeech(
  text: string,
  gender: VoiceGender = "female"
): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY eksik.");

  const voiceId = pickVoice(gender);
  const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL;

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        // v3'te stability yalnızca 0.0 / 0.5 / 1.0 kabul eder; 0.5 = "Natural".
        voice_settings: { stability: 0.5 },
      }),
      signal: AbortSignal.timeout(120_000),
    }
  );

  if (!res.ok) {
    throw new Error(`ElevenLabs hatası (${res.status}): ${await res.text()}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
