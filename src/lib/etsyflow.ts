import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * EtsyFlow köprüsü — Lean Automation'ın sunucu tarafı (BFF), EtsyFlow'un
 * Supabase veritabanına servis anahtarıyla erişir. Etsy otomasyonu EtsyFlow'da
 * çalışmaya devam eder; biz sadece veriyi okur/yazarız.
 *
 * GÜVENLİK: Servis anahtarı RLS'i bypass eder → SADECE sunucu tarafında kullan,
 * asla NEXT_PUBLIC_ ile client'a sızdırma. Her sorgu mutlaka kullanıcıya
 * (user_id) göre filtrelenir.
 */

const SUPABASE_URL = process.env.ETSYFLOW_SUPABASE_URL;
const SERVICE_KEY = process.env.ETSYFLOW_SUPABASE_SERVICE_KEY;

let client: SupabaseClient | null = null;

export function isEtsyflowConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

/** EtsyFlow Supabase admin istemcisi (servis anahtarı). Sadece sunucu. */
export function etsyflowAdmin(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "EtsyFlow yapılandırılmadı: ETSYFLOW_SUPABASE_URL / ETSYFLOW_SUPABASE_SERVICE_KEY eksik"
    );
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/**
 * Lean Automation kullanıcısının e-postasını EtsyFlow profil id'sine eşler.
 * Eşleşme yoksa null döner (kullanıcının EtsyFlow hesabı yok demektir).
 */
export async function resolveEtsyProfileId(email: string): Promise<string | null> {
  const db = etsyflowAdmin();
  const { data, error } = await db
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

/**
 * Lean Automation kullanıcısını EtsyFlow'a eşler; yoksa OTOMATİK oluşturur.
 * Yani Lean Automation'da hesabı olan biri Etsy'e girince EtsyFlow Supabase'inde
 * de profili kendiliğinden açılır (tek kayıt, tek giriş).
 */
export async function getOrCreateEtsyProfileId(
  email: string,
  fullName?: string | null
): Promise<string> {
  const existing = await resolveEtsyProfileId(email);
  if (existing) return existing;

  const db = etsyflowAdmin();

  // Supabase auth kullanıcısı oluştur — profiles satırı trigger ile oluşur.
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });

  if (error) {
    // Auth kullanıcısı zaten varsa profili tekrar çözmeyi dene
    const retry = await resolveEtsyProfileId(email);
    if (retry) return retry;
    throw new Error(`EtsyFlow hesabı oluşturulamadı: ${error.message}`);
  }

  const id = created.user?.id;
  if (!id) throw new Error("EtsyFlow kullanıcı id'si alınamadı");

  // Trigger profili oluşturmadıysa garanti altına al
  await db.from("profiles").upsert(
    { id, email, full_name: fullName ?? null },
    { onConflict: "id" }
  );

  return id;
}
