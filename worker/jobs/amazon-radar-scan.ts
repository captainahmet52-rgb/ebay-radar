// AmazonBot radar worker — bir pazar için radarı çalıştırıp KAZANANLARI depoya yazar.
// Veri kaynağı şu an DEMO örnek adaylar; AliExpress Open Platform API bağlanınca
// SAMPLE_CANDIDATES yerine canlı çekilen adaylar verilecek (karar mantığı aynı kalır).
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { runRadar, buildRadarConfig } from "@/lib/amazon-radar";
import { SAMPLE_CANDIDATES } from "@/lib/amazon-radar-samples";
import { saveRadarWinnersToDepot } from "@/lib/amazon-depot";
import { AMAZON_MARKETS } from "@/lib/amazon-repricer";
import type { AmazonRadarScanJobData } from "@/lib/queues";

async function processAmazonRadarScan(job: Job<AmazonRadarScanJobData>): Promise<void> {
  const market = (job.data.market ?? "us").toLowerCase();

  if (!AMAZON_MARKETS[market]) {
    await job.log(`Geçersiz pazar: ${market} — atlanıyor`);
    return;
  }

  // 1. Adayları getir (şimdilik demo; AliExpress API gelince burası değişir)
  const candidates = SAMPLE_CANDIDATES;

  // 2. Pazar-bazlı radar (marj/KDV/gümrük/kur + marka/yasak SERT filtre)
  const config = buildRadarConfig(market);
  const results = runRadar(candidates, config);
  const passed = results.filter((r) => r.verdict.pass).length;

  await job.log(`${market.toUpperCase()} radar: ${results.length} aday, ${passed} kazanan`);

  // 3. Kazananları depoya yaz (marka-güvensiz/yasaklı ASLA girmez)
  const { saved, skipped } = await saveRadarWinnersToDepot(results);

  await job.log(`Depoya yazıldı: ${saved} ürün (elenen ${skipped})`);
}

export function createAmazonRadarScanWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<AmazonRadarScanJobData>(
    "amazon-radar-scan",
    processAmazonRadarScan,
    {
      connection,
      concurrency: 2,
      limiter: { max: 5, duration: 1000 },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[amazon-radar-scan] ✓ ${job.id} | market: ${job.data.market}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[amazon-radar-scan] ✗ ${job?.id} | ${err.message}`);
  });
  worker.on("error", (err) => console.error("[amazon-radar-scan] worker hatası:", err));

  return worker;
}
