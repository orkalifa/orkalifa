/// <reference types="node" />
import { statSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HORIZON_Y,
  PALETTE,
  SUN_R,
  SUN_TOP_Y,
  DAY_INK,
  GRAIN_BOX,
  GRAIN_OPACITY_DAY,
  GRAIN_OPACITY_NIGHT,
  NIGHT_INK,
  SKY_VEIL_MAX,
  WATER_COLORS,
  WATER_VEIL_MAX,
  X_DARK,
  X_START,
  alignToSide,
  computeScene,
  grainOpacity,
  physicalLeft,
  physicalRight,
  rayPaths,
} from '../src/components/twilightScene.ts';

// A Tel Aviv-like evening: start 16:00, sunset 16:37, dark 17:03 (ms from an arbitrary day).
const MIN = 60_000;
const START = Date.UTC(2026, 10, 25, 14, 0);
const SUNSET = START + 37 * MIN;
const DARK = START + 63 * MIN;
const at = (min: number, tomorrow = false) => computeScene(START + min * MIN, START, SUNSET, DARK, tomorrow);

test('progress: 0 at the start, 1 at darkness, clamped and monotonic', () => {
  assert.equal(at(0).p, 0);
  assert.equal(at(63).p, 1);
  assert.equal(at(-30).p, 0);
  assert.equal(at(200).p, 1);
  let prev = -1;
  for (let m = 0; m <= 63; m++) {
    const p = at(m).p;
    assert.ok(p >= prev, `p not monotonic at ${m}`);
    prev = p;
  }
});

test('x runs right to left: start on the right, darkness on the left, sunset tick between', () => {
  assert.equal(at(0).x, X_START);
  assert.equal(at(63).x, X_DARK);
  const { sunsetX } = at(10);
  assert.ok(X_START > sunsetX && sunsetX > X_DARK);
  assert.ok(Math.abs(sunsetX - (X_START - (37 / 63) * (X_START - X_DARK))) < 1e-9);
  assert.ok(at(20).x < at(10).x, 'later is further left');
});

test('hero sun: its top limb touches the horizon exactly at sunset', () => {
  assert.equal(at(0).sunY, SUN_TOP_Y);
  assert.ok(Math.abs(at(37).sunY - SUN_R - HORIZON_Y) < 1e-6);
  assert.ok(at(30).sunY - SUN_R < HORIZON_Y, 'still above before sunset');
  assert.ok(at(45).sunY - SUN_R > HORIZON_Y, 'below after sunset');
  assert.equal(at(45).rays, 0);
});

test('darkening: none early, full at darkness, monotonic; stars only after sunset', () => {
  assert.equal(at(0).dusk, 0);
  assert.equal(at(0.07 * 63).dusk, 0);
  assert.equal(at(63).dusk, 1);
  let prev = -1;
  for (let m = 0; m <= 63; m++) {
    const d = at(m).dusk;
    assert.ok(d >= prev);
    prev = d;
  }
  for (let m = 0; m <= 37; m++) assert.equal(at(m).stars, 0, `stars at ${m}`);
  assert.equal(at(63).stars, 1);
  assert.ok(Math.abs(at(63).waterVeil - WATER_VEIL_MAX) < 1e-9);
  assert.equal(at(36).night, false);
  assert.equal(at(38).night, true);
});

test('afterglow: warm glow on the horizon after sunset, fading out toward darkness', () => {
  assert.ok(at(37.5).ember > 0.8);
  assert.ok(at(50).ember > 0.2 && at(50).ember < at(40).ember);
  assert.ok(at(63).ember < 0.01);
});

test('tomorrow: the start state (sun high, no dusk, no stars)', () => {
  const s = at(50, true);
  assert.equal(s.p, 0);
  assert.equal(s.dusk, 0);
  assert.equal(s.stars, 0);
  assert.equal(s.sunY, SUN_TOP_Y);
});

test('broken times fall back to a finite start state, never NaN', () => {
  const cases = [
    computeScene(NaN, START, SUNSET, DARK, false),
    computeScene(START, NaN, SUNSET, DARK, false),
    computeScene(START, DARK, SUNSET, START, false), // reversed
    computeScene(START, START, START, START, false), // zero span
    computeScene(Infinity, START, SUNSET, DARK, false),
  ];
  for (const s of cases) {
    for (const [k, v] of Object.entries(s)) if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k} = ${v}`);
    assert.equal(s.night, false);
    assert.equal(s.p, 0);
    assert.equal(s.dusk, 0);
  }
});

test('rays: 12 finite paths, long and short alternating', () => {
  const rays = rayPaths();
  assert.equal(rays.length, 12);
  assert.equal(rays.filter((r) => r.long).length, 6);
  for (const r of rays) assert.ok(!/NaN|Infinity/.test(r.d));
});

// --- colours ---
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const contrast = (a: number[], b: number[]) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

test('every text colour stays readable (WCAG 4.5:1) on the water, every 15 s of the evening', () => {
  for (let m = -5; m <= 70; m += 0.25) {
    const s = at(m);
    const ink = s.night ? NIGHT_INK : DAY_INK;
    for (const text of Object.values(ink)) {
      for (const water of WATER_COLORS) {
        const c = contrast(rgb(text), mix(rgb(water), rgb(PALETTE.waterVeil), s.waterVeil));
        assert.ok(c >= 4.5, `${text} on ${water} at minute ${m}: ${c.toFixed(2)}`);
      }
    }
  }
});

test('two-tone (DESIGN-REFS item 6): the second tone sits toward the water, both stay readable', () => {
  // Day: the label is clearly lighter than the near-black time. Night: a dimmer cream (little room).
  assert.ok(luminance(rgb(DAY_INK.soft)) >= 2 * luminance(rgb(DAY_INK.time)), 'day soft not lighter');
  assert.ok(luminance(rgb(NIGHT_INK.soft)) * 1.1 <= luminance(rgb(NIGHT_INK.time)), 'night soft not dimmer');
  // Worst water of each half of the evening (the full 15 s sweep above covers every moment).
  const dayWorst = mix(rgb(PALETTE.waterEnd), rgb(PALETTE.waterVeil), at(37).waterVeil);
  const nightWorst = mix(rgb(PALETTE.waterStart), rgb(PALETTE.waterVeil), at(37.25).waterVeil);
  for (const c of [DAY_INK.time, DAY_INK.soft]) assert.ok(contrast(rgb(c), dayWorst) >= 4.5, c);
  for (const c of [NIGHT_INK.time, NIGHT_INK.soft]) assert.ok(contrast(rgb(c), nightWorst) >= 4.5, c);
});

test('grain: faint, fainter at night, finite for broken input, and only over the sky', () => {
  assert.equal(grainOpacity(0), GRAIN_OPACITY_DAY);
  assert.equal(grainOpacity(1), GRAIN_OPACITY_NIGHT);
  assert.equal(grainOpacity(Number.NaN), GRAIN_OPACITY_DAY);
  for (let m = -5; m <= 70; m++) {
    const o = grainOpacity(at(m).dusk);
    assert.ok(o >= GRAIN_OPACITY_NIGHT && o <= GRAIN_OPACITY_DAY && o <= 0.08, `minute ${m}: ${o}`);
  }
  // Every text overlay sits at or below the horizon, so the grain never lies under text.
  assert.equal(GRAIN_BOX.top, 0);
  assert.ok(GRAIN_BOX.bottom <= HORIZON_Y);
});

test('grain asset exists and stays small (<= 60 KB)', () => {
  const size = statSync(new URL('../assets/images/grain-wave.jpg', import.meta.url)).size;
  assert.ok(size > 1000 && size <= 60 * 1024, `${size} bytes`);
});

test('the sky really darkens: clearly dimmer at sunset, near night at darkness', () => {
  const sky = (m: number) => luminance(mix(rgb(PALETTE.skyMid), rgb(PALETTE.duskMid), SKY_VEIL_MAX * at(m).dusk));
  assert.ok(sky(37) < 0.6 * sky(0), `sunset ${sky(37).toFixed(3)} vs start ${sky(0).toFixed(3)}`);
  assert.ok(sky(63) < 0.06, `dark ${sky(63).toFixed(3)}`);
});

test('no blue anywhere in the card palette', () => {
  for (const [name, hex] of Object.entries(PALETTE)) {
    assert.match(hex, /^#[0-9A-F]{6}$/i, name);
    const [r, g, b] = rgb(hex).map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (max === min) continue;
    let hue = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
    hue = (hue * 60 + 360) % 360;
    assert.ok(!(hue >= 180 && hue <= 260 && sat >= 0.25), `${name} ${hex} is blue (hue ${hue.toFixed(0)})`);
  }
});

// --- RTL: overlays must land on the same physical side as the SVG ---
const LTR = { isRTL: false, swapsLeftRight: true };
const RTL_SWAP = { isRTL: true, swapsLeftRight: true }; // Hebrew Android, RN default
const RTL_NOSWAP = { isRTL: true, swapsLeftRight: false };

test('physicalLeft/Right: asks for the side RN will actually draw on', () => {
  assert.deepEqual(physicalLeft(16, LTR), { left: 16 });
  assert.deepEqual(physicalRight(16, LTR), { right: 16 });
  // RN swaps left/right in RTL, so asking for `right` lands on the physical left.
  assert.deepEqual(physicalLeft(16, RTL_SWAP), { right: 16 });
  assert.deepEqual(physicalRight(16, RTL_SWAP), { left: 16 });
  assert.deepEqual(physicalLeft(16, RTL_NOSWAP), { left: 16 });
  assert.deepEqual(physicalRight(16, RTL_NOSWAP), { right: 16 });
});

test('alignToSide: flex-start is the right edge in RTL, the left edge in LTR', () => {
  assert.equal(alignToSide('right', LTR), 'flex-end');
  assert.equal(alignToSide('left', LTR), 'flex-start');
  assert.equal(alignToSide('right', RTL_SWAP), 'flex-start');
  assert.equal(alignToSide('left', RTL_SWAP), 'flex-end');
  assert.equal(alignToSide('right', RTL_NOSWAP), 'flex-start');
});
