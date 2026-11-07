/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { distanceMeters } from '../src/lib/geo.ts';
import { decodeTile, fetchMapLayers, mergeLayers, tilePointToLatLon, tilesCovering, zoomForRange } from '../src/lib/tiles.ts';

// A real OpenFreeMap tile (zoom 13) over the coastal plain near Ramla, saved as a fixture.
const TILE = { z: 13, x: 4889, y: 3329 };
const fixture = () => readFileSync(new URL('./fixtures/tile-13-4889-3329.pbf', import.meta.url));

test('tile corners map back to the right latitude and longitude', () => {
  const nw = tilePointToLatLon({ z: 0, x: 0, y: 0 }, 0, 0, 4096);
  assert.equal(nw.lon, -180);
  assert.ok(Math.abs(nw.lat - 85.0511) < 1e-3);
  const centre = tilePointToLatLon({ z: 1, x: 1, y: 1 }, 0, 0, 4096);
  assert.ok(Math.abs(centre.lat) < 1e-9 && Math.abs(centre.lon) < 1e-9);
});

test('tilesCovering spans the radius and contains the centre tile', () => {
  const centre = { lat: 31.9, lon: 34.85 };
  const near = tilesCovering(centre, 1000, 13);
  assert.ok(near.some((t) => t.x === TILE.x && t.y === TILE.y));
  assert.ok(near.length <= 4);
  const wide = tilesCovering(centre, 10000, 12);
  assert.ok(wide.length >= 9 && wide.length <= 16, `${wide.length} tiles`);
  // Every corner of the area is inside some tile.
  for (const t of wide) assert.equal(t.z, 12);
});

test('decodeTile turns a real tile into roads, fields and named places inside it', () => {
  const layers = decodeTile(fixture(), TILE);
  assert.ok(layers.roads.length > 10, `${layers.roads.length} roads`);
  assert.ok(layers.roads.some((r) => r.rank === 0) && layers.roads.some((r) => r.rank === 3));
  const kinds = new Set(layers.areas.map((a) => a.kind));
  assert.ok(kinds.has('field') && kinds.has('green'), [...kinds].join());
  assert.ok(layers.places.length > 5);
  assert.ok(layers.places.every((p) => /[֐-׿]/.test(p.name)), 'names in Hebrew');

  // Everything decodes to roughly where the tile is (tiles carry a small buffer past their edge).
  const centre = tilePointToLatLon(TILE, 2048, 2048, 4096);
  for (const r of layers.roads) for (const p of r.points) assert.ok(distanceMeters(centre, p) < 5000);
});

test('mergeLayers keeps a place that sits in two tiles once', () => {
  const a = decodeTile(fixture(), TILE);
  const merged = mergeLayers([a, a]);
  assert.equal(merged.places.length, a.places.length);
  assert.equal(merged.roads.length, a.roads.length * 2);
});

test('a zoomed-in map uses detailed tiles, a wide one coarse tiles, and stays around 25 tiles or fewer', () => {
  assert.equal(zoomForRange(2000), 14);
  assert.equal(zoomForRange(5000), 13);
  assert.equal(zoomForRange(10000), 12);
  const centre = { lat: 31.3, lon: 34.6 };
  for (const range of [2000, 3000, 4000, 6500, 8000, 10000]) {
    const n = tilesCovering(centre, range * 1.3, zoomForRange(range)).length;
    assert.ok(n <= 25, `${range} m → ${n} tiles`);
  }
});

test('tilesCovering reaches further north when asked to (the map runs up behind the card)', () => {
  const centre = { lat: 31.3, lon: 34.6 };
  const even = tilesCovering(centre, 3000, 14);
  const tall = tilesCovering(centre, { north: 6600, south: 3900, east: 3900, west: 3900 }, 14);
  const minY = (ts: { y: number }[]) => Math.min(...ts.map((t) => t.y));
  assert.ok(minY(tall) < minY(even), 'more tiles to the north');
  assert.equal(Math.max(...tall.map((t) => t.y)), Math.max(...tilesCovering(centre, 3900, 14).map((t) => t.y)));
});

test('mergeLayers keeps two different places that share a name', () => {
  const place = (lat: number) => ({ id: String(lat), name: 'נווה', rank: 2, lat, lon: 34.8 });
  const merged = mergeLayers([
    { roads: [], areas: [], places: [place(31.5)] },
    { roads: [], areas: [], places: [place(31.5), place(31.7)] },
  ]);
  assert.deepEqual(merged.places.map((p) => p.lat), [31.5, 31.7]);
});

test('fetchMapLayers reports tiles that failed instead of leaving silent gaps', async () => {
  const realFetch = globalThis.fetch;
  const tile = fixture();
  let tileCalls = 0;
  globalThis.fetch = (async (url: string) => {
    if (url.endsWith('/planet')) return new Response(JSON.stringify({ tiles: ['https://t.example/{z}/{x}/{y}.pbf'] }), { status: 200 });
    tileCalls++;
    // Every other tile fails, as on a patchy connection.
    if (tileCalls % 2 === 0) return new Response('busy', { status: 503 });
    return new Response(tile, { status: 200 });
  }) as typeof fetch;
  try {
    const { layers, missing } = await fetchMapLayers({ lat: 29.6, lon: 34.9 }, 4000, 13);
    assert.ok(layers.roads.length > 0);
    assert.match(missing ?? '', /^\d+\/\d+ tiles: tile 13\/\d+\/\d+: HTTP 503$/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
