/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceMeters } from '../src/lib/geo.ts';
import { mergeNearby, type Candidate } from '../src/lib/osm.ts';
import { readFileSync } from 'node:fs';
import { validateSpots, MIN_SPOTS } from '../scripts/spots-build.ts';

test('bundled spots-il.json has enough spots and a valid shape', () => {
  const real: unknown = JSON.parse(readFileSync(new URL('../src/data/spots-il.json', import.meta.url), 'utf8'));
  assert.ok(Array.isArray(real), 'is an array');
  assert.ok(real.length >= MIN_SPOTS, `has ${real.length} spots`);
  const result = validateSpots(real);
  assert.deepEqual(result.errors, []);
  assert.ok(result.ok);
});

// Tel Aviv center – should be inside Israel bounds
const TEL_AVIV = { lat: 32.08, lon: 34.78 };

// Paris – should be outside Israel bounds
const PARIS = { lat: 48.86, lon: 2.35 };

// Israel bounding box (must match useSpots.ts)
const IL_BOUNDS = { south: 29.45, north: 33.34, west: 34.27, east: 35.85 };

function isInIsrael(lat: number, lon: number): boolean {
  return lat >= IL_BOUNDS.south && lat <= IL_BOUNDS.north && lon >= IL_BOUNDS.west && lon <= IL_BOUNDS.east;
}

test('isInIsrael returns true for Tel Aviv', () => {
  assert.ok(isInIsrael(TEL_AVIV.lat, TEL_AVIV.lon));
});

test('isInIsrael returns false for Paris', () => {
  assert.ok(!isInIsrael(PARIS.lat, PARIS.lon));
});

test('isInIsrael returns true for Eilat (south)', () => {
  assert.ok(isInIsrael(29.56, 34.95));
});

test('isInIsrael returns true for Golan (north-east)', () => {
  assert.ok(isInIsrael(33.2, 35.75));
});

test('isInIsrael returns false for Amman, Jordan', () => {
  assert.ok(!isInIsrael(31.95, 35.93));
});

test('radius filter keeps only nearby spots', () => {
  const spots: Candidate[] = [
    { id: 'node/1', kind: 'viewpoint', lat: 32.081, lon: 34.781, tags: {} },   // ~130m from TEL_AVIV
    { id: 'node/2', kind: 'bench', lat: 32.09, lon: 34.78, tags: {} },         // ~1112m from TEL_AVIV
    { id: 'node/3', kind: 'peak', lat: 33.0, lon: 35.0, tags: {} },            // ~103km – way outside radius
  ];

  const RADIUS = 2000; // 2 km
  const filtered = spots.filter((s) => distanceMeters(s, { lat: TEL_AVIV.lat, lon: TEL_AVIV.lon }) <= RADIUS);
  assert.equal(filtered.length, 2, 'should keep the two nearby spots');
  assert.deepEqual(filtered.map((s) => s.id), ['node/1', 'node/2']);
});

test('radius filter returns empty when all spots are far', () => {
  const spots: Candidate[] = [
    { id: 'node/1', kind: 'viewpoint', lat: 33.0, lon: 35.0, tags: {} },
    { id: 'node/2', kind: 'bench', lat: 29.5, lon: 34.5, tags: {} },
  ];

  const RADIUS = 1000; // 1 km
  const filtered = spots.filter((s) => distanceMeters(s, { lat: TEL_AVIV.lat, lon: TEL_AVIV.lon }) <= RADIUS);
  assert.equal(filtered.length, 0);
});

test('mergeNearby works on bundled-style spots', () => {
  const spots: Candidate[] = [
    { id: 'node/1', kind: 'viewpoint', name: 'Sunset Point', lat: 32.081, lon: 34.781, tags: {} },
    { id: 'node/2', kind: 'bench', lat: 32.08102, lon: 34.78102, tags: {} }, // ~2m from node/1
    { id: 'node/3', kind: 'peak', name: 'Mountain', lat: 32.5, lon: 35.0, tags: {} },
  ];

  const merged = mergeNearby(spots);
  assert.equal(merged.length, 2, 'bench should merge into viewpoint');
  const vp = merged.find((s) => s.kind === 'viewpoint')!;
  assert.deepEqual(vp.nearby, ['bench']);
});
