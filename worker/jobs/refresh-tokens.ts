// refresh-tokens worker — aktif EbayAccount'ların access token'larını
// süresi dolmadan önce toplu yeniler.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/crypto";
import { refreshAccessToken } from "@/lib/ebay/oauth";
import type { RefreshTokensJobData } from "@/lib/queues";

// Token'ı bitmeden 30 dk önce yenile
const REFRESH_WINDOW_MS = 30 * 60 * 1000;
// Refresh token'ın ömrü 7 günden azsa kullanıcı yeniden OAuth yapmalı
const REFRESH_TOKEN_WARN_MS = 7 * 24 * 60 * 60 * 1000;

async function processRefreshTokens(
  job: Job<RefreshTokensJobData>
): Promise<void> {
  const { ebayAccountId } = job.data;
  const now = Date.now();

  // Hedef hesapları belirle
  const accounts = ebayAccountId
    ? await prisma.ebayAccount.findMany({ where: { id: ebayAccountId } })
    : await prisma.ebayAccount.findMany({
        where: {
          refreshTokenEncrypted: { not: null },
          OR: [
            { tokenExpiresAt: null },
            { tokenExpiresAt: { lt: new Date(now + REFRESH_WINDOW_MS) } },
          ],
        },
      });

  if (accounts.length === 0) {
    await job.log("Yenilenecek hesap yok.");
    return;
  }

  let successCount = 0;
  let failCount = 0;

  // Hepsini bir seferde işle — biri patlarsa diğerlerine devam et
  for (const account of accounts) {
    try {
      if (!account.refreshTokenEncrypted) {
        // ebayAccountId ile çağrıldıysa bu hesapta refresh token olmayabilir
        console.warn(
          `[refresh-tokens] Refresh token yok, atlanıyor: account=${account.id}`
        );
        failCount++;
        continue;
      }

      const refreshed = await refreshAccessToken(account.refreshTokenEncrypted);

      await prisma.ebayAccount.update({
        where: { id: account.id },
        data: {
          oauthTokenEncrypted: encryptToken(refreshed.accessToken),
          tokenExpiresAt: refreshed.expiresAt,
          // eBay rotating refresh token döndürdüyse onu da güncelle
          ...(refreshed.refreshToken
            ? { refreshTokenEncrypted: encryptToken(refreshed.refreshToken) }
            : {}),
        },
      });

      // Refresh token süresi yaklaşıyorsa uyar — kullanıcı yeniden OAuth yapmalı
      if (
        account.refreshTokenExpiresAt !== null &&
        account.refreshTokenExpiresAt.getTime() < now + REFRESH_TOKEN_WARN_MS
      ) {
        console.warn(
          `[refresh-tokens] Refresh token 7 günden az kaldı — kullanıcı yeniden OAuth yapmalı: ` +
            `account=${account.id} user=${account.userId} expires=${account.refreshTokenExpiresAt.toISOString()}`
        );
      }

      successCount++;
      await job.log(`Yenilendi: account=${account.id}`);
    } catch (err) {
      // Tek hesabın hatası diğerlerini durdurmaz — token/secret loglanmaz
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `[refresh-tokens] Hesap yenileme hatası: account=${account.id} | ${errMsg}`
      );
      failCount++;
    }
  }

  await job.log(
    `Tamamlandı: ${accounts.length} hesap | başarılı=${successCount} | başarısız=${failCount}`
  );
}

export function createRefreshTokensWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<RefreshTokensJobData>(
    "refresh-tokens",
    processRefreshTokens,
    { connection, concurrency: 2 }
  );

  worker.on("completed", (job) => {
    console.log(`[refresh-tokens] ✓ Job tamamlandı: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[refresh-tokens] ✗ Job başarısız: ${job?.id} | ${err.message}`);
  });

  worker.on("error", (err) => {
    console.error("[refresh-tokens] Worker hatası:", err);
  });

  return worker;
}
