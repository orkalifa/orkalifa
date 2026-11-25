/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeIcons, manifestIcons, readPng, PARCHMENT, type Rgba } from '../scripts/make-icons.mjs';

const ROOT = path.join(import.meta.dirname, '..');
const asset = (name: string) => readPng(path.join(ROOT, 'assets', name));

const px = (img: Rgba, x: number, y: number) => Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
const isParchment = (p: number[]) => Math.hypot(p[0] - PARCHMENT[0], p[1] - PARCHMENT[1], p[2] - PARCHMENT[2]) <= 8;

/** Largest distance from the canvas centre (as a share of the width) of any pixel matching `keep`. */
function reach(img: Rgba, keep: (p: number[]) => boolean) {
  let r = 0;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      if (keep(px(img, x, y))) r = Math.max(r, Math.hypot(x + 0.5 - img.width / 2, y + 0.5 - img.height / 2));
  return r / img.width;
}

test('app icon: 1024 on flat parchment, motif fills ~75-80% of the width', async () => {
  const img = await asset('icon.png');
  assert.equal(img.width, 1024);
  assert.equal(img.height, 1024);
  for (const [x, y] of [[0, 0], [1023, 0], [0, 1023], [1023, 1023]]) assert.deepEqual(px(img, x, y), [...PARCHMENT, 255]);
  let x0 = 1024, x1 = -1;
  for (let y = 0; y < 1024; y += 4)
    for (let x = 0; x < 1024; x++)
      if (!isParchment(px(img, x, y))) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
  const fill = (x1 - x0 + 1) / 1024;
  assert.ok(fill >= 0.74 && fill <= 0.82, `fill ${fill}`);
});

test('Android foreground: transparent outside the motif, motif inside the 66/108 dp safe circle', async () => {
  const img = await asset('android-icon-foreground.png');
  assert.equal(img.width, 1024);
  assert.equal(px(img, 0, 0)[3], 0);
  assert.ok(reach(img, (p) => p[3] > 0) <= 33 / 108, 'motif leaves the safe zone');
});

test('Android background: flat parchment', async () => {
  const img = await asset('android-icon-background.png');
  for (let i = 0; i < img.data.length; i += 4) assert.deepEqual(Array.from(img.data.subarray(i, i + 4)), [...PARCHMENT, 255]);
});

test('Android monochrome: single colour (white) on transparent, with the sun fill cut out', async () => {
  const img = await asset('android-icon-monochrome.png');
  let opaque = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue;
    opaque++;
    assert.ok(img.data[i] >= 250 && img.data[i + 1] >= 250 && img.data[i + 2] >= 250, `pixel ${i / 4} is not white`);
  }
  assert.ok(opaque > 1000, 'monochrome is empty');
  assert.ok(reach(img, (p) => p[3] > 0) <= 33 / 108);
  // The sun's centre (above the hills) is a hole, so the shape reads as ring + hills, not one blob.
  const fg = await asset('android-icon-foreground.png');
  let sunY = 0;
  for (let y = 0; y < 1024 && !sunY; y++) if (px(fg, 512, y)[3] > 200) sunY = y;
  assert.equal(px(img, 512, sunY + 60)[3], 0);
});

test('maskable icon: flat parchment, motif inside the 40% safe circle', async () => {
  const img = await asset('icon-maskable.png');
  assert.equal(img.width, 1024);
  assert.ok(reach(img, (p) => !isParchment(p)) <= 0.4);
});

test('splash icon and favicon exist at the expected sizes', async () => {
  assert.equal((await asset('splash-icon.png')).width, 1024);
  assert.equal((await asset('splash-icon.png')).data[3], 0);
  assert.equal((await asset('favicon.png')).width, 48);
});

test('PWA manifest lists maskable icons next to the regular ones', () => {
  const icons = manifestIcons('/orkalifa/');
  assert.ok(icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512'));
  assert.ok(icons.some((i) => i.purpose === 'any' && i.sizes === '512x512'));
  assert.ok(icons.every((i) => i.src.startsWith('/orkalifa/')));
});

test('app.json points at existing icon files and the parchment background', () => {
  const app = JSON.parse(readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;
  const files = [app.icon, app.web.favicon, ...Object.entries(app.android.adaptiveIcon).filter(([k]) => k.endsWith('Image')).map(([, v]) => v)];
  for (const f of files) assert.ok(existsSync(path.join(ROOT, f as string)), `${f} missing`);
  assert.equal(app.android.adaptiveIcon.backgroundColor, '#F5EDE3');
  assert.equal(app.web.backgroundColor, '#F5EDE3');
});

// Pixels, not PNG bytes: the compressed bytes may differ between zlib versions (local Node vs CI).
test('make-icons is repeatable: a fresh run matches the committed files pixel for pixel', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'icons-'));
  try {
    for (const rel of await makeIcons(dir)) {
      const fresh = await readPng(path.join(dir, rel));
      const committed = await readPng(path.join(ROOT, rel));
      assert.equal(fresh.width, committed.width, rel);
      assert.ok(Buffer.from(fresh.data).equals(Buffer.from(committed.data)), `${rel} differs; run node scripts/make-icons.mjs`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
