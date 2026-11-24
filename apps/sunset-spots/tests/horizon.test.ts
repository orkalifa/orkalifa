/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinationPoint, distanceMeters, bearingDegrees } from '../src/lib/geo.ts';
import {
  SAMPLE_DISTANCES_M,
  elevationAngle,
  elevationRequestUrls,
  horizonFromElevations,
  horizonRequestPoints,
  horizonScore,
  rayOrigin,
  samplePoints,
} from '../src/lib/horizon.ts';

const SPOT = { lat: 31.43, lon: 34.6 };

/** Elevations for [spot, ...samples] from a terrain profile given as a function of distance. */
const profile = (spotElevation: number, at: (d: number) => number) => [spotElevation, ...SAMPLE_DISTANCES_M.map(at)];

test('destinationPoint walks the right distance and direction', () => {
  const p = destinationPoint(SPOT, 259, 10000);
  assert.ok(Math.abs(distanceMeters(SPOT, p) - 10000) < 1);
  assert.ok(Math.abs(bearingDegrees(SPOT, p) - 259) < 0.1);
});

test('samplePoints starts at the spot and follows the sample distances', () => {
  const pts = samplePoints(SPOT, 270);
  assert.equal(pts.length, SAMPLE_DISTANCES_M.length + 1);
  assert.deepEqual(pts[0], SPOT);
  assert.ok(Math.abs(distanceMeters(SPOT, pts.at(-1)!) - SAMPLE_DISTANCES_M.at(-1)!) < 1);
});

test('earth curvature makes distant flat ground sit below eye level', () => {
  assert.ok(elevationAngle(100, 100, 20000) < 0);
  assert.ok(Math.abs(elevationAngle(0, 100, 1000) - 5.71) < 0.05);
});

test('flat open field: the sun is visible to the horizon', () => {
  const flat = Array(SAMPLE_DISTANCES_M.length + 1).fill(120);
  const h = horizonFromElevations(flat);
  assert.ok(h.angle < 0.5, `angle ${h.angle}`);
  assert.equal(h.sea, false);
  assert.ok(horizonScore(h) >= 90);
});

test('a ridge 150 m above the spot 3 km away blocks the sunset', () => {
  const ridge = profile(50, (d) => (d >= 2800 && d <= 3200 ? 200 : 50));
  const h = horizonFromElevations(ridge);
  assert.ok(h.angle > 2.5 && h.angle < 3.1, `angle ${h.angle}`);
  assert.ok(horizonScore(h) < 45);
});

test('a narrow ridge between 1.5 and 3 km is not skipped', () => {
  const ridge = profile(40, (d) => (d >= 2300 && d <= 2700 ? 160 : 40));
  assert.ok(horizonFromElevations(ridge).angle > 2);
});

test('a hilltop looking down to the sea gets the sea bonus', () => {
  const coast = profile(180, (d) => Math.max(0, 180 - d / 60));
  const h = horizonFromElevations(coast);
  assert.equal(h.sea, true);
  assert.equal(horizonScore(h), 100);
});

test('horizonScore falls as the horizon rises', () => {
  const scores = [0, 1, 2, 3, 5, 10].map((angle) => horizonScore({ angle, sea: false }));
  for (let i = 1; i < scores.length; i++) assert.ok(scores[i] <= scores[i - 1]);
  assert.equal(horizonScore({ angle: 20, sea: false }), 10);
});

test('elevation requests are chunked at 100 points', () => {
  const pts = Array.from({ length: 230 }, (_, i) => ({ lat: 31 + i / 1000, lon: 34.5 }));
  const urls = elevationRequestUrls(pts);
  assert.equal(urls.length, 3);
  assert.match(urls[0], /^https:\/\/api\.open-meteo\.com\/v1\/elevation\?latitude=31\.00000,/);
  assert.equal(new URL(urls[2]).searchParams.get('latitude')!.split(',').length, 30);
});

/** [lat, lon] pairs in the order they appear in the request URLs. */
const urlPairs = (urls: string[]) =>
  urls.flatMap((u) => {
    const q = new URL(u).searchParams;
    const lat = q.get('latitude')!.split(',').map(Number);
    const lon = q.get('longitude')!.split(',').map(Number);
    return lat.map((v, i) => [v, lon[i]] as const);
  });

const isRounded = (v: number) => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-9;

test("a saved ('mine') spot leaves the phone only rounded to ~100 m", () => {
  const mine = { id: 'mine/1', kind: 'mine', lat: 31.434567, lon: 34.612345 };
  const pairs = urlPairs(elevationRequestUrls(horizonRequestPoints([mine], 270)));
  assert.equal(pairs.length, SAMPLE_DISTANCES_M.length + 1);
  const [lat, lon] = pairs[0];
  assert.ok(isRounded(lat) && isRounded(lon), `spot point ${lat},${lon} has more than 3 decimals`);
  assert.deepEqual([lat, lon], [31.435, 34.612]);
  for (const [a, b] of pairs) {
    assert.notEqual(a, 31.43457);
    assert.notEqual(b, 34.61235);
  }
});

test('non-saved spots are requested exactly as before', () => {
  const spot = { id: 'node/1', kind: 'viewpoint', lat: 31.434567, lon: 34.612345 };
  assert.deepEqual(elevationRequestUrls(horizonRequestPoints([spot], 270)), elevationRequestUrls(samplePoints(spot, 270)));
  assert.deepEqual(rayOrigin(spot), { lat: spot.lat, lon: spot.lon });
});

test('a mixed list keeps one ray per spot, in order', () => {
  const spots = [
    { id: 'a', kind: 'viewpoint', lat: 31.4, lon: 34.6 },
    { id: 'b', kind: 'mine', lat: 31.123456, lon: 34.654321 },
  ];
  const pts = horizonRequestPoints(spots, 260);
  const per = SAMPLE_DISTANCES_M.length + 1;
  assert.equal(pts.length, 2 * per);
  assert.deepEqual(pts.slice(0, per), samplePoints({ lat: 31.4, lon: 34.6 }, 260));
  assert.deepEqual(pts.slice(per), samplePoints({ lat: 31.123, lon: 34.654 }, 260));
});
