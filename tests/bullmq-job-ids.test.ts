import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

// BullMQ 5.x, ":" içeren özel jobId'leri ("Custom Id cannot contain :") reddeder
// (yalnız tam 3 parçalı eski repeat formatına izin verir). Bu hata canlıda
// dispatch-polls ve dispatch-poll-orders'ı her turda düşürüp eBay stok/sipariş
// takibini tamamen durdurdu. Bu test kaynakta ":"li jobId kalmamasını garanti eder.

const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["src", "worker"];
const JOB_ID_TEMPLATE = /jobId:\s*`([^`]*)`/g;

function listTsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : listTsFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("BullMQ jobId formatı", () => {
  it("hiçbir jobId şablonu ':' içermez", () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of listTsFiles(join(ROOT, dir))) {
        const src = readFileSync(file, "utf8");
        for (const m of src.matchAll(JOB_ID_TEMPLATE)) {
          const literal = m[1].replace(/\$\{[^}]*\}/g, "");
          if (literal.includes(":")) offenders.push(`${relative(ROOT, file)}: ${m[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
