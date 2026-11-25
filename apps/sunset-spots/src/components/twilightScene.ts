/**
 * The twilight card's scene, as plain numbers: where the evening is, how high the sun is, how dark
 * the sky has turned. No React here, so the formulas are unit-tested (tests/twilightScene.test.ts).
 *
 * The evening runs right -> left, like Hebrew text: "תחילת השקיעה" (golden hour, sun at +6°) on the
 * right, "חושך" (civil dusk, sun at -6°) on the left. There is no blue hour in this card.
 */

/** The scene's drawing box (react-native-svg viewBox units). 358 x 144 is the card at a 390 px phone. */
export const VIEW_W = 358;
export const VIEW_H = 144;
/** The horizon line: sky above, water (and the times) below. */
export const HORIZON_Y = 84;
/** Timeline ends on the horizon: start of the evening on the right, darkness on the left. */
export const X_START = 330;
export const X_DARK = 28;
/** The hero sun: radius, and the height of its centre when the evening starts. */
export const SUN_R = 16;
export const SUN_TOP_Y = 33;
/**
 * The water band (where the times sit) darkens in two stretches: lightly until sunset (dark ink stays
 * readable), then from WATER_VEIL_NIGHT up to WATER_VEIL_MAX with cream text. Between the two lies a
 * band of mid tones where neither ink nor cream reaches 4.5:1, so the switch happens in one step, at
 * the sunset moment (the sun is gone, the lights dim). The sky above darkens smoothly all evening.
 */
export const WATER_VEIL_DAY = 0.3;
export const WATER_VEIL_NIGHT = 0.62;
export const WATER_VEIL_MAX = 0.9;
/** How dark the sky veil gets at darkness (near night). */
export const SKY_VEIL_MAX = 0.96;

/**
 * Every colour the card paints. Warm only: honey, apricot, terracotta, plum-umber at dusk.
 * The test checks that none of them is blue, and that every text colour stays readable on the water.
 */
export const PALETTE = {
  skyStart: '#FCE7C2',
  skyMid: '#F8CFA5',
  skyEnd: '#EBA98E',
  skyLow: '#F4A872',
  duskTop: '#2B1520',
  duskMid: '#4A2328',
  duskLow: '#6A3226',
  waterStart: '#F6D8BC',
  waterMid: '#F1CDAE',
  waterEnd: '#ECC3A2',
  waterVeil: '#2C1410',
  horizon: '#B9876A',
  elapsedStart: '#F2A92C',
  elapsedEnd: '#E55B24',
  tick: '#B54215',
  sunCore: '#FFF4D2',
  sunGold: '#F9C55A',
  sunAmber: '#F2A92C',
  sunRim: '#E8782C',
  sunLateCore: '#F9B27A',
  sunLateMid: '#E55B24',
  sunLateRim: '#B54215',
  rayLong: '#E87324',
  rayShort: '#F2A92C',
  aura: '#F7B84A',
  auraEdge: '#E55B24',
  ember: '#F08A4B',
  emberCore: '#FFC07A',
  cloudLight: '#FFF6EA',
  cloudBelly: '#F2C3A0',
  cloudDusk: '#8A4E46',
  cloudShadow: '#9A4216',
  glint: '#FFF1C9',
  star: '#FFF8EC',
  marker: '#E55B24',
  markerGlow: '#FFD9A0',
  markerEdge: '#FFF8EC',
  textTime: '#1E120C',
  textStart: '#3A2004',
  textDark: '#2E1F17',
  textCaption: '#4A1806',
  nightTime: '#FFF6EA',
  nightStart: '#FFEBD2',
  nightDark: '#FFF0E0',
  nightCaption: '#FFE6CC',
} as const;

export type TextInk = { time: string; start: string; dark: string; caption: string };
/** Text on the light (day) water, and on the dark (night) water after sunset. */
export const DAY_INK: TextInk = { time: PALETTE.textTime, start: PALETTE.textStart, dark: PALETTE.textDark, caption: PALETTE.textCaption };
export const NIGHT_INK: TextInk = { time: PALETTE.nightTime, start: PALETTE.nightStart, dark: PALETTE.nightDark, caption: PALETTE.nightCaption };
/** The water band's colours, before the dusk veil. */
export const WATER_COLORS = [PALETTE.waterStart, PALETTE.waterMid, PALETTE.waterEnd] as const;

export type Scene = {
  /** Evening progress, 0 at the start (right) to 1 at darkness (left). */
  p: number;
  /** Current time's x on the horizon. */
  x: number;
  /** The sunset moment's x (the thin tick, and where the hero sun sets). */
  sunsetX: number;
  /** Hero sun centre y. Its top limb touches the horizon exactly at sunset. */
  sunY: number;
  /** 0..1: the disc turning from gold to deep red as it nears the horizon. */
  late: number;
  /** 0..1: rays fade out as the sun gets low. */
  rays: number;
  /** 0..1: how dark the sky is (drives the dusk veil). */
  dusk: number;
  /** 0..1: the first stars, only after sunset. */
  stars: number;
  /** 0..1: warm glow on the horizon around the sunset moment. */
  ember: number;
  /** 0..1: the sun's reflection on the water. */
  reflection: number;
  /** 0..WATER_VEIL_MAX: the water band's darkening. */
  waterVeil: number;
  /** After sunset: the water is dark and the text is cream (NIGHT_INK). */
  night: boolean;
};

export const clamp01 = (v: number) => (v > 1 ? 1 : v > 0 ? v : 0); // NaN -> 0
const smoothstep = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

/** Before any evening (or with broken times): the start state, sun high, nothing dark. */
const START_SCENE: Scene = {
  p: 0,
  x: X_START,
  sunsetX: X_START - 0.58 * (X_START - X_DARK),
  sunY: SUN_TOP_Y,
  late: 0,
  rays: 1,
  dusk: 0,
  stars: 0,
  ember: 0.25,
  reflection: 0.5,
  waterVeil: 0,
  night: false,
};

/**
 * The scene at `nowMs`. `isTomorrow` (the times are tomorrow's) shows the start state.
 * Anything broken (non-finite, or not start < sunset < dark) falls back to the start state.
 */
export function computeScene(nowMs: number, startMs: number, sunsetMs: number, darkMs: number, isTomorrow: boolean): Scene {
  if (![nowMs, startMs, sunsetMs, darkMs].every(Number.isFinite) || !(startMs < sunsetMs && sunsetMs < darkMs)) {
    return START_SCENE;
  }
  const t = isTomorrow ? startMs : Math.min(Math.max(nowMs, startMs), darkMs);
  const span = darkMs - startMs;
  const xAt = (ms: number) => X_START - clamp01((ms - startMs) / span) * (X_START - X_DARK);

  const p = clamp01((t - startMs) / span);
  const q = clamp01((t - startMs) / (sunsetMs - startMs)); // start -> sunset
  const s = clamp01((t - sunsetMs) / (darkMs - sunsetMs)); // sunset -> dark
  const afterSunset = t > sunsetMs;

  // Sunset = the upper limb on the horizon, so at q = 1 the centre is one radius below it.
  const setY = HORIZON_Y + SUN_R;
  const sunY = afterSunset ? setY + 20 * s : SUN_TOP_Y + (setY - SUN_TOP_Y) * Math.pow(q, 1.15);
  // Starts dimming early, so at sunset the sky is already clearly darker; near night at the end.
  const dusk = smoothstep((p - 0.08) / 0.92);

  return {
    p,
    x: xAt(t),
    sunsetX: xAt(sunsetMs),
    sunY,
    late: smoothstep((q - 0.4) / 0.6),
    rays: afterSunset ? 0 : 0.15 + 0.85 * clamp01((1 - q) / 0.4),
    dusk,
    stars: clamp01((s - 0.1) / 0.6),
    // Warm glow on the horizon: grows toward sunset, then the afterglow fades out toward darkness.
    ember: afterSunset ? 0.95 * Math.pow(1 - s, 1.2) : 0.25 + 0.7 * q * q,
    reflection: afterSunset ? 0.8 * (1 - s) : 0.5 + 0.5 * q,
    waterVeil: afterSunset ? WATER_VEIL_NIGHT + (WATER_VEIL_MAX - WATER_VEIL_NIGHT) * s : WATER_VEIL_DAY * Math.pow(q, 1.2),
    night: afterSunset,
  };
}

/**
 * The 12 tapered rays around a sun of radius `r` at the origin (long and short alternating), as
 * path strings, so the SVG has no per-ray maths at render time.
 */
export function rayPaths(r: number = SUN_R): { d: string; long: boolean }[] {
  const out: { d: string; long: boolean }[] = [];
  for (let i = 0; i < 12; i++) {
    const long = i % 2 === 0;
    const inner = r + 3.6;
    const outer = long ? r + 11.5 : r + 8;
    const base = long ? 1.4 : 1.1;
    const tip = long ? 0.5 : 0.4;
    const a = (i * 30 - 90) * (Math.PI / 180);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // A tapered petal along +x, rotated by `a`.
    const pt = (x: number, y: number) => `${(x * cos - y * sin).toFixed(2)} ${(x * sin + y * cos).toFixed(2)}`;
    out.push({
      long,
      d: `M ${pt(inner, -base)} L ${pt(outer, -tip)} L ${pt(outer + tip, 0)} L ${pt(outer, tip)} L ${pt(inner, base)} Z`,
    });
  }
  return out;
}

/** How React Native lays out this device: RTL, and whether `left`/`right` styles get swapped in RTL. */
export type LayoutDir = { isRTL: boolean; swapsLeftRight: boolean };

/**
 * A style that puts a box `px` from the PHYSICAL left edge, whatever the layout direction. The SVG is
 * always drawn left-to-right, so overlays must match it: on a Hebrew Android (isRTL, with RN's default
 * left/right swap), `left` would land on the right, so we ask for `right` and let RN swap it back.
 */
export function physicalLeft(px: number, dir: LayoutDir): { left: number } | { right: number } {
  return dir.isRTL && dir.swapsLeftRight ? { right: px } : { left: px };
}

/** Same, from the PHYSICAL right edge. */
export function physicalRight(px: number, dir: LayoutDir): { left: number } | { right: number } {
  return dir.isRTL && dir.swapsLeftRight ? { left: px } : { right: px };
}

/** `alignItems` that hugs the PHYSICAL `side` (flex-start/end follow the layout direction). */
export function alignToSide(side: 'left' | 'right', dir: LayoutDir): 'flex-start' | 'flex-end' {
  const startIsLeft = !dir.isRTL;
  return (side === 'left') === startIsLeft ? 'flex-start' : 'flex-end';
}
