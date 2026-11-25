/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinationPoint, distanceMeters, bearingDegrees } from '../src/lib/geo.ts';
import {
  SAMPLE_DISTANCES_M,
  elevationAngle,
  elevationRequestUrls,
  fetchHorizons,
  horizonFromElevations,
  horizonRequestPoints,
  horizonScore,
  privateLonStep,
  privateOrigin,
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

test("a saved ('mine') spot leaves the phone only snapped to the ~111 m grid", () => {
  const mine = { id: 'mine/1', kind: 'mine', lat: 31.434567, lon: 34.612345 };
  const pairs = urlPairs(elevationRequestUrls(horizonRequestPoints([mine], 270)));
  assert.equal(pairs.length, SAMPLE_DISTANCES_M.length + 1);
  const [lat, lon] = pairs[0];
  assert.ok(isRounded(lat), `spot latitude ${lat} has more than 3 decimals`);
  assert.equal(lat, 31.435);
  // The longitude sits on that latitude's grid: a whole number of steps from 0 (the URL keeps 5 decimals).
  const steps = lon / privateLonStep(31.435);
  assert.ok(Math.abs(steps - Math.round(steps)) < 0.01, `spot longitude ${lon} is off the grid`);
  assert.equal(lon, 34.61198);
  for (const [a, b] of pairs) {
    assert.notEqual(a, 31.43457);
    assert.notEqual(b, 34.61235);
  }
});

test('non-saved spots are requested exactly as before', () => {
  const spot = { id: 'node/1', kind: 'viewpoint', lat: 31.434567, lon: 34.612345 };
  assert.deepEqual(elevationRequestUrls(horizonRequestPoints([spot], 270)), elevationRequestUrls(samplePoints(spot, 270)));
  assert.deepEqual(rayOrigin(spot), { lat: spot.lat, lon: spot.lon });
  // Also with no kind and far from Israel: public places are never snapped.
  assert.deepEqual(rayOrigin({ lat: 59.912345, lon: 10.751234 }), { lat: 59.912345, lon: 10.751234 });
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
  assert.deepEqual(pts.slice(per), samplePoints(privateOrigin({ lat: 31.123456, lon: 34.654321 }), 260));
  assert.notDeepEqual(pts[per], { lat: 31.123456, lon: 34.654321 });
});

// ---- the privacy grid for saved places ----

const METRES_PER_DEG = (Math.PI / 180) * 6371000; // along a meridian (same radius as geo.ts)
const cosDeg = (deg: number) => Math.cos((deg * Math.PI) / 180);

/**
 * Walk in 1 m steps (east from `lon0` along `lat`, or north from `lat` along `lon0`) and return how many
 * steps each privacy cell lasted, i.e. its size in metres. The first and last cells are partial and dropped.
 */
const cellSizes = (lat: number, lon0: number, dir: 'east' | 'north', metres = 2000) => {
  const sizes: number[] = [];
  let prev = '';
  let run = 0;
  for (let i = 0; i <= metres; i++) {
    const p =
      dir === 'east'
        ? { lat, lon: lon0 + i / (METRES_PER_DEG * cosDeg(lat)) }
        : { lat: lat + i / METRES_PER_DEG, lon: lon0 };
    const o = privateOrigin(p);
    const key = `${o.lat},${o.lon}`;
    if (key === prev) run++;
    else {
      if (prev) sizes.push(run);
      prev = key;
      run = 1;
    }
  }
  return sizes.slice(1);
};

const assertCells = (sizes: number[], label: string) => {
  assert.ok(sizes.length >= 10, `${label}: only ${sizes.length} whole cells`);
  for (const s of sizes) assert.ok(s >= 100 && s <= 115, `${label}: a ${s} m cell in ${sizes.join(',')}`);
};

test('privacy grid: in Israel (32°N) a cell is ~111 m both ways', () => {
  assertCells(cellSizes(32.0002, 34.8, 'east'), '32N east-west');
  assertCells(cellSizes(32.0002, 34.8, 'north'), '32N north-south');
});

test('privacy grid: at 60°N a cell is still ≥ 100 m east-west (a fixed 0.001° was ~56 m)', () => {
  assertCells(cellSizes(60.0002, 10.75, 'east'), '60N east-west');
  assertCells(cellSizes(-60.0002, -65, 'east'), '60S east-west');
});

test('privacy grid: no latitude gets an east-west cell narrower than north-south', () => {
  for (let lat = -89.5; lat <= 89.5; lat += 0.5) {
    const width = privateLonStep(lat) * METRES_PER_DEG * cosDeg(lat);
    assert.ok(width >= 111 && width < 112, `${lat}: ${width} m`);
  }
  for (const lat of [89.9, 89.99, 89.999]) {
    const width = privateLonStep(lat) * METRES_PER_DEG * cosDeg(lat);
    assert.ok(width >= 100 && width < 120, `${lat}: ${width} m`);
  }
});

test('privacy grid: near and at the poles it stays finite and in range', () => {
  for (const lat of [89.4, 89.9, 89.999, 89.9996, 90, 95, -89.9, -89.9996, -90, -95]) {
    for (const lon of [-180, -0.1, 0, 33.3, 179.99]) {
      const o = privateOrigin({ lat, lon });
      assert.ok(Number.isFinite(o.lat) && Number.isFinite(o.lon), `${lat},${lon} -> ${o.lat},${o.lon}`);
      assert.ok(o.lat >= -90 && o.lat <= 90 && o.lon >= -180 && o.lon < 180, `${lat},${lon} -> ${o.lat},${o.lon}`);
    }
  }
  // At the pole itself every longitude is the same place, so they all snap to one point.
  const atPole = new Set([-180, -90, 0, 45, 179.9].map((lon) => JSON.stringify(privateOrigin({ lat: 90, lon }))));
  assert.equal(atPole.size, 1);
});

test('privacy grid: longitudes wrap into [-180, 180) and no thin cell sits on the antimeridian', () => {
  const seam = [180, -180, 540, -540].map((lon) => privateOrigin({ lat: 32, lon }));
  for (const o of seam) assert.deepEqual(o, seam[0]);
  // lat 0 and 60 have an even number of cells (one centred on ±180), lat 32 an odd one.
  for (const lat of [0, 32, 60]) {
    for (const lon of [179.9999, 179.99999, -179.9999, 180, 359.9]) {
      const o = privateOrigin({ lat, lon });
      assert.ok(o.lon >= -180 && o.lon < 180, `${lat},${lon} -> ${o.lon}`);
    }
  }
  for (const lat of [0, 32, 60, -17.8]) assertCells(cellSizes(lat + 0.0002, 179.99, 'east'), `seam at ${lat}`);
});

test('privacy grid: snapping is deterministic and idempotent', () => {
  const places = [
    { lat: 31.434567, lon: 34.612345 },
    { lat: 59.91234, lon: 10.75111 },
    { lat: -33.85678, lon: 151.21543 },
    { lat: -17.71234, lon: -179.99876 },
    { lat: 64.14321, lon: -21.94211 },
  ];
  for (const p of places) {
    const o = privateOrigin(p);
    assert.deepEqual(privateOrigin({ ...p }), o);
    assert.deepEqual(privateOrigin(o), o);
    assert.deepEqual(rayOrigin({ ...p, kind: 'mine' }), o);
  }
});

// ---- fetchHorizons with a mocked fetch (no network) ----

const pointCount = (url: unknown) => new URL(String(url)).searchParams.get('latitude')!.split(',').length;

/** A fetch answering flat ground for as many points as the URL asks for. */
const flatFetch = (status = 200) => async (input: unknown) =>
  new Response(JSON.stringify({ elevation: Array(pointCount(input)).fill(10) }), { status });

const manySpots = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, lat: 31.4 + i / 100, lon: 34.6 }));

test('fetchHorizons: 7 spots × 17 points go in two requests and parse per spot', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', flatFetch());
  const result = await fetchHorizons(manySpots(7), 260);
  assert.equal(mock.mock.callCount(), 2);
  assert.deepEqual(mock.mock.calls.map((c) => pointCount(c.arguments[0])), [100, 19]);
  assert.deepEqual(Object.keys(result), manySpots(7).map((s) => s.id));
  for (const h of Object.values(result)) assert.ok(h.angle < 0.5 && !h.sea);
});

test("fetchHorizons: a saved place's exact position is in no request; the signal is passed on", async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', flatFetch());
  const controller = new AbortController();
  await fetchHorizons([{ id: 'm', kind: 'mine', lat: 31.123456, lon: 34.654321 }], 260, controller.signal);
  const url = String(mock.mock.calls[0].arguments[0]);
  assert.ok(!url.includes('31.12346') && !url.includes('34.65432'), url);
  assert.ok(url.includes('31.12300'), url);
  assert.equal((mock.mock.calls[0].arguments[1] as RequestInit).signal, controller.signal);
});

test('fetchHorizons: an HTTP error on any chunk rejects', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (input: unknown) => flatFetch(++calls === 2 ? 500 : 200)(input));
  await assert.rejects(fetchHorizons(manySpots(7), 260), /Open-Meteo 500/);
});

test('fetchHorizons: a partial or empty answer rejects instead of misaligning spots', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ elevation: Array(16).fill(10) })));
  await assert.rejects(fetchHorizons(manySpots(1), 260), /mismatch/);
  mock.mock.mockImplementation(async () => new Response(JSON.stringify({ error: true, reason: 'x' })));
  await assert.rejects(fetchHorizons(manySpots(1), 260), /mismatch/);
});
