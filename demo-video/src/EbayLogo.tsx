// eBay kart video-logosu — Amazon/Etsy/Shopify ile AYNI görsel dil: siyah zemin
// üzerinde dönen 3D marka logosu (mixBlendMode:"screen" ile ana sayfada zemin
// kaybolur, sadece logo kalır). Farkı: stock 3D görüntü yerine Remotion +
// Three.js ile KOD tabanlı üretildi — eBay'in resmi 4 rengini (kırmızı/mavi/
// turuncu/yeşil, sayfadaki yazı-logo yedeğiyle birebir) harfe harfe kullanır.
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import fontData from "./fonts/helvetiker_bold.typeface.json";

export const EBAY_LOGO_FPS = 24;
export const EBAY_LOGO_DURATION = 10 * EBAY_LOGO_FPS; // 10sn, diğer logolarla aynı

// Sayfadaki (page.tsx) statik "ebay" yazı-yedeğiyle BİREBİR aynı renkler.
const LETTERS: { char: string; color: string }[] = [
  { char: "e", color: "#ef4444" },
  { char: "b", color: "#3b82f6" },
  { char: "a", color: "#f59e0b" },
  { char: "y", color: "#22c55e" },
];

const font = new FontLoader().parse(fontData as unknown as Record<string, unknown>);

/** Tek harfin ekstrüzyonlu 3D geometrisini üretir, merkezini orijine çeker (saf). */
function makeLetterGeometry(char: string): { geometry: TextGeometry; width: number } {
  const geometry = new TextGeometry(char, {
    font,
    size: 1,
    depth: 0.45,
    curveSegments: 12,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.035,
    bevelSegments: 5,
  });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const width = box.max.x - box.min.x;
  const midY = (box.max.y + box.min.y) / 2;
  const midZ = (box.max.z + box.min.z) / 2;
  // X ekseninde merkezlemeyi layout aşamasında yapıyoruz (harfler yan yana
  // dizilecek) — burada sadece dikey/derinlik merkezleme.
  geometry.translate(-box.min.x, -midY, -midZ);
  return { geometry, width };
}

const LETTER_GAP = 0.18;

/** Dönen "ebay" harf grubu — Three.js sahnesi (saf render, framesu dışarıdan gelir). */
const RotatingWordmark: React.FC<{ frame: number; durationInFrames: number }> = ({
  frame,
  durationInFrames,
}) => {
  const letters = useMemo(() => LETTERS.map((l) => ({ ...l, ...makeLetterGeometry(l.char) })), []);

  const totalWidth = useMemo(
    () => letters.reduce((sum, l) => sum + l.width, 0) + LETTER_GAP * (letters.length - 1),
    [letters]
  );

  // Tam 360°'yi tüm klip boyunca döner — frame 0 ile "bir sonraki" frame
  // (=durationInFrames, yani döngü sonrası tekrar 0'a sarar) arasında dikişsiz
  // geçiş için bölen durationInFrames (durationInFrames-1 DEĞİL).
  const rotationY = (frame / durationInFrames) * Math.PI * 2;
  // Hafif organik sallanma — tamamen düz dönüş donuk durur.
  const wobble = Math.sin((frame / durationInFrames) * Math.PI * 2 * 2) * 0.08;

  let cursorX = 0;

  return (
    <group rotation={[wobble, rotationY, 0]}>
      {letters.map((l) => {
        const x = cursorX - totalWidth / 2 + l.width / 2;
        cursorX += l.width + LETTER_GAP;
        return (
          <mesh key={l.char} geometry={l.geometry} position={[x, 0, 0]}>
            <meshStandardMaterial color={l.color} metalness={0.35} roughness={0.28} />
          </mesh>
        );
      })}
    </group>
  );
};

export const EbayLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        linear
        camera={{ position: [0, 0.15, 8.2], fov: 32 }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 5, 6]} intensity={1.3} />
        <directionalLight position={[-5, -2, 3]} intensity={0.5} color="#ffffff" />
        <pointLight position={[0, 3, 5]} intensity={0.6} />
        <RotatingWordmark frame={frame} durationInFrames={durationInFrames} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
