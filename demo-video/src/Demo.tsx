// leanautomation.pro demo videosu — ana sayfanın "komuta merkezi" diliyle birebir:
// koyu tema, violet #7c3aed, radar→depo→4 kanal akışı, gerçek sistem terminolojisi.
// Ses yok (sayfada autoplay-muted döner); anlatı tamamen görsel + yazı.

import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const DEMO_FPS = 30;
export const DEMO_DURATION = 34 * DEMO_FPS; // 34 saniye

const VIOLET = "#7c3aed";
const BG = "#050508";
const EASE_OUT: [number, number, number, number] = [0.19, 1, 0.22, 1];

const CHANNELS = [
  { label: "Amazon", color: "#f59e0b" },
  { label: "eBay", color: "#3b82f6" },
  { label: "Etsy", color: "#f97316" },
  { label: "Shopify", color: "#96bf48" },
];

// ─── Ortak parçalar ───────────────────────────────────────────────────────────

/** Radar ping logo (sitedeki LogoMark'ın büyütülmüş hali). */
const RadarMark: React.FC<{ size: number; sweep?: number }> = ({ size, sweep = 0 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="11" cy="21" r="2.6" fill={VIOLET} />
    <path d="M15 13 A 8.5 8.5 0 0 1 19 17" stroke={VIOLET} strokeWidth="2.6" strokeLinecap="round" opacity={1} />
    <path d="M17.5 8.5 A 14 14 0 0 1 23.5 14.5" stroke={VIOLET} strokeWidth="2.6" strokeLinecap="round" opacity={0.65} />
    <path d="M20 4 A 19.5 19.5 0 0 1 28 12" stroke={VIOLET} strokeWidth="2.6" strokeLinecap="round" opacity={0.4} />
    {/* Süpürme ışını */}
    <g transform={`rotate(${sweep} 11 21)`}>
      <line x1="11" y1="21" x2="28" y2="4" stroke={VIOLET} strokeWidth="1" opacity={0.35} />
    </g>
  </svg>
);

const fadeSlide = (frame: number, delay: number, fps: number) => {
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return { opacity: p, transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px)` };
};

/** Sahne kabuğu: giriş/çıkış crossfade. */
const Scene: React.FC<{ from: number; duration: number; children: React.ReactNode }> = ({
  from, duration, children,
}) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  const opacity = interpolate(local, [0, 12, duration - 12, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  return (
    <Sequence from={from} durationInFrames={duration}>
      <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
    </Sequence>
  );
};

const Center: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: "Arial, Helvetica, sans-serif" }}>
    {children}
  </AbsoluteFill>
);

// ─── Sahne 1: Marka girişi (0-4sn) ───────────────────────────────────────────
const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const sweep = interpolate(frame, [0, 4 * fps], [0, 240]);
  return (
    <Center>
      <div style={{ transform: `scale(${pop})` }}>
        <RadarMark size={220} sweep={sweep} />
      </div>
      <div style={{ ...fadeSlide(frame, 18, fps), marginTop: 48, textAlign: "center" }}>
        <div style={{ color: "white", fontSize: 84, fontWeight: 900, letterSpacing: -2 }}>
          LEAN <span style={{ color: VIOLET }}>AUTOMATION</span>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 34, marginTop: 14 }}>
          E-ticaretin motoru. Sen kârına bak.
        </div>
      </div>
    </Center>
  );
};

// ─── Sahne 2: Akış diyagramı (4-13sn) ────────────────────────────────────────
const ScenePipeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const W = 1920, H = 1080;
  const srcX = 430, dstX = 1500, midY = H / 2;
  const chY = (i: number) => 300 + i * 160;

  return (
    <AbsoluteFill style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ ...fadeSlide(frame, 0, fps), position: "absolute", top: 110, width: "100%", textAlign: "center" }}>
        <div style={{ color: "white", fontSize: 62, fontWeight: 900 }}>
          Radar keşfeder · Depo besler · <span style={{ color: VIOLET }}>Senkron korur</span>
        </div>
      </div>

      {/* Hatlar + akan paketler (kübik bezier üzerinde manuel konum) */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {CHANNELS.map((c, i) => {
          const p0 = { x: srcX + 90, y: midY };
          const p1 = { x: srcX + 470, y: midY };
          const p2 = { x: dstX - 500, y: chY(i) };
          const p3 = { x: dstX - 120, y: chY(i) };
          const path = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;
          const draw = interpolate(frame, [15 + i * 6, 55 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <g key={c.label}>
              <path d={path} stroke={`${c.color}66`} strokeWidth={4} fill="none"
                strokeDasharray={1400} strokeDashoffset={1400 * (1 - draw)} />
              {frame >= 55 && [0, 1, 2].map((k) => {
                const t = ((frame - 40 + k * 45 + i * 12) % 135) / 135;
                const pt = cubicPoint(p0, p1, p2, p3, t);
                return (
                  <circle key={k} cx={pt.x} cy={pt.y} r={11} fill={c.color}
                    opacity={t < 0.05 || t > 0.95 ? 0 : 1} />
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Kaynak düğümü */}
      <div style={{
        ...fadeSlide(frame, 8, fps),
        position: "absolute", left: srcX - 160, top: midY - 130, width: 320,
        background: "rgba(124,58,237,0.12)", border: `3px solid ${VIOLET}88`,
        borderRadius: 36, padding: "42px 30px", textAlign: "center",
      }}>
        <RadarMark size={90} sweep={frame * 3} />
        <div style={{ color: "white", fontSize: 34, fontWeight: 800, marginTop: 16 }}>Ortak Depo</div>
        <div style={{ color: "#a78bfa", fontSize: 26, marginTop: 6 }}>1.500 kazanan ürün</div>
      </div>

      {/* Kanal düğümleri */}
      {CHANNELS.map((c, i) => (
        <div key={c.label} style={{
          ...fadeSlide(frame, 20 + i * 6, fps),
          position: "absolute", left: dstX - 110, top: chY(i) - 46, width: 330,
          background: `${c.color}14`, border: `3px solid ${c.color}66`,
          borderRadius: 24, padding: "22px 30px",
          display: "flex", alignItems: "center", gap: 18,
        }}>
          <div style={{ width: 18, height: 18, borderRadius: 99, background: c.color }} />
          <span style={{ color: "white", fontSize: 34, fontWeight: 800 }}>{c.label}</span>
          <span style={{ color: c.color, fontSize: 30, marginLeft: "auto" }}>✓</span>
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** Kübik bezier üzerinde t (0-1) konumundaki nokta. */
interface Pt { x: number; y: number }
function cubicPoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

// ─── Sahne 3: Özellik vuruşları (13-24sn) ────────────────────────────────────
const FEATURES = [
  { title: "Oto-listeleme + akıllı fiyat", desc: "Ürün depodan seçilir; fiyat pazara göre hesaplanır, ilan kendiliğinden açılır." },
  { title: "5 dakikada bir stok nöbeti", desc: "Kaynak stok biterse ilan ANINDA durdurulur — asla satamayacağın ürünü satmazsın." },
  { title: "Sipariş anında hazır", desc: "Sipariş düşer düşmez kaynak doğrulanır, maliyet damgalanır, takip kodu sisteme akar." },
];

const SceneFeatures: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Center>
      <div style={{ ...fadeSlide(frame, 0, fps), textAlign: "center", marginBottom: 70 }}>
        <div style={{ color: "white", fontSize: 66, fontWeight: 900 }}>Motor arkada, sen önde.</div>
      </div>
      <div style={{ display: "flex", gap: 40, padding: "0 120px" }}>
        {FEATURES.map((f, i) => (
          <div key={f.title} style={{
            ...fadeSlide(frame, 20 + i * 22, fps),
            flex: 1, background: "rgba(255,255,255,0.035)", border: "2px solid rgba(255,255,255,0.1)",
            borderRadius: 32, padding: "48px 42px",
          }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(124,58,237,0.2)", border: `2px solid ${VIOLET}`, display: "flex", alignItems: "center", justifyContent: "center", color: VIOLET, fontSize: 34, fontWeight: 900, marginBottom: 30 }}>
              {i + 1}
            </div>
            <div style={{ color: "white", fontSize: 38, fontWeight: 800, lineHeight: 1.2 }}>{f.title}</div>
            <div style={{ color: "#94a3b8", fontSize: 27, lineHeight: 1.5, marginTop: 18 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </Center>
  );
};

// ─── Sahne 4: AI Stüdyo (24-29sn) ────────────────────────────────────────────
const SceneAI: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = ["3 profesyonel AI ürün görseli", "Konuşan UGC reklam videosu", "Meta kampanya taslağı"];
  return (
    <Center>
      <div style={{ ...fadeSlide(frame, 0, fps), textAlign: "center" }}>
        <div style={{ color: VIOLET, fontSize: 40, fontWeight: 800, marginBottom: 18 }}>AI STÜDYO</div>
        <div style={{ color: "white", fontSize: 70, fontWeight: 900 }}>İçini açınca AI var.</div>
      </div>
      <div style={{ display: "flex", gap: 28, marginTop: 70 }}>
        {items.map((t, i) => (
          <div key={t} style={{
            ...fadeSlide(frame, 18 + i * 14, fps),
            background: "rgba(124,58,237,0.14)", border: `2px solid ${VIOLET}77`,
            borderRadius: 999, padding: "26px 48px", color: "white", fontSize: 32, fontWeight: 700,
          }}>
            {t}
          </div>
        ))}
      </div>
    </Center>
  );
};

// ─── Sahne 5: CTA (29-34sn) ──────────────────────────────────────────────────
const SceneCta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 10, fps, config: { damping: 15 } });
  return (
    <Center>
      <div style={{ ...fadeSlide(frame, 0, fps), textAlign: "center" }}>
        <div style={{ color: "white", fontSize: 80, fontWeight: 900, letterSpacing: -1 }}>
          Motoru çalıştır. <span style={{ color: VIOLET }}>Gerisini izle.</span>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 36, marginTop: 24 }}>
          7 gün ücretsiz · 50 ürün · kredi kartı gerekmez
        </div>
      </div>
      <div style={{
        transform: `scale(${pop})`, marginTop: 60,
        background: VIOLET, color: "white", fontSize: 40, fontWeight: 900,
        padding: "30px 70px", borderRadius: 24, boxShadow: `0 30px 80px ${VIOLET}66`,
      }}>
        leanautomation.pro
      </div>
    </Center>
  );
};

// ─── Kompozisyon ──────────────────────────────────────────────────────────────
export const Demo: React.FC = () => {
  const F = DEMO_FPS;
  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* Sabit arka ışık */}
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at 50% -10%, rgba(88,28,220,0.32), transparent 60%)`,
      }} />
      <Scene from={0} duration={4 * F}><SceneIntro /></Scene>
      <Scene from={4 * F} duration={9 * F}><ScenePipeline /></Scene>
      <Scene from={13 * F} duration={11 * F}><SceneFeatures /></Scene>
      <Scene from={24 * F} duration={5 * F}><SceneAI /></Scene>
      <Scene from={29 * F} duration={5 * F}><SceneCta /></Scene>
    </AbsoluteFill>
  );
};
