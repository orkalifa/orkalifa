import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CREDIT_HOSTS,
  CREDIT_ITEMS,
  CREDIT_URLS,
  FOOTER_MAP_LINE,
  FOOTER_WEATHER_LABEL,
  FOOTER_WEATHER_PREFIX,
  MAP_CREDIT_LABEL,
} from '../src/lib/credits.ts';

const ROOT = join(import.meta.dirname, '..');

// Bidi controls, zero-width characters, and other control characters: keep them out of source files.
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/;

test('every credit URL is https and points at an allowed host', () => {
  for (const url of Object.values(CREDIT_URLS)) {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, 'https:', url);
    assert.ok((CREDIT_HOSTS as readonly string[]).includes(parsed.hostname), `host not allowed: ${parsed.hostname}`);
  }
});

test('the required licence links are present', () => {
  assert.equal(CREDIT_URLS.osmCopyright, 'https://www.openstreetmap.org/copyright');
  assert.equal(CREDIT_URLS.odbl, 'https://opendatacommons.org/licenses/odbl/');
  assert.equal(CREDIT_URLS.openMeteo, 'https://open-meteo.com/');
  assert.equal(CREDIT_URLS.ccBy, 'https://creativecommons.org/licenses/by/4.0/');
});

test('the map credit names OpenStreetMap contributors', () => {
  assert.equal(MAP_CREDIT_LABEL, '© OpenStreetMap contributors');
});

test('the footer names the map data, tiles, and Open-Meteo for both forecast and elevation', () => {
  assert.ok(FOOTER_MAP_LINE.includes('© OpenStreetMap contributors'));
  assert.ok(FOOTER_MAP_LINE.includes('OpenFreeMap © OpenMapTiles'));
  assert.ok(FOOTER_WEATHER_PREFIX.includes('תחזית השקיעה'));
  assert.ok(FOOTER_WEATHER_PREFIX.includes('גובה'));
  assert.equal(FOOTER_WEATHER_LABEL, 'Open-Meteo.com');
});

test('the credits sheet states ODbL and CC BY 4.0 with their links', () => {
  const text = CREDIT_ITEMS.map((item) => item.text).join('\n');
  assert.ok(text.includes('© OpenStreetMap contributors'));
  assert.ok(text.includes('ODbL'));
  assert.ok(text.includes('OpenFreeMap © OpenMapTiles'));
  assert.ok(text.includes('Open-Meteo'));
  assert.ok(text.includes('CC BY 4.0'));
  const urls = CREDIT_ITEMS.flatMap((item) => (item.links ?? []).map((link) => link.url));
  assert.ok(urls.includes(CREDIT_URLS.odbl));
  assert.ok(urls.includes(CREDIT_URLS.ccBy));
  assert.ok(urls.includes(CREDIT_URLS.openMeteo));
});

test('credit texts contain no bidi or control characters', () => {
  const all = [
    FOOTER_MAP_LINE,
    FOOTER_WEATHER_PREFIX,
    FOOTER_WEATHER_LABEL,
    MAP_CREDIT_LABEL,
    ...CREDIT_ITEMS.map((item) => item.text),
    ...CREDIT_ITEMS.flatMap((item) => (item.links ?? []).map((link) => link.label)),
  ];
  for (const text of all) assert.equal(INVISIBLE.test(text), false, JSON.stringify(text));
});

test('R7 source files contain no bidi or control characters', () => {
  const files = [
    'src/lib/credits.ts',
    'src/components/ExternalLink.tsx',
    'src/components/CreditsSheet.tsx',
    'src/components/SpotMap.tsx',
    'src/app/index.tsx',
  ];
  for (const file of files) {
    const source = readFileSync(join(ROOT, file), 'utf8');
    assert.equal(INVISIBLE.test(source), false, `invisible character in ${file}`);
  }
});
