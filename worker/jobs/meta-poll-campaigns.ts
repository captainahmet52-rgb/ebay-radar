// meta-poll-campaigns worker — MetaCampaign performans metriklerini senkronlar
// (harcama/gösterim/tıklama) ve gerekirse uzun ömürlü token'ı yeniler.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/crypto";
import { getCampaignInsights } from "@/lib/meta/campaigns";
import { refreshLongLivedToken } from "@/lib/meta/oauth";
import type { MetaPollCampaignsJobData } from "@/lib/queues";

// Token 60 gün geçerli — 10 güne kalınca yenile (freeze-amazon-accounts'taki
// erken-yenileme deseniyle aynı: hesap süresi dolmadan tazelenir)
const REFRESH_BEFORE_MS = 10 * 24 * 60 * 60 * 1000;

async function processMetaPollCampaigns(job: Job<MetaPollCampaignsJobData>): Promise<void> {
  const accounts = await prisma.metaAccount.findMany({
    select: { id: true, accessTokenEncrypted: true, tokenExpiresAt: true },
  });

  const tokenByAccount = new Map<string, string>();
  for (const account of accounts) {
    let token = decryptToken(account.accessTokenEncrypted);

    if (account.tokenExpiresAt.getTime() - Date.now() < REFRESH_BEFORE_MS) {
      try {
        const refreshed = await refreshLongLivedToken(token);
        await prisma.metaAccount.update({
          where: { id: account.id },
          data: { accessTokenEncrypted: encryptToken(refreshed.token), tokenExpiresAt: refreshed.expiresAt },
        });
        token = refreshed.token;
        job.log(`Token yenilendi: ${account.id}`);
      } catch (err) {
        job.log(`Token yenileme hatası (${account.id}): ${err instanceof Error ? err.message : err}`);
        // Yenileme başarısız olsa da mevcut token süresi dolana kadar denenmeye devam eder
      }
    }
    tokenByAccount.set(account.id, token);
  }

  const campaigns = await prisma.metaCampaign.findMany({
    where: { status: { in: ["ACTIVE", "PAUSED"] } },
    select: { id: true, metaAccountId: true, metaCampaignId: true },
  });

  let failed = 0;
  for (const c of campaigns) {
    const token = tokenByAccount.get(c.metaAccountId);
    if (!token) continue;
    try {
      const insights = await getCampaignInsights(c.metaCampaignId, token);
      await prisma.metaCampaign.update({
        where: { id: c.id },
        data: {
          spendUsd: insights.spendUsd,
          impressions: insights.impressions,
          clicks: insights.clicks,
          lastSyncAt: new Date(),
          lastError: null,
        },
      });
    } catch (err) {
      failed += 1;
      const errMsg = err instanceof Error ? err.message : String(err);
      await prisma.metaCampaign
        .update({ where: { id: c.id }, data: { lastError: errMsg, lastSyncAt: new Date() } })
        .catch(() => {});
    }
  }

  job.log(`${campaigns.length} kampanya senkronlandı, ${failed} hata`);
}

export function createMetaPollCampaignsWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<MetaPollCampaignsJobData>(
    "meta-poll-campaigns",
    processMetaPollCampaigns,
    { connection, concurrency: 1 }
  );

  worker.on("completed", (job) => console.log(`[meta-poll-campaigns] ✓ ${job.id}`));
  worker.on("failed", (job, err) => console.error(`[meta-poll-campaigns] ✗ ${job?.id} | ${err.message}`));
  worker.on("error", (err) => console.error("[meta-poll-campaigns] worker hatası:", err));

  return worker;
}
