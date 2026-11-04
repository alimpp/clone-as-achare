/*
 * Bespoke flat service illustrations drawn as inline SVG (no external assets).
 * Deterministic output, so it is safe for server rendering and hydration.
 * Scenes are drawn in a 320 x 220 space and centred inside a 400 x 200 canvas.
 */

export type IllustrationKind =
  | "cleaning"
  | "plumbing"
  | "electrical"
  | "appliance"
  | "painting"
  | "moving"
  | "ac"
  | "garden"
  | "furniture"
  | "computer"
  | "car"
  | "beauty"
  | "pest"
  | "general";

const KIND_BY_ICON: Record<string, IllustrationKind> = {
  sparkles: "cleaning",
  droplets: "plumbing",
  zap: "electrical",
  plug: "appliance",
  paintbrush: "painting",
  truck: "moving",
  snowflake: "ac",
  leaf: "garden",
  sofa: "furniture",
  laptop: "computer",
  car: "car",
  scissors: "beauty",
  hammer: "general",
  wrench: "general",
};

/** Chooses a scene from a category icon key, with a slug override for specific services. */
export function illustrationKind(iconKey: string, slug = ""): IllustrationKind {
  if (slug.includes("pest")) return "pest";
  return KIND_BY_ICON[iconKey] ?? "general";
}

type Palette = { bg: string; ink: string; soft: string; accent: string; sky: string };

const PALETTES: Record<string, Palette> = {
  emerald: { bg: "#E9F8F1", ink: "#087F5B", soft: "#B9F5D0", accent: "#C8F169", sky: "#8FD3F4" },
  mint: { bg: "#EDFAF4", ink: "#066B4D", soft: "#CDF8DF", accent: "#C8F169", sky: "#9ADBF7" },
  lime: { bg: "#F4FBE2", ink: "#3F6212", soft: "#DDF6AE", accent: "#B9F5D0", sky: "#9ADBF7" },
  sky: { bg: "#EAF4FC", ink: "#1E5A99", soft: "#C4E2FA", accent: "#C8F169", sky: "#8FD3F4" },
  amber: { bg: "#FBF5E8", ink: "#92590A", soft: "#F8E1A8", accent: "#C8F169", sky: "#8FD3F4" },
  rose: { bg: "#FCEFF2", ink: "#B0304F", soft: "#F9C9D4", accent: "#C8F169", sky: "#8FD3F4" },
  violet: { bg: "#F2EFFC", ink: "#5440A8", soft: "#D8CFF7", accent: "#C8F169", sky: "#8FD3F4" },
  slate: { bg: "#EEF2F0", ink: "#334155", soft: "#D5DEDA", accent: "#C8F169", sky: "#9ADBF7" },
};

const DROP = "M0 -16 C0 -16 -12 -2 -12 6 A12 12 0 0 0 12 6 C12 -2 0 -16 0 -16Z";

function Spark({ x, y, s = 1, c }: { x: number; y: number; s?: number; c: string }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -11 C1 -3 3 -1 11 0 C3 1 1 3 0 11 C-1 3 -3 1 -11 0 C-3 -1 -1 -3 0 -11Z" fill={c} />;
}

function Scene({ kind, p }: { kind: IllustrationKind; p: Palette }) {
  const line = { fill: "none", stroke: p.ink, strokeWidth: 4, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const shadow = <ellipse cx="160" cy="196" rx="108" ry="8" fill={p.ink} opacity="0.08" />;

  switch (kind) {
    case "cleaning":
      return (
        <g>
          {shadow}
          <g className="illo-float">
            <rect x="112" y="98" width="76" height="92" rx="20" fill="#FFFFFF" stroke={p.ink} strokeWidth="3.5" />
            <rect x="122" y="134" width="56" height="30" rx="8" fill={p.accent} stroke={p.ink} strokeWidth="3" />
            <rect x="122" y="76" width="56" height="24" rx="8" fill={p.ink} />
            <path d="M178 84 H196 Q204 84 204 92 V104" {...line} />
            <rect x="196" y="100" width="18" height="10" rx="4" fill={p.ink} />
          </g>
          <rect x="200" y="140" width="70" height="46" rx="12" fill={p.soft} stroke={p.ink} strokeWidth="3.5" />
          <circle cx="216" cy="158" r="4" fill={p.ink} />
          <circle cx="236" cy="170" r="4" fill={p.ink} />
          <circle cx="252" cy="156" r="3" fill={p.ink} />
          <circle cx="82" cy="118" r="9" fill="#FFFFFF" stroke={p.ink} strokeWidth="3" />
          <circle cx="68" cy="158" r="6" fill="#FFFFFF" stroke={p.ink} strokeWidth="3" />
          <circle cx="252" cy="70" r="7" fill="#FFFFFF" stroke={p.ink} strokeWidth="3" />
          <Spark x={60} y={72} s={1.1} c={p.ink} />
          <Spark x={278} y={120} s={0.8} c={p.ink} />
        </g>
      );
    case "plumbing":
      return (
        <g>
          {shadow}
          <path d="M34 150 H146 Q168 150 168 128 V84 Q168 56 196 56 H290" fill="none" stroke={p.ink} strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M34 150 H146 Q168 150 168 128 V84 Q168 56 196 56 H290" fill="none" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="162" y="76" width="12" height="18" rx="4" fill={p.ink} />
          <circle cx="168" cy="110" r="18" fill={p.accent} stroke={p.ink} strokeWidth="4" />
          <path d={DROP} transform="translate(236 124) scale(1.1)" fill={p.sky} stroke={p.ink} strokeWidth="3" />
          <path d={DROP} transform="translate(272 150) scale(0.8)" fill={p.sky} stroke={p.ink} strokeWidth="3" />
          <path d={DROP} transform="translate(92 96) scale(0.7)" fill={p.sky} stroke={p.ink} strokeWidth="3" />
          <Spark x={262} y={64} s={0.9} c={p.ink} />
        </g>
      );
    case "electrical":
      return (
        <g>
          <circle cx="160" cy="100" r="84" fill="none" stroke={p.ink} strokeWidth="2.5" strokeDasharray="3 10" opacity="0.45" />
          <circle cx="160" cy="100" r="62" fill={p.accent} opacity="0.55" />
          <path d="M160 14 V30 M96 38 L106 50 M224 38 L214 50" stroke={p.ink} strokeWidth="4" strokeLinecap="round" />
          <g className="illo-float">
            <path d="M160 52 C124 52 106 80 106 104 C106 126 122 136 128 150 H192 C198 136 214 126 214 104 C214 80 196 52 160 52Z" fill="#FFFFFF" stroke={p.ink} strokeWidth="4" />
            <path d="M146 110 L154 124 L160 102 L166 124 L174 110" fill="none" stroke={p.ink} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
            <rect x="136" y="150" width="48" height="24" rx="6" fill={p.ink} />
            <rect x="144" y="176" width="32" height="8" rx="4" fill={p.ink} opacity="0.5" />
          </g>
          <path d="M160 184 C160 198 180 204 200 214" fill="none" stroke={p.ink} strokeWidth="3.5" />
          <Spark x={256} y={72} s={1.1} c={p.ink} />
        </g>
      );
    case "appliance":
      return (
        <g>
          {shadow}
          <rect x="84" y="46" width="152" height="150" rx="22" fill="#FFFFFF" stroke={p.ink} strokeWidth="4" />
          <path d="M84 84 H236" stroke={p.ink} strokeWidth="3" opacity="0.25" />
          <circle cx="108" cy="65" r="6" fill={p.accent} stroke={p.ink} strokeWidth="2.5" />
          <rect x="196" y="58" width="28" height="14" rx="7" fill={p.soft} stroke={p.ink} strokeWidth="2.5" />
          <circle cx="160" cy="136" r="44" fill={p.soft} stroke={p.ink} strokeWidth="4" />
          <circle cx="160" cy="136" r="24" fill="#FFFFFF" stroke={p.ink} strokeWidth="3.5" />
          <path d="M120 116 Q128 100 146 96" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
          <rect x="98" y="196" width="22" height="10" rx="4" fill={p.ink} />
          <rect x="200" y="196" width="22" height="10" rx="4" fill={p.ink} />
          <Spark x={262} y={100} s={1} c={p.ink} />
          <Spark x={58} y={150} s={0.7} c={p.ink} />
        </g>
      );
    case "painting":
      return (
        <g>
          {shadow}
          <path d="M226 74 L262 30" stroke={p.ink} strokeWidth="9" strokeLinecap="round" />
          <rect x="92" y="62" width="138" height="34" rx="12" fill="#FFFFFF" stroke={p.ink} strokeWidth="4" />
          <rect x="104" y="96" width="112" height="40" rx="10" fill={p.soft} stroke={p.ink} strokeWidth="4" />
          <path d="M124 136 V156 M174 136 V164 M206 136 V152" stroke={p.ink} strokeWidth="5" strokeLinecap="round" />
          <circle cx="124" cy="162" r="6" fill={p.ink} />
          <circle cx="174" cy="170" r="6" fill={p.ink} />
          <circle cx="206" cy="158" r="5" fill={p.ink} />
          <ellipse cx="258" cy="150" rx="34" ry="26" fill="#FFFFFF" stroke={p.ink} strokeWidth="4" />
          <circle cx="244" cy="146" r="5" fill={p.accent} />
          <circle cx="258" cy="138" r="5" fill={p.ink} />
          <circle cx="272" cy="146" r="5" fill={p.sky} />
          <circle cx="250" cy="162" r="5" fill="#F9C9D4" />
          <Spark x={60} y={80} s={1} c={p.ink} />
        </g>
      );
    case "moving":
      return (
        <g>
          {shadow}
          <rect x="62" y="124" width="98" height="72" rx="8" fill={p.soft} stroke={p.ink} strokeWidth="4" />
          <rect x="104" y="124" width="14" height="72" fill="#FFFFFF" opacity="0.8" />
          <path d="M78 146 H118" stroke={p.ink} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
          <rect x="108" y="66" width="80" height="58" rx="8" fill={p.accent} stroke={p.ink} strokeWidth="4" />
          <path d="M148 66 V124" stroke={p.ink} strokeWidth="3" opacity="0.5" />
          <rect x="176" y="146" width="76" height="50" rx="8" fill="#FFFFFF" stroke={p.ink} strokeWidth="4" />
          <path d="M192 166 H236" stroke={p.ink} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
          <path d="M262 110 H288" stroke={p.ink} strokeWidth="5" strokeLinecap="round" />
          <path d="M288 110 L276 190" stroke={p.ink} strokeWidth="5" strokeLinecap="round" />
          <circle cx="276" cy="196" r="8" fill={p.ink} />
          <Spark x={40} y={96} s={1} c={p.ink} />
        </g>
      );
    case "ac":
      return (
        <g>
          {shadow}
          <rect x="60" y="72" width="200" height="72" rx="20" fill="#FFFFFF" stroke={p.ink} strokeWidth="4" />
          <rect x="76" y="124" width="168" height="14" rx="7" fill={p.soft} stroke={p.ink} strokeWidth="3" />
          <rect x="196" y="92" width="34" height="12" rx="4" fill={p.accent} stroke={p.ink} strokeWidth="2.5" />
          {[118, 160, 202].map((x) => (
            <path key={x} d={`M${x} 160 q-9 10 0 20 t0 20`} fill="none" stroke={p.sky} strokeWidth="4" strokeLinecap="round" />
          ))}
          <g transform="translate(278 50)" stroke={p.ink} strokeWidth="3.5" strokeLinecap="round">
            <path d="M0 -16 V16 M-14 -8 L14 8 M-14 8 L14 -8" />
          </g>
        </g>
      );
    case "garden":
      return (
        <g>
          {shadow}
          <path d="M160 140 C160 110 160 92 160 60" fill="none" stroke={p.ink} strokeWidth="4" strokeLinecap="round" />
          <path d="M160 112 C134 112 116 96 114 70 C142 70 158 86 160 112Z" fill={p.accent} stroke={p.ink} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M160 88 C182 88 202 72 206 44 C180 44 162 60 160 88Z" fill={p.soft} stroke={p.ink} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M108 138 H212 L200 186 Q198 192 190 192 H130 Q122 192 120 186 Z" fill="#FFFFFF" stroke={p.ink} strokeWidth="4" strokeLinejoin="round" />
          <rect x="96" y="128" width="128" height="16" rx="7" fill={p.soft} stroke={p.ink} strokeWidth="3.5" />
          <Spark x={262} y={84} s={1} c={p.ink} />
          <Spark x={58} y={120} s={0.7} c={p.ink} />
        </g>
      );
    case "furniture":
      return (
        <g>
          <ellipse cx="160" cy="194" rx="124" ry="8" fill={p.ink} opacity="0.08" />
          <rect x="84" y="84" width="152" height="62" rx="20" fill={p.soft} stroke={p.ink} strokeWidth="4" />
          <rect x="64" y="112" width="40" height="66" rx="16" fill={p.soft} stroke={p.ink} strokeWidth="4" />
          <rect x="216" y="112" width="40" height="66" rx="16" fill={p.soft} stroke={p.ink} strokeWidth="4" />
          <rect x="76" y="126" width="168" height="44" rx="14" fill="#FFFFFF" stroke={p.ink} strokeWidth="4" />
          <rect x="96" y="96" width="44" height="34" rx="12" fill={p.accent} stroke={p.ink} strokeWidth="3.5" />
          <rect x="182" y="96" width="44" height="34" rx="12" fill={p.accent} stroke={p.ink} strokeWidth="3.5" />
          <rect x="84" y="170" width="12" height="16" rx="4" fill={p.ink} />
          <rect x="224" y="170" width="12" height="16" rx="4" fill={p.ink} />
          <path d="M160 128 V168" stroke={p.ink} strokeWidth="3" opacity="0.25" />
          <Spark x={270} y={70} s={1} c={p.ink} />
        </g>
      );
    case "computer":
      return (
        <g>
          {shadow}
          <rect x="92" y="52" width="136" height="94" rx="14" fill={p.ink} />
          <rect x="102" y="62" width="116" height="74" rx="6" fill={p.soft} />
          <path d="M134 100 L150 116 L186 80" fill="none" stroke={p.ink} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M64 150 H256 L266 170 Q268 178 258 178 H62 Q52 178 54 170 Z" fill={p.soft} stroke={p.ink} strokeWidth="4" strokeLinejoin="round" />
          <rect x="142" y="154" width="36" height="6" rx="3" fill={p.ink} opacity="0.35" />
          <rect x="226" y="36" width="64" height="34" rx="14" fill={p.accent} stroke={p.ink} strokeWidth="3.5" />
          <path d="M236 68 L232 82 L250 68" fill={p.accent} stroke={p.ink} strokeWidth="3.5" strokeLinejoin="round" />
          <circle cx="244" cy="53" r="4" fill={p.ink} />
          <circle cx="258" cy="53" r="4" fill={p.ink} />
          <circle cx="272" cy="53" r="4" fill={p.ink} />
        </g>
      );
    case "car":
      return (
        <g>
          <ellipse cx="160" cy="186" rx="124" ry="8" fill={p.ink} opacity="0.08" />
          <path d="M58 146 L84 118 Q94 106 112 104 L196 100 Q216 100 228 116 L262 134 Q272 140 272 152 V160 H58 Z" fill={p.soft} stroke={p.ink} strokeWidth="4" strokeLinejoin="round" />
          <path d="M112 116 L134 110 L190 110 L210 120 Z" fill="#FFFFFF" stroke={p.ink} strokeWidth="3.5" strokeLinejoin="round" />
          <circle cx="104" cy="162" r="22" fill={p.ink} />
          <circle cx="104" cy="162" r="9" fill="#FFFFFF" />
          <circle cx="226" cy="162" r="22" fill={p.ink} />
          <circle cx="226" cy="162" r="9" fill="#FFFFFF" />
          <rect x="252" y="130" width="12" height="8" rx="3" fill={p.accent} stroke={p.ink} strokeWidth="2.5" />
          <Spark x={42} y={80} s={1} c={p.ink} />
        </g>
      );
    case "beauty":
      return (
        <g>
          {shadow}
          <ellipse cx="144" cy="96" rx="52" ry="62" fill={p.soft} stroke={p.ink} strokeWidth="4" />
          <ellipse cx="144" cy="96" rx="40" ry="50" fill="#FFFFFF" />
          <path d="M116 78 Q124 60 146 56" fill="none" stroke={p.ink} strokeWidth="5" strokeLinecap="round" opacity="0.25" />
          <rect x="134" y="158" width="20" height="36" rx="10" fill={p.ink} />
          <path d="M226 150 L248 96" stroke={p.ink} strokeWidth="5" strokeLinecap="round" />
          <path d="M258 150 L236 96" stroke={p.ink} strokeWidth="5" strokeLinecap="round" />
          <circle cx="222" cy="162" r="10" fill="#FFFFFF" stroke={p.ink} strokeWidth="4" />
          <circle cx="262" cy="162" r="10" fill="#FFFFFF" stroke={p.ink} strokeWidth="4" />
          <Spark x={276} y={60} s={1} c={p.ink} />
        </g>
      );
    case "pest":
      return (
        <g>
          {shadow}
          <path d="M150 66 Q130 40 112 40 M170 66 Q190 40 208 40" fill="none" stroke={p.ink} strokeWidth="3.5" strokeLinecap="round" />
          {["M108 112 L80 100", "M106 142 L78 152", "M112 166 L90 184", "M212 112 L240 100", "M214 142 L242 152", "M208 166 L230 184"].map((d) => (
            <path key={d} d={d} fill="none" stroke={p.ink} strokeWidth="4" strokeLinecap="round" />
          ))}
          <ellipse cx="160" cy="130" rx="56" ry="48" fill={p.accent} stroke={p.ink} strokeWidth="4" />
          <path d="M160 84 V178" stroke={p.ink} strokeWidth="3.5" />
          <circle cx="136" cy="114" r="8" fill={p.ink} />
          <circle cx="184" cy="116" r="6" fill={p.ink} />
          <circle cx="140" cy="150" r="6" fill={p.ink} />
          <circle cx="182" cy="152" r="8" fill={p.ink} />
          <circle cx="160" cy="76" r="24" fill={p.ink} />
          <circle cx="151" cy="72" r="3.5" fill="#FFFFFF" />
          <circle cx="169" cy="72" r="3.5" fill="#FFFFFF" />
          <circle cx="262" cy="56" r="20" fill="#FFFFFF" stroke={p.ink} strokeWidth="4" />
          <path d="M250 68 L274 44" stroke={p.ink} strokeWidth="4" strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g>
          {shadow}
          <rect x="156" y="88" width="14" height="108" rx="7" fill="#FFFFFF" stroke={p.ink} strokeWidth="4" />
          <rect x="112" y="60" width="90" height="36" rx="10" fill={p.accent} stroke={p.ink} strokeWidth="4" />
          <g transform="rotate(32 246 140)">
            <rect x="240" y="72" width="12" height="104" rx="6" fill={p.soft} stroke={p.ink} strokeWidth="4" />
            <rect x="234" y="170" width="24" height="46" rx="10" fill={p.ink} />
          </g>
          <Spark x={60} y={90} s={1} c={p.ink} />
          <Spark x={278} y={80} s={0.8} c={p.ink} />
        </g>
      );
  }
}

/** Service artwork with a tinted backdrop. Use `className` to set size; the art fills the box. */
export function ServiceIllustration({ kind, tone = "emerald", title, className = "" }: { kind: IllustrationKind; tone?: string; title: string; className?: string }) {
  const p = PALETTES[tone] ?? PALETTES.emerald!;
  return (
    <div role="img" aria-label={title} className={`relative overflow-hidden ${className}`} style={{ backgroundColor: p.bg }}>
      <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true" focusable="false">
        <circle cx="330" cy="40" r="110" fill="#FFFFFF" opacity="0.55" />
        <circle cx="60" cy="200" r="92" fill={p.soft} opacity="0.6" />
        <g transform="translate(200 100) scale(0.9) translate(-160 -115)">
          <Scene kind={kind} p={p} />
        </g>
      </svg>
    </div>
  );
}
