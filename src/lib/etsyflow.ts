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
 * Supabase Auth (auth.users) içinde e-postaya göre kullanıcı id'si bulur.
 * profiles tablosu güvenilir değilse (email boş olabilir) bu kullanılır.
 */
async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const db = etsyflowAdmin();
  const target = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) break;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found.id;
    if (data.users.length < perPage) break;
  }
  return null;
}

/** id + email ile profiles satırını garanti altına alır (yoksa oluşturur/günceller). */
async function ensureProfile(id: string, email: string, fullName?: string | null): Promise<void> {
  const db = etsyflowAdmin();
  await db.from("profiles").upsert(
    { id, email, full_name: fullName ?? null },
    { onConflict: "id" }
  );
}

/**
 * Lean Automation kullanıcısını EtsyFlow'a eşler; yoksa OTOMATİK oluşturur.
 * Yani Lean Automation'da hesabı olan biri Etsy'e girince EtsyFlow Supabase'inde
 * profili kendiliğinden açılır/eşlenir (tek kayıt, tek giriş).
 */
export async function getOrCreateEtsyProfileId(
  email: string,
  fullName?: string | null
): Promise<string> {
  // 1) profiles tablosunda e-posta ile ara
  const byProfile = await resolveEtsyProfileId(email);
  if (byProfile) return byProfile;

  // 2) auth.users içinde zaten var mı? (varsa ona bağlan, profili garantile)
  const existingAuthId = await findAuthUserIdByEmail(email);
  if (existingAuthId) {
    await ensureProfile(existingAuthId, email, fullName);
    return existingAuthId;
  }

  // 3) Hiç yoksa yeni auth kullanıcısı oluştur
  const db = etsyflowAdmin();
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });

  if (error) {
    // Yarış durumu: oluşturma sırasında biri eklediyse tekrar bul
    const retryId = await findAuthUserIdByEmail(email);
    if (retryId) {
      await ensureProfile(retryId, email, fullName);
      return retryId;
    }
    throw new Error(`EtsyFlow hesabı oluşturulamadı: ${error.message}`);
  }

  const id = created.user?.id;
  if (!id) throw new Error("EtsyFlow kullanıcı id'si alınamadı");

  await ensureProfile(id, email, fullName);
  return id;
}
