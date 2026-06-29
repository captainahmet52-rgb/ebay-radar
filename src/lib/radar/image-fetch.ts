// Görsel indir + decode → gri-tonlama matris. JPEG (jpeg-js) + PNG (pngjs).
//
// HER hata null döner (decode edilemeyen format/webp, ağ hatası, çok büyük dosya):
// görsel kanıt kullanılamaz → sistem metin-only kanıta düşer (güvenli). ASLA throw etmez.

import { decode as decodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";
import type { Grayscale } from "@/lib/radar/image-hash";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB üst sınır
const FETCH_TIMEOUT_MS = 8000;

function toGray(rgba: Uint8Array, width: number, height: number): Grayscale {
  const data = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    // luma: 0.299R + 0.587G + 0.114B
    data[i] = (rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000 | 0;
  }
  return { width, height, data };
}

function decodeBytes(buf: Buffer): Grayscale | null {
  // Format imzası (magic bytes)
  const isJpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng =
    buf.length > 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;

  try {
    if (isJpeg) {
      const { data, width, height } = decodeJpeg(buf, { useTArray: true, maxResolutionInMP: 50 });
      return toGray(data as unknown as Uint8Array, width, height);
    }
    if (isPng) {
      const png = PNG.sync.read(buf);
      return toGray(Uint8Array.from(png.data), png.width, png.height);
    }
  } catch {
    return null; // bozuk/desteklenmeyen → görsel kanıt yok
  }
  return null; // webp/gif/diğer → desteklenmiyor
}

/** URL'den görsel indirip gri-tonlamaya çevirir. Başarısızsa null (asla throw etmez). */
export async function loadGrayscaleFromUrl(url: string): Promise<Grayscale | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const len = res.headers.get("content-length");
    if (len && parseInt(len, 10) > MAX_BYTES) return null;
    const arr = await res.arrayBuffer();
    if (arr.byteLength > MAX_BYTES) return null;
    return decodeBytes(Buffer.from(arr));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
