/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colors, floating, hairline, pill, title } from '../src/theme.ts';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(rgb(a)), luminance(rgb(b))].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const HEX = /^#[0-9A-F]{6}$/i;

test('two-tone title: both lines readable (4.5:1) on every light surface', () => {
  for (const bg of [colors.ground, colors.sheet, colors.surface, colors.sand, colors.sandSoft]) {
    for (const c of [title.ink, title.soft]) assert.ok(contrast(c, bg) >= 4.5, `${c} on ${bg}: ${contrast(c, bg).toFixed(2)}`);
  }
  for (const bg of [colors.obsidian, colors.obsidianSoft]) {
    for (const c of [title.nightInk, title.nightSoft]) assert.ok(contrast(c, bg) >= 4.5, `${c} on ${bg}: ${contrast(c, bg).toFixed(2)}`);
  }
});

test('two-tone title: the second line is really a second tone', () => {
  assert.ok(contrast(title.ink, title.soft) >= 2, 'light: soft too close to ink');
  assert.ok(contrast(title.nightInk, title.nightSoft) >= 1.2, 'dark: soft too close to ink');
});

test('primary pill: white on black, strong contrast, 44 px tall, fully round', () => {
  assert.ok(contrast(pill.text, pill.bg) >= 7);
  assert.ok(pill.minHeight >= 44);
  assert.equal(pill.radius, 999);
});

test('floating button: 44 px round white target with a very soft shadow', () => {
  assert.ok(floating.size >= 44);
  assert.equal(floating.radius, floating.size / 2);
  assert.match(floating.bg, HEX);
  const alpha = Number(/rgba\([^)]*,\s*([0-9.]+)\)$/.exec(floating.boxShadow)?.[1]);
  assert.ok(alpha > 0 && alpha <= 0.12, `shadow alpha ${alpha}`);
});

test('tokens are well-formed colours', () => {
  for (const c of Object.values(title)) assert.match(c, HEX);
  for (const c of [pill.bg, pill.text]) assert.match(c, HEX);
  for (const c of Object.values(hairline)) assert.match(c, /^rgba\(\d+, \d+, \d+, 0?\.\d+\)$/);
});
