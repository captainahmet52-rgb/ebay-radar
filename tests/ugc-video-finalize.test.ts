import { describe, it, expect, vi, beforeEach } from "vitest";

// fal: kuyruk durumu + sonuç taklidi. ApiError gerçek sınıfın şekliyle (status alanı).
const falState = { status: "COMPLETED" as string, result: null as unknown, resultError: null as unknown };

vi.mock("@fal-ai/client", () => {
  class ApiError extends Error {
    constructor(public readonly status: number) {
      super(`fal ${status}`);
    }
  }
  return {
    ApiError,
    fal: {
      config: vi.fn(),
      queue: {
        status: vi.fn(async () => ({ status: falState.status })),
        result: vi.fn(async () => {
          if (falState.resultError) throw falState.resultError;
          return falState.result;
        }),
      },
    },
  };
});

// prisma: kredi iadesi ve iş güncellemesi kaydedilir.
const refunds: string[] = [];
const patches: { id: string; data: Record<string, unknown> }[] = [];
let refundedFlag = false;

vi.mock("@/lib/prisma", () => {
  const tx = {
    ugcVideoJob: {
      updateMany: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (refundedFlag) return { count: 0 };
        refundedFlag = true;
        refunds.push(where.id);
        return { count: 1 };
      }),
      findUnique: vi.fn(async () => ({ userId: "u1", priceUsd: 6 })),
    },
    user: { update: vi.fn(async () => ({})) },
    creditTransaction: { create: vi.fn(async () => ({})) },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
      ugcVideoJob: {
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          patches.push({ id: where.id, data });
          return {};
        }),
      },
    },
  };
});

vi.mock("@/lib/ugc-video/speech", () => ({ generateUgcSpeech: vi.fn() }));
vi.mock("@/lib/ugc-video/elevenlabs", () => ({ textToSpeech: vi.fn() }));

process.env.FAL_KEY = "test";

const { ApiError } = await import("@fal-ai/client");
const { finalizeUgcVideo } = await import("@/lib/ugc-video/pipeline");

function job(minutesAgo = 5) {
  return {
    id: "job1",
    status: "processing",
    step: "Video işleniyor",
    quality: "standard",
    seconds: 10,
    spokenText: null,
    videoUrl: null,
    error: null,
    falRequestId: "req1",
    createdAt: new Date(Date.now() - minutesAgo * 60_000),
  };
}

describe("finalizeUgcVideo", () => {
  beforeEach(() => {
    refunds.length = 0;
    patches.length = 0;
    refundedFlag = false;
    falState.status = "COMPLETED";
    falState.result = null;
    falState.resultError = null;
  });

  it("başarılı video tamamlandı olarak kaydedilir, iade yapılmaz", async () => {
    falState.result = { data: { video: { url: "https://v/x.mp4" } } };
    const out = await finalizeUgcVideo(job());
    expect(out.status).toBe("completed");
    expect(out.videoUrl).toBe("https://v/x.mp4");
    expect(refunds).toEqual([]);
  });

  it("fal kalıcı hata (4xx) verirse iş başarısız olur ve kredi iade edilir", async () => {
    falState.resultError = new (ApiError as unknown as new (s: number) => Error)(422);
    const out = await finalizeUgcVideo(job());
    expect(out.status).toBe("failed");
    expect(refunds).toEqual(["job1"]);
  });

  it("tamamlandı ama video adresi yoksa başarısız sayılır ve iade edilir", async () => {
    falState.result = { data: {} };
    const out = await finalizeUgcVideo(job());
    expect(out.status).toBe("failed");
    expect(refunds).toEqual(["job1"]);
  });

  it("geçici hata (5xx) iş yeniyse işi bekletir, iade etmez", async () => {
    falState.resultError = new (ApiError as unknown as new (s: number) => Error)(503);
    const out = await finalizeUgcVideo(job(5));
    expect(out.status).toBe("processing");
    expect(refunds).toEqual([]);
  });

  it("fal anahtar/bakiye hatası (401/402/403) işi başarısız saymaz, iade etmez", async () => {
    for (const status of [401, 402, 403]) {
      refunds.length = 0;
      falState.resultError = new (ApiError as unknown as new (s: number) => Error)(status);
      const out = await finalizeUgcVideo(job(5));
      expect(out.status).toBe("processing");
      expect(refunds).toEqual([]);
    }
  });

  it("45 dakikayı geçen takılı iş başarısız sayılır ve kredi iade edilir", async () => {
    falState.status = "IN_PROGRESS";
    const out = await finalizeUgcVideo(job(46));
    expect(out.status).toBe("failed");
    expect(refunds).toEqual(["job1"]);
  });

  it("kuyrukta bekleyen yeni iş dokunulmadan kalır", async () => {
    falState.status = "IN_QUEUE";
    const out = await finalizeUgcVideo(job(2));
    expect(out.status).toBe("processing");
    expect(patches).toEqual([]);
  });
});
