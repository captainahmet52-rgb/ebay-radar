/**
 * MP4 "faststart" — moov atomunu dosyanın başına taşır (qt-faststart algoritması).
 * moov sonda olursa tarayıcı videoyu tamamen indirmeden oynatamaz → açılışta
 * kasma/donma olur. Saf JS — ffmpeg gerekmez.
 * Kaynak: sahibin Lumina AI projesinden (UGC VİDEO ÜRETİCİSİ) birebir port.
 *
 * Desteklenmeyen/bozuk dosyada orijinal buffer'ı aynen döner (zararsız).
 */

interface Atom {
  type: string;
  start: number;
  size: number;
  headerSize: number;
}

/** Üst seviye MP4 atomlarını listeler. */
function parseTopLevelAtoms(buf: Buffer): Atom[] | null {
  const atoms: Atom[] = [];
  let pos = 0;

  while (pos + 8 <= buf.length) {
    let size = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    let headerSize = 8;

    if (size === 1) {
      // 64-bit largesize
      if (pos + 16 > buf.length) return null;
      const big = buf.readBigUInt64BE(pos + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(big);
      headerSize = 16;
    } else if (size === 0) {
      // Dosya sonuna kadar
      size = buf.length - pos;
    }

    if (size < headerSize || pos + size > buf.length) return null;
    atoms.push({ type, start: pos, size, headerSize });
    pos += size;
  }

  return pos === buf.length ? atoms : null;
}

/** moov içindeki stco/co64 chunk offset tablolarına `delta` ekler (yerinde). */
function patchChunkOffsets(moov: Buffer, delta: number): boolean {
  const CONTAINERS = new Set([
    "moov", "trak", "mdia", "minf", "stbl", "edts", "mvex",
  ]);

  let ok = true;

  function walk(start: number, end: number) {
    let pos = start;
    while (pos + 8 <= end) {
      let size = moov.readUInt32BE(pos);
      const type = moov.toString("latin1", pos + 4, pos + 8);
      let headerSize = 8;

      if (size === 1) {
        if (pos + 16 > end) { ok = false; return; }
        const big = moov.readBigUInt64BE(pos + 8);
        if (big > BigInt(Number.MAX_SAFE_INTEGER)) { ok = false; return; }
        size = Number(big);
        headerSize = 16;
      } else if (size === 0) {
        size = end - pos;
      }

      if (size < headerSize || pos + size > end) { ok = false; return; }

      if (type === "cmov") {
        // Sıkıştırılmış moov — desteklenmiyor.
        ok = false;
        return;
      }

      if (type === "stco") {
        const count = moov.readUInt32BE(pos + headerSize + 4);
        let entry = pos + headerSize + 8;
        for (let i = 0; i < count; i++) {
          const val = moov.readUInt32BE(entry);
          const patched = val + delta;
          if (patched > 0xffffffff) { ok = false; return; }
          moov.writeUInt32BE(patched, entry);
          entry += 4;
        }
      } else if (type === "co64") {
        const count = moov.readUInt32BE(pos + headerSize + 4);
        let entry = pos + headerSize + 8;
        for (let i = 0; i < count; i++) {
          const val = moov.readBigUInt64BE(entry);
          moov.writeBigUInt64BE(val + BigInt(delta), entry);
          entry += 8;
        }
      } else if (CONTAINERS.has(type)) {
        walk(pos + headerSize, pos + size);
        if (!ok) return;
      }

      pos += size;
    }
  }

  walk(0, moov.length);
  return ok;
}

/**
 * moov atomu mdat'tan sonra ise başa taşır; zaten baştaysa dokunmaz.
 * Her hata durumunda orijinali döner — asla bozuk çıktı üretmez.
 */
export function faststart(input: Buffer): Buffer {
  const atoms = parseTopLevelAtoms(input);
  if (!atoms) return input;

  const moovAtom = atoms.find((a) => a.type === "moov");
  const mdatAtom = atoms.find((a) => a.type === "mdat");
  if (!moovAtom || !mdatAtom) return input;

  // moov zaten mdat'tan önceyse dosya optimize — dokunma.
  if (moovAtom.start < mdatAtom.start) return input;

  // moov'un kopyasını al, chunk offset'lerini moov boyutu kadar kaydır.
  const moov = Buffer.from(
    input.subarray(moovAtom.start, moovAtom.start + moovAtom.size),
  );
  if (!patchChunkOffsets(moov, moovAtom.size)) return input;

  // Yeni sıralama: ftyp + patched moov + kalan atomlar (orijinal sırada).
  const parts: Buffer[] = [];
  const ftyp = atoms.find((a) => a.type === "ftyp");
  if (ftyp) parts.push(input.subarray(ftyp.start, ftyp.start + ftyp.size));
  parts.push(moov);
  for (const a of atoms) {
    if (a.type === "moov" || a.type === "ftyp") continue;
    parts.push(input.subarray(a.start, a.start + a.size));
  }

  return Buffer.concat(parts);
}
