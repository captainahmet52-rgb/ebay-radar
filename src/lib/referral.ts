/**
 * Referans (davet) sistemi kuralları.
 *
 * "Arkadaşını davet et, ikiniz de +7 gün bedava." Davet edilen kayıt olunca
 * hem davet eden hem yeni kullanıcı referralRewardDays kazanır. Bu günler,
 * kullanıcı bir mağaza bağladığında o mağazanın ücretsiz denemesine eklenir.
 */

import { prisma } from "@/lib/prisma";

/** Başarılı her davet için iki tarafa da verilen bonus gün. */
export const REFERRAL_REWARD_DAYS = 7;

/** Tek bir mağaza denemesine eklenebilecek azami bonus gün (kötüye kullanım freni). */
export const REFERRAL_MAX_BONUS_PER_STORE = 30;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // karışan harfler (0/O, 1/I) yok

function randomCode(len = 8): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Kullanıcının referans kodunu döndürür; yoksa benzersiz bir tane üretip kaydeder.
 * Çakışma olursa birkaç kez yeniden dener.
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (existing?.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch {
      // unique çakışması — tekrar dene
    }
  }
  // Son çare: userId tabanlı (çok düşük çakışma)
  const fallback = randomCode(10);
  await prisma.user.update({ where: { id: userId }, data: { referralCode: fallback } });
  return fallback;
}
