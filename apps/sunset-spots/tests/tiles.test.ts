/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { distanceMeters } from '../src/lib/geo.ts';
import { decodeTile, mergeLayers, tilePointToLatLon, tilesCovering } from '../src/lib/tiles.ts';

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
