// make-icons.mjs
// Derives every app icon from the chosen draft (assets/drafts/icons/icon-02-v1.png: sun behind two hills, two tones, hills separate at 32 px),
// so the icons can be rebuilt the same way whenever the draft changes.
// Run (working directory: apps/sunset-spots): node scripts/make-icons.mjs
//
// The draft is a 1024 raster on a slightly noisy parchment. We lift the motif off that background
// (soft alpha from the colour distance, edges un-blended so no halo), then re-place it on a flat
// #F5EDE3 or on transparency, at a size that fits each platform's safe zone.
// The motif itself is not changed.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Jimp from 'jimp-compact';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SOURCE = path.join(HERE, '..', 'assets', 'drafts', 'icons', 'icon-02-v1.png');

export const PARCHMENT = /** @type {const} */ ([0xf5, 0xed, 0xe3]);
/** Motif width as a share of the canvas, where nothing masks it (app icon, favicon, splash). */
export const FILL = 0.78;
/** Android adaptive icon: the 66 dp safe circle of the 108 dp canvas has radius 33/108 = 0.3056. */
export const FOREGROUND_RADIUS = 0.3;
/** Web maskable icon: the safe circle has radius 0.40 of the canvas. */
export const MASKABLE_RADIUS = 0.38;

// Colour distance from the draft's background: below LO is background (its noise is under 9), above HI is motif.
const LO = 14;
const HI = 40;

/** The PWA manifest icons; web-postbuild.mjs writes these files and this list into the manifest. */
export function manifestIcons(base) {
  return [
    { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: `${base}icon-maskable-192.png`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: `${base}icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ];
}

export async function readPng(file) {
  const img = await Jimp.read(file);
  const { width, height, data } = img.bitmap;
  return { width, height, data: new Uint8Array(data) };
}

async function writePng(file, { width, height, data }) {
  const img = new Jimp({ data: Buffer.from(data), width, height });
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, await img.getBufferAsync(Jimp.MIME_PNG));
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Lift the motif off the draft: premultiplied RGBA floats, cropped to the motif, plus its bounding-circle radius. */
function extractMotif({ width: W, height: H, data }) {
  // Background colour = mean of a 16 px border.
  const bg = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (x >= 16 && x < W - 16 && y >= 16 && y < H - 16) continue;
      const i = (y * W + x) * 4;
      bg[0] += data[i];
      bg[1] += data[i + 1];
      bg[2] += data[i + 2];
      n++;
    }
  for (let c = 0; c < 3; c++) bg[c] /= n;

  const full = new Float32Array(W * H * 4);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const d = Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
      const a = clamp01((d - LO) / (HI - LO));
      if (a === 0) continue;
      for (let c = 0; c < 3; c++) {
        // Un-blend the edge from the old background, then premultiply.
        const col = Math.min(255, Math.max(0, (data[i + c] - (1 - a) * bg[c]) / a));
        full[i + c] = col * a;
      }
      full[i + 3] = a;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  if (x1 < 0) throw new Error('make-icons: no motif found in the draft');

  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const px = new Float32Array(w * h * 4);
  let r = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = ((y + y0) * W + (x + x0)) * 4;
      const t = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) px[t + c] = full[s + c];
      // Farthest pixel corner from the centre.
      if (px[t + 3] > 0) r = Math.max(r, Math.hypot(Math.abs(x + 0.5 - w / 2) + 0.5, Math.abs(y + 0.5 - h / 2) + 0.5));
    }
  return { w, h, px, r };
}

/** Single-colour version for Android themed icons: white, with the sun's yellow fill cut out (ring + hills stay). */
function monochrome(motif) {
  const { w, h, px } = motif;
  // Reference colours sampled from the draft's motif: orange ring, yellow fill, dark hills.
  const ORANGE = [229, 94, 36];
  const YELLOW = [235, 166, 39];
  const DARK = [38, 23, 14];
  const out = new Float32Array(px.length);
  for (let i = 0; i < w * h * 4; i += 4) {
    const a = px[i + 3];
    if (a === 0) continue;
    const col = [px[i] / a, px[i + 1] / a, px[i + 2] / a];
    const dist = (ref) => Math.hypot(col[0] - ref[0], col[1] - ref[1], col[2] - ref[2]);
    const yellow = clamp01((Math.min(dist(ORANGE), dist(DARK)) - dist(YELLOW)) / 60 + 0.5);
    const m = a * (1 - yellow);
    out[i] = out[i + 1] = out[i + 2] = 255 * m;
    out[i + 3] = m;
  }
  return { ...motif, px: out };
}

/**
 * Place the motif centred on a size x size canvas.
 * `fit`: { fill } = motif width as a share of the canvas, or { radius } = motif bounding circle as a share.
 * `bg`: RGB for a flat background, or null for transparency.
 * Rendered with bilinear sampling at k times the size, then box-averaged down, so small sizes don't alias.
 */
function render(motif, size, fit, bg) {
  const scale = 'fill' in fit ? (fit.fill * size) / motif.w : (fit.radius * size) / motif.r;
  const k = Math.max(1, Math.ceil(0.5 / scale));
  const N = size * k;
  const ss = scale * k;
  const ox = N / 2 - (motif.w * ss) / 2;
  const oy = N / 2 - (motif.h * ss) / 2;
  const { w, h, px } = motif;
  const at = (x, y, c) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : px[(y * w + x) * 4 + c]);

  const acc = new Float32Array(size * size * 4);
  for (let Y = 0; Y < N; Y++) {
    const sy = (Y + 0.5 - oy) / ss - 0.5;
    if (sy < -1 || sy > h) continue;
    const yA = Math.floor(sy);
    const fy = sy - yA;
    for (let X = 0; X < N; X++) {
      const sx = (X + 0.5 - ox) / ss - 0.5;
      if (sx < -1 || sx > w) continue;
      const xA = Math.floor(sx);
      const fx = sx - xA;
      const t = ((Math.floor(Y / k) * size) + Math.floor(X / k)) * 4;
      for (let c = 0; c < 4; c++) {
        const v =
          (at(xA, yA, c) * (1 - fx) + at(xA + 1, yA, c) * fx) * (1 - fy) +
          (at(xA, yA + 1, c) * (1 - fx) + at(xA + 1, yA + 1, c) * fx) * fy;
        acc[t + c] += v;
      }
    }
  }

  const data = new Uint8Array(size * size * 4);
  const kk = k * k;
  for (let i = 0; i < size * size * 4; i += 4) {
    const a = Math.min(1, acc[i + 3] / kk);
    for (let c = 0; c < 3; c++) {
      const p = acc[i + c] / kk;
      data[i + c] = Math.round(bg ? p + (1 - a) * bg[c] : a > 0 ? Math.min(255, p / a) : 0);
    }
    data[i + 3] = bg ? 255 : Math.round(a * 255);
  }
  return { width: size, height: size, data };
}

function blank(width, height, rgb) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return { width, height, data };
}

const flat = (size, rgb) => blank(size, size, rgb);

// ---- contact sheet helpers ----

/** Alpha-composite `tile` onto `dst` at (x, y). */
function over(dst, tile, x, y) {
  for (let ty = 0; ty < tile.height; ty++)
    for (let tx = 0; tx < tile.width; tx++) {
      const s = (ty * tile.width + tx) * 4;
      const d = ((y + ty) * dst.width + (x + tx)) * 4;
      const a = tile.data[s + 3] / 255;
      for (let c = 0; c < 3; c++) dst.data[d + c] = Math.round(tile.data[s + c] * a + dst.data[d + c] * (1 - a));
    }
}

/** Mask a tile to a rounded square of corner radius `cr` (cr = size/2 gives a circle), 4x4 supersampled. */
function mask(tile, inset, cr) {
  const { width: S } = tile;
  const out = { width: S, height: S, data: new Uint8Array(tile.data) };
  const lo = inset;
  const hi = S - inset;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let inside = 0;
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const px = x + (sx + 0.5) / 4;
          const py = y + (sy + 0.5) / 4;
          const cx = Math.min(Math.max(px, lo + cr), hi - cr);
          const cy = Math.min(Math.max(py, lo + cr), hi - cr);
          if (px >= lo && px <= hi && py >= lo && py <= hi && Math.hypot(px - cx, py - cy) <= cr) inside++;
        }
      out.data[(y * S + x) * 4 + 3] = Math.round((tile.data[(y * S + x) * 4 + 3] * inside) / 16);
    }
  return out;
}

function crop(tile, x0, size) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const s = ((y + x0) * tile.width + (x + x0)) * 4;
      data.set(tile.data.subarray(s, s + 4), (y * size + x) * 4);
    }
  return { width: size, height: size, data };
}

function tint(tile, rgb) {
  const data = new Uint8Array(tile.data);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
  }
  return { ...tile, data };
}

/**
 * docs/icon-sizes.png. Rows:
 *   1. app icon at 512 / 192 / 96 / 48 / 32 on white   2. the same on near-black
 *   3. previews at 192: Android adaptive (circle), Android adaptive (rounded square),
 *      Android 13 themed (monochrome), web maskable at its minimum safe circle, splash on parchment.
 */
function contactSheet(motif, mono) {
  const SIZES = [512, 192, 96, 48, 32];
  const GAP = 24;
  const P = 192;
  const W = Math.max(SIZES.reduce((a, s) => a + s + GAP, GAP), 5 * (P + GAP) + GAP);
  const ROW = 512 + 2 * GAP;
  const H = 2 * ROW + P + 2 * GAP;
  const sheet = blank(W, H, [255, 255, 255]);
  over(sheet, blank(W, ROW, [0x12, 0x12, 0x12]), 0, ROW);
  over(sheet, blank(W, P + 2 * GAP, [0xe6, 0xe6, 0xe6]), 0, 2 * ROW);

  for (const row of [0, 1]) {
    let x = GAP;
    for (const s of SIZES) {
      over(sheet, render(motif, s, { fill: FILL }, PARCHMENT), x, row * ROW + GAP + (512 - s) / 2);
      x += s + GAP;
    }
  }

  // Adaptive: the launcher shows the central 72 of 108 dp, so render at 108/72 of the tile and crop.
  const big = Math.round((P * 108) / 72);
  const inset = (big - P) / 2;
  const adaptive = crop(render(motif, big, { radius: FOREGROUND_RADIUS }, PARCHMENT), inset, P);
  const themedFg = tint(crop(render(mono, big, { radius: FOREGROUND_RADIUS }, null), inset, P), [0x2b, 0x33, 0x3b]);
  const themed = flat(P, [0xd8, 0xe2, 0xec]);
  over(themed, themedFg, 0, 0);
  const previews = [
    mask(adaptive, 0, P / 2),
    mask(adaptive, 0, P * 0.22),
    mask(themed, 0, P / 2),
    mask(render(motif, P, { radius: MASKABLE_RADIUS }, PARCHMENT), P * 0.1, P * 0.4),
    (() => {
      const t = flat(P, PARCHMENT);
      over(t, render(motif, P, { fill: FILL }, null), 0, 0);
      return t;
    })(),
  ];
  previews.forEach((t, i) => over(sheet, t, GAP + i * (P + GAP), 2 * ROW + GAP));
  return sheet;
}

/** Writes every icon (and the contact sheet) under `outRoot`; returns the relative paths written. */
export async function makeIcons(outRoot = '.') {
  const motif = extractMotif(await readPng(SOURCE));
  const mono = monochrome(motif);
  const outputs = {
    'assets/icon.png': render(motif, 1024, { fill: FILL }, PARCHMENT),
    'assets/favicon.png': render(motif, 48, { fill: FILL }, PARCHMENT),
    'assets/splash-icon.png': render(motif, 1024, { fill: FILL }, null),
    'assets/android-icon-foreground.png': render(motif, 1024, { radius: FOREGROUND_RADIUS }, null),
    'assets/android-icon-background.png': flat(1024, PARCHMENT),
    'assets/android-icon-monochrome.png': render(mono, 1024, { radius: FOREGROUND_RADIUS }, null),
    'assets/icon-maskable.png': render(motif, 1024, { radius: MASKABLE_RADIUS }, PARCHMENT),
    'docs/icon-sizes.png': contactSheet(motif, mono),
  };
  for (const [rel, img] of Object.entries(outputs)) await writePng(path.join(outRoot, rel), img);
  return Object.keys(outputs);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const written = await makeIcons(process.argv[2] ?? '.');
  console.log(`make-icons: wrote ${written.join(', ')}`);
}
