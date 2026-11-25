/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privateLonStep } from '../src/lib/horizon.ts';
import {
  SKY_STEP_DEG,
  fetchSkyVerdict,
  forecastUrl,
  hourAt,
  rateSunset,
  skyCell,
  skyRequestKey,
  verdictFromForecast,
} from '../src/lib/sky.ts';

const sky = (low: number, mid: number, high: number, rain = 0) => ({ low, mid, high, rain });

test('high clouds over a clear horizon: a colourful sunset', () => {
  assert.equal(rateSunset(sky(5, 20, 50), 10).tone, 'great');
});

test('low cloud on the horizon hides the sun, even under nice high clouds', () => {
  assert.equal(rateSunset(sky(5, 20, 50), 85).tone, 'poor');
});

test('rain, a low overcast, or a fully covered sky are poor', () => {
  assert.equal(rateSunset(sky(10, 30, 40, 80), 0).label, 'צפוי גשם');
  assert.equal(rateSunset(sky(90, 0, 0), 0).tone, 'poor');
  assert.equal(rateSunset(sky(10, 95, 95), 0).label, 'שמיים מכוסים');
});

test('no clouds at all: clear, nice but plain', () => {
  assert.equal(rateSunset(sky(0, 5, 3), 0).tone, 'clear');
});

test('in between: worth a try', () => {
  assert.equal(rateSunset(sky(55, 10, 10), 20).tone, 'ok');
});

test('the forecast URL asks for both places, snapped to the ~1.1 km sky grid', () => {
  const url = new URL(forecastUrl({ lat: 32.08531, lon: 34.77004 }, 260));
  // Exactly these strings: here (32.09, 34.7747) and the point ~40 km west of it, both on the grid.
  assert.equal(url.searchParams.get('latitude'), '32.09,32.03');
  assert.equal(url.searchParams.get('longitude'), '34.7747,34.3627');
  const lats = url.searchParams.get('latitude')!.split(',').map(Number);
  const lons = url.searchParams.get('longitude')!.split(',').map(Number);
  lons.forEach((lon, i) => {
    const steps = lon / privateLonStep(lats[i], SKY_STEP_DEG);
    assert.ok(Math.abs(steps - Math.round(steps)) < 0.01, `longitude ${lon} is off the grid at ${lats[i]}`);
  });
});

// ---- the sky grid ----

const METRES_PER_DEG = (Math.PI / 180) * 6371000; // along a meridian (same radius as geo.ts)
const cosDeg = (deg: number) => Math.cos((deg * Math.PI) / 180);
const TARGET_M = SKY_STEP_DEG * METRES_PER_DEG; // ~1112 m, the cell's north-south size

test('sky grid: an east-west cell is never narrower than ~1.1 km, even at its poleward edge', () => {
  for (const lat of [0, 31.8, 60, 75, 89.99, -31.8, -60, -75, -89.99]) {
    const step = privateLonStep(lat, SKY_STEP_DEG);
    const edge = step * METRES_PER_DEG * cosDeg(Math.abs(lat) + SKY_STEP_DEG / 2);
    assert.ok(Number.isFinite(step) && step > 0 && step <= 360, `${lat}: step ${step}`);
    assert.ok(edge >= TARGET_M, `${lat}: poleward edge ${edge} m < ${TARGET_M} m`);
    // Away from the pole it stays close to square (a fixed 0.01° was ~944 m at 31.8° and ~556 m at 60°).
    if (Math.abs(lat) <= 75) assert.ok(edge < 1.02 * TARGET_M, `${lat}: ${edge} m`);
  }
});

/** Walk 1 m at a time (east, or north) and return each whole sky cell's size in metres. */
const skyCellSizes = (lat: number, lon0: number, dir: 'east' | 'north', metres = 12000) => {
  const sizes: number[] = [];
  let prev = '';
  let run = 0;
  for (let i = 0; i <= metres; i++) {
    const p =
      dir === 'east'
        ? { lat, lon: lon0 + i / (METRES_PER_DEG * cosDeg(lat)) }
        : { lat: lat + i / METRES_PER_DEG, lon: lon0 };
    const o = skyCell(p);
    const key = `${o.lat},${o.lon}`;
    if (key === prev) run++;
    else {
      if (prev) sizes.push(run);
      prev = key;
      run = 1;
    }
  }
  return sizes.slice(1); // the first and last cells are partial
};

test('sky grid: walking east, every cell is ~1.1 km wide (Israel, 60°N, 75°N, across the antimeridian)', () => {
  const walks: [number, number, 'east' | 'north'][] = [
    [31.8002, 34.8, 'east'],
    [31.8002, 34.8, 'north'],
    [60.0002, 10.75, 'east'],
    [75.0002, 20, 'east'],
    [0.0002, 179.95, 'east'],
    [-17.8002, 179.95, 'east'],
  ];
  for (const [lat, lon, dir] of walks) {
    const sizes = skyCellSizes(lat, lon, dir);
    assert.ok(sizes.length >= 8, `${lat},${lon} ${dir}: only ${sizes.length} whole cells`);
    for (const s of sizes) assert.ok(s >= 1100 && s <= 1130, `${lat},${lon} ${dir}: a ${s} m cell in ${sizes.join(',')}`);
  }
});

test('sky grid: poles and antimeridian stay finite, in range and idempotent', () => {
  for (const lat of [89.99, 89.996, 90, 95, -89.99, -90, -95, 0, 32]) {
    for (const lon of [-540, -180, -0.001, 0, 179.999, 180, 540]) {
      const o = skyCell({ lat, lon });
      const at = `${lat},${lon} -> ${o.lat},${o.lon}`;
      assert.ok(Number.isFinite(o.lat) && Number.isFinite(o.lon), at);
      assert.ok(o.lat >= -90 && o.lat <= 90 && o.lon >= -180 && o.lon < 180, at);
      assert.deepEqual(skyCell(o), o, `not idempotent: ${at}`);
    }
  }
  // The same place either side of the seam is one cell.
  const seam = [180, -180, 540, -540].map((lon) => skyCell({ lat: 32, lon }));
  for (const o of seam) assert.deepEqual(o, seam[0]);
  // The far point, even over the pole or across the seam, is a finite grid point too.
  for (const [here, bearing] of [
    [{ lat: 89.99, lon: 179.999 }, 300],
    [{ lat: -89.99, lon: -180 }, 250],
    [{ lat: 0, lon: 179.999 }, 90],
    [{ lat: 0, lon: -179.999 }, 270],
  ] as const) {
    const q = new URL(forecastUrl(here, bearing)).searchParams;
    const lats = q.get('latitude')!.split(',').map(Number);
    const lons = q.get('longitude')!.split(',').map(Number);
    for (const v of [...lats, ...lons]) assert.ok(Number.isFinite(v), `${JSON.stringify(here)}: ${v}`);
    for (const v of lons) assert.ok(v >= -180 && v < 180, `${JSON.stringify(here)}: lon ${v}`);
  }
});

test("skyRequestKey: stable inside a cell, so useSky doesn't refetch, and it is exactly what is requested", () => {
  const centre = skyCell({ lat: 31.8, lon: 34.8 });
  const step = privateLonStep(centre.lat, SKY_STEP_DEG);
  const T = Date.UTC(2026, 5, 21, 16, 49, 0);
  const rawA = { latitude: centre.lat - 0.004, longitude: centre.lon + 0.4 * step };
  const rawB = { latitude: centre.lat + 0.004, longitude: centre.lon - 0.4 * step };
  const a = skyRequestKey(rawA, 259.6, new Date(T - 20000));
  const b = skyRequestKey(rawB, 260.4, new Date(T + 20000));
  assert.deepEqual(a, { lat: centre.lat, lon: centre.lon, bearing: 260, sunsetMs: T });
  assert.deepEqual(b, a);
  // Same rounding as the request: the key's values are what the URL carries, and any raw position in
  // the cell gives the very same URL.
  const fromKey = forecastUrl({ lat: a!.lat, lon: a!.lon }, a!.bearing);
  assert.equal(forecastUrl({ lat: rawA.latitude, lon: rawA.longitude }, a!.bearing), fromKey);
  assert.equal(forecastUrl({ lat: rawB.latitude, lon: rawB.longitude }, a!.bearing), fromKey);
  const q = new URL(fromKey).searchParams;
  assert.ok(q.get('latitude')!.startsWith(`${a!.lat},`) && q.get('longitude')!.startsWith(`${a!.lon},`), fromKey);
  // One cell over is a new key.
  const next = skyRequestKey({ latitude: centre.lat, longitude: centre.lon + step }, 260, new Date(T));
  assert.notEqual(next!.lon, a!.lon);
});

test('skyRequestKey: nothing to fetch for missing or non-finite input', () => {
  const here = { latitude: 32.08531, longitude: 34.77004 };
  const sunset = new Date(1001 * 3600 * 1000);
  assert.equal(skyRequestKey(null, 260, sunset), null);
  assert.equal(skyRequestKey(here, null, sunset), null);
  assert.equal(skyRequestKey(here, 260, null), null);
  assert.equal(skyRequestKey({ latitude: NaN, longitude: 34.77 }, 260, sunset), null);
  assert.equal(skyRequestKey({ latitude: 32.08, longitude: Infinity }, 260, sunset), null);
  assert.equal(skyRequestKey(here, NaN, sunset), null);
  assert.equal(skyRequestKey(here, 260, new Date(NaN)), null);
});

const hourly = (low: number, high: number) => ({
  time: [1000 * 3600, 1001 * 3600, 1002 * 3600],
  cloud_cover_low: [90, low, 90],
  cloud_cover_mid: [0, 10, 0],
  cloud_cover_high: [0, high, 0],
  precipitation_probability: [0, 0, 0],
});

test('the forecast hour nearest sunset is used', () => {
  const sunset = new Date((1001 * 3600 + 600) * 1000);
  assert.deepEqual(hourAt(hourly(5, 60), sunset), { low: 5, mid: 10, high: 60, rain: 0 });
  assert.equal(hourAt(hourly(5, 60), new Date(2000 * 3600 * 1000)), null, 'beyond the forecast');
});

test('a two-place forecast answer turns into a verdict', () => {
  const sunset = new Date(1001 * 3600 * 1000);
  assert.equal(verdictFromForecast([{ hourly: hourly(5, 60) }, { hourly: hourly(10, 0) }], sunset)?.tone, 'great');
  assert.equal(verdictFromForecast([{ hourly: hourly(5, 60) }, { hourly: hourly(80, 0) }], sunset)?.tone, 'poor');
  assert.equal(verdictFromForecast({ error: true }, sunset), null);
});

// ---- fetchSkyVerdict with a mocked fetch (no network) ----

const HERE = { lat: 32.08531, lon: 34.77004 };
const SUNSET = new Date(1001 * 3600 * 1000);
const answer = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

test('fetchSkyVerdict: one request, snapped to the ~1.1 km grid, parsed into a verdict', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', answer([{ hourly: hourly(5, 60) }, { hourly: hourly(10, 0) }]));
  const verdict = await fetchSkyVerdict(HERE, 260, SUNSET);
  assert.equal(verdict?.tone, 'great');
  assert.equal(mock.mock.callCount(), 1);
  const url = String(mock.mock.calls[0].arguments[0]);
  assert.equal(url, forecastUrl(HERE, 260));
  const q = new URL(url).searchParams;
  for (const v of q.get('latitude')!.split(',')) assert.match(v, /^-?\d+(\.\d{1,2})?$/, `latitude ${v} has at most 2 decimals`);
  for (const v of q.get('longitude')!.split(',')) assert.match(v, /^-?\d+(\.\d{1,4})?$/, `longitude ${v} has at most 4 decimals`);
  assert.ok(!url.includes('32.085') && !url.includes('34.770'), 'exact position not sent');
  assert.equal(q.get('timeformat'), 'unixtime');
});

test('fetchSkyVerdict: an HTTP error rejects', async (t) => {
  t.mock.method(globalThis, 'fetch', answer({ error: true }, 503));
  await assert.rejects(fetchSkyVerdict(HERE, 260, SUNSET), /HTTP 503/);
});

test('fetchSkyVerdict: a partial answer gives no verdict instead of throwing', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', answer([{ hourly: hourly(5, 60) }]));
  assert.equal(await fetchSkyVerdict(HERE, 260, SUNSET), null, 'only one place');
  mock.mock.mockImplementation(answer([{ hourly: hourly(5, 60) }, {}]));
  assert.equal(await fetchSkyVerdict(HERE, 260, SUNSET), null, 'horizon place without hourly');
  mock.mock.mockImplementation(answer([{ hourly: hourly(5, 60) }, { hourly: hourly(10, 0) }]));
  assert.equal(await fetchSkyVerdict(HERE, 260, new Date(2000 * 3600 * 1000)), null, 'sunset beyond the forecast');
});

test('fetchSkyVerdict: missing cloud values count as clear', async (t) => {
  const none = [null, null, null];
  const gaps = { ...hourly(0, 0), cloud_cover_low: none, cloud_cover_mid: none, cloud_cover_high: none };
  t.mock.method(globalThis, 'fetch', answer([{ hourly: gaps }, { hourly: gaps }]));
  assert.equal((await fetchSkyVerdict(HERE, 260, SUNSET))?.tone, 'clear');
});
