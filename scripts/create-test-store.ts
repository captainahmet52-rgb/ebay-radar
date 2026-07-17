#!/usr/bin/env npx tsx
/**
 * eBay Otomasyon SaaS — Ödeme Testi İçin Sahte Mağaza Oluşturucu
 *
 * Paket/aktivasyon akışını test etmek için gerçek bir eBay
 * hesabına/OAuth token'ına ihtiyaç YOKTUR — EbayAccount şemasında token
 * alanları opsiyoneldir. Bu script SADECE test amaçlıdır; token'sız,
 * isActive:false başlayan bir kayıt oluşturur (otomasyon tetiklenmez).
 *
 * Kullanım:
 *   npx tsx scripts/create-test-store.ts kullanici@email.com
 *
 * Test bitince mağazayı Prisma Studio'dan (npx prisma studio) ya da
 * dashboard'daki "Sil" butonuyla kaldırabilirsin.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Kullanım: npx tsx scripts/create-test-store.ts kullanici@email.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Kullanıcı bulunamadı: ${email}`);
    process.exit(1);
  }

  const account = await prisma.ebayAccount.create({
    data: {
      userId: user.id,
      ebayUserId: `test-store-${Date.now()}`,
      marketplace: "EBAY_US",
      // isActive: false (varsayılan) — ödeme testinde webhook bunu aktive edecek.
    },
  });

  console.log("\n✅ Test mağazası oluşturuldu:");
  console.log(`   id: ${account.id}`);
  console.log(`   kullanıcı: ${email}`);
  console.log("\nDashboard → Mağazalarım'da görünecek. 'Paket Al' ile ödeme testine devam et.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
