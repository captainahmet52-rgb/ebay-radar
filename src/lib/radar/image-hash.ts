// Algısal görsel hash — pHash (DCT) + dHash (difference). SAF matematik, BAĞIMSIZ.
//
// Amaç: eBay ilanının görseli ile Amazon adayının görseli "aynı ürün mü?".
// pHash sıkıştırma/yeniden boyutlandırmaya dayanıklı; dHash gradyan yapısını yakalar.
// İkisi birlikte (her ikisi de küçük hamming) → güçlü "aynı görsel" kanıtı.
//
// Bu dosya görsel DECODE etmez (o image-fetch.ts'te); yalnız gri-tonlama matris alır.

/** Tek kanal gri-tonlama görüntü (0..255). */
export interface Grayscale {
  width: number;
  height: number;
  data: Uint8Array; // length = width*height, row-major
}

/** Alan-ortalamalı küçültme — hash kalitesi için nearest'tan iyi, deterministik. */
export function resizeGray(img: Grayscale, tw: number, th: number): Grayscale {
  const out = new Uint8Array(tw * th);
  const { width: sw, height: sh, data } = img;
  for (let ty = 0; ty < th; ty++) {
    const sy0 = Math.floor((ty * sh) / th);
    const sy1 = Math.max(sy0 + 1, Math.floor(((ty + 1) * sh) / th));
    for (let tx = 0; tx < tw; tx++) {
      const sx0 = Math.floor((tx * sw) / tw);
      const sx1 = Math.max(sx0 + 1, Math.floor(((tx + 1) * sw) / tw));
      let sum = 0;
      let count = 0;
      for (let sy = sy0; sy < sy1 && sy < sh; sy++) {
        const row = sy * sw;
        for (let sx = sx0; sx < sx1 && sx < sw; sx++) {
          sum += data[row + sx];
          count++;
        }
      }
      out[ty * tw + tx] = count > 0 ? Math.round(sum / count) : 0;
    }
  }
  return { width: tw, height: th, data: out };
}

// 64-bit hash → iki 32-bit yarım (BigInt yok; her TS hedefinde çalışır).
export interface Hash64 {
  hi: number; // üst 32 bit (unsigned)
  lo: number; // alt 32 bit (unsigned)
}

// 64 bitlik diziyi (MSB-first) iki 32-bit yarıma paketle.
function packBits(bits: number[]): Hash64 {
  let hi = 0;
  let lo = 0;
  for (let i = 0; i < 32; i++) hi = ((hi << 1) | (bits[i] & 1)) >>> 0;
  for (let i = 32; i < 64; i++) lo = ((lo << 1) | (bits[i] & 1)) >>> 0;
  return { hi, lo };
}

/** 64-bit dHash: 9x8'e küçült, her satırda komşu farkları → 64 bit. */
export function dHash(img: Grayscale): Hash64 {
  const r = resizeGray(img, 9, 8);
  const bits: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = r.data[y * 9 + x];
      const right = r.data[y * 9 + x + 1];
      bits.push(left > right ? 1 : 0);
    }
  }
  return packBits(bits);
}

// 1D DCT-II baz matrisi önbelleği (N=32)
const dctCache = new Map<number, number[][]>();
function dctBasis(n: number): number[][] {
  const cached = dctCache.get(n);
  if (cached) return cached;
  const basis: number[][] = [];
  for (let u = 0; u < n; u++) {
    const row: number[] = [];
    const cu = u === 0 ? Math.SQRT1_2 : 1;
    for (let x = 0; x < n; x++) {
      row.push(cu * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * n)));
    }
    basis.push(row);
  }
  dctCache.set(n, basis);
  return basis;
}

/** 64-bit pHash: 32x32 gri → 2B DCT → sol-üst 8x8 (DC hariç) medyan eşiği → 64 bit. */
export function pHash(img: Grayscale): Hash64 {
  const N = 32;
  const r = resizeGray(img, N, N);
  const basis = dctBasis(N);

  // Satır DCT
  const rows = new Array<Float64Array>(N);
  for (let y = 0; y < N; y++) {
    const out = new Float64Array(N);
    const rowOff = y * N;
    for (let u = 0; u < N; u++) {
      let sum = 0;
      const bu = basis[u];
      for (let x = 0; x < N; x++) sum += r.data[rowOff + x] * bu[x];
      out[u] = sum;
    }
    rows[y] = out;
  }
  // Sütun DCT — yalnız ilk 8 frekans gerekli
  const low: number[] = [];
  for (let v = 0; v < 8; v++) {
    const bv = basis[v];
    for (let u = 0; u < 8; u++) {
      let sum = 0;
      for (let y = 0; y < N; y++) sum += rows[y][u] * bv[y];
      low.push(sum);
    }
  }

  // DC terimi (index 0) hariç medyan
  const ac = low.slice(1).sort((a, b) => a - b);
  const median = ac[Math.floor(ac.length / 2)];

  const bits: number[] = [];
  for (let i = 0; i < 64; i++) bits.push(low[i] > median ? 1 : 0);
  return packBits(bits);
}

function popcount32(n: number): number {
  n = n >>> 0;
  let count = 0;
  while (n > 0) {
    count += n & 1;
    n = n >>> 1;
  }
  return count;
}

/** İki 64-bit hash arasındaki Hamming mesafesi (0..64). */
export function hamming(a: Hash64, b: Hash64): number {
  return popcount32((a.hi ^ b.hi) >>> 0) + popcount32((a.lo ^ b.lo) >>> 0);
}
