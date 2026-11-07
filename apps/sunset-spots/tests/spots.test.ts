/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bearingDegrees, distanceMeters, formatDistance } from '../src/lib/geo.ts';
import { buildOverpassQuery, mergeNearby, parseOverpass } from '../src/lib/osm.ts';
import { parseDirection, rankSpots, scoreSpot } from '../src/lib/score.ts';

const HOME = { lat: 32.08, lon: 34.78 };
const SUNSET = 259;

// Shape of a real Overpass `out center tags` response: nodes carry lat/lon, ways carry center.
const FIXTURE = {
  elements: [
    { type: 'node', id: 1, lat: 32.081, lon: 34.775, tags: { amenity: 'bench', backrest: 'yes' } },
    { type: 'node', id: 2, lat: 32.08102, lon: 34.77502, tags: { amenity: 'bench' } },
    { type: 'node', id: 3, lat: 32.09, lon: 34.76, tags: { tourism: 'viewpoint', name: 'תצפית הים', direction: 'W' } },
    { type: 'way', id: 4, center: { lat: 32.07, lon: 34.79 }, tags: { tourism: 'picnic_site', name: 'Picnic', 'name:he': 'חורשת הפיקניק' } },
    { type: 'node', id: 5, lat: 32.1, lon: 34.8, tags: { tourism: 'viewpoint', direction: 'E' } },
    { type: 'node', id: 6, lat: 32.1, lon: 34.8, tags: { shop: 'bakery' } },
    { type: 'way', id: 7, tags: { amenity: 'bench' } },
  ],
} as const;

test('geo helpers', () => {
  assert.ok(Math.abs(distanceMeters(HOME, { lat: 32.09, lon: 34.78 }) - 1112) < 5);
  assert.ok(Math.abs(bearingDegrees(HOME, { lat: 32.08, lon: 34.7 }) - 270) < 1);
  assert.equal(formatDistance(347), "350 מ'");
  assert.equal(formatDistance(2345), '2.3 ק"מ');
});

test('overpass query asks for every spot type around the user', () => {
  const q = buildOverpassQuery(HOME, 5000);
  assert.match(q, /^\[out:json\]/);
  assert.match(q, /nwr\(around:5000,32\.08,34\.78\)\["tourism"="viewpoint"\];/);
  assert.match(q, /\["amenity"="bench"\]/);
  assert.match(q, /out center tags;$/);
});

test('parseOverpass keeps known spot types, uses way centers and Hebrew names', () => {
  const spots = parseOverpass(FIXTURE as never);
  assert.deepEqual(spots.map((s) => s.id), ['node/1', 'node/2', 'node/3', 'way/4', 'node/5']);
  const picnic = spots.find((s) => s.id === 'way/4');
  assert.equal(picnic?.kind, 'picnic');
  assert.equal(picnic?.name, 'חורשת הפיקניק');
  assert.equal(picnic?.lat, 32.07);
});

test('mergeNearby turns a pair of benches into one place', () => {
  const merged = mergeNearby(parseOverpass(FIXTURE as never));
  assert.equal(merged.length, 4);
  const bench = merged.find((s) => s.kind === 'bench');
  assert.deepEqual(bench?.nearby, ['bench']);
});

test('parseDirection understands degrees, compass points and ranges', () => {
  assert.deepEqual(parseDirection('270'), { from: 240, to: 300 });
  assert.deepEqual(parseDirection('W'), { from: 240, to: 300 });
  assert.deepEqual(parseDirection('180-300'), { from: 180, to: 300 });
  assert.equal(parseDirection('somewhere'), null);
  assert.equal(parseDirection(undefined), null);
});

test('a viewpoint facing the sunset beats one facing east', () => {
  const merged = mergeNearby(parseOverpass(FIXTURE as never));
  const west = scoreSpot(merged.find((s) => s.id === 'node/3')!, HOME, SUNSET, 1);
  const east = scoreSpot(merged.find((s) => s.id === 'node/5')!, HOME, SUNSET, 1);
  assert.ok(west.view > east.view);
  assert.ok(west.reasons.includes('פונה לשקיעה'));
});

test('the slider moves the ranking between comfort and view', () => {
  const merged = mergeNearby(parseOverpass(FIXTURE as never));
  const comfort = rankSpots(merged, HOME, SUNSET, 0);
  const view = rankSpots(merged, HOME, SUNSET, 1);
  assert.equal(comfort[0].kind, 'picnic');
  assert.equal(view[0].id, 'node/3');
  for (const s of view) assert.ok(s.score >= 0 && s.score <= 100);
});

test('a blocked horizon pulls a spot down, an open one lifts it', () => {
  const merged = mergeNearby(parseOverpass(FIXTURE as never));
  const bench = merged.find((s) => s.kind === 'bench')!;
  const open = scoreSpot(bench, HOME, SUNSET, 1, { angle: 0, sea: false });
  const blocked = scoreSpot(bench, HOME, SUNSET, 1, { angle: 4, sea: false });
  const unknown = scoreSpot(bench, HOME, SUNSET, 1);
  assert.ok(open.view > unknown.view && unknown.view > blocked.view);
  assert.ok(open.reasons.includes('אופק פתוח'));
  assert.ok(blocked.reasons.includes('האופק חסום חלקית'));
});


test('overpass falls back to the next server when one is busy', async () => {
  const { overpass, OVERPASS_URLS } = await import('../src/lib/osm.ts');
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push(url);
    if (calls.length === 1) return new Response('busy', { status: 429 });
    assert.equal(new Headers(init?.headers).get('User-Agent'), 'Spotlight/1.0 (sunset spots app)');
    return new Response(JSON.stringify({ elements: [] }), { status: 200 });
  }) as typeof fetch;
  try {
    assert.deepEqual(await overpass('q', undefined, 1), { elements: [] });
    assert.deepEqual(calls, [OVERPASS_URLS[1], OVERPASS_URLS[2]]);
    calls.length = 0;
    globalThis.fetch = (async (url: string) => {
      calls.push(url);
      throw new Error('offline');
    }) as typeof fetch;
    await assert.rejects(overpass('q'), /overpass-api\.de: offline · overpass\.private\.coffee: offline/);
    assert.equal(calls.length, OVERPASS_URLS.length);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('overpass asks the next server when one hangs, and cancels the slow one', async () => {
  const { overpass, OVERPASS_URLS } = await import('../src/lib/osm.ts');
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  let slowAborted = false;
  globalThis.fetch = ((url: string, init?: RequestInit) => {
    calls.push(url);
    if (calls.length === 1) {
      // A busy server: never answers, only stops when cancelled.
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          slowAborted = true;
          reject(new Error('aborted'));
        });
      });
    }
    return Promise.resolve(new Response(JSON.stringify({ elements: ['fast'] }), { status: 200 }));
  }) as typeof fetch;
  try {
    const started = Date.now();
    const json = await overpass<{ elements: string[] }>('q', undefined, 0, { hedgeMs: 30, timeoutMs: 5000 });
    assert.deepEqual(json.elements, ['fast']);
    assert.ok(Date.now() - started < 1000, 'did not wait for the slow server to time out');
    assert.deepEqual(calls, [OVERPASS_URLS[0], OVERPASS_URLS[1]]);
    assert.equal(slowAborted, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('overpass reports a timeout per server when none answer', async () => {
  const { overpass } = await import('../src/lib/osm.ts');
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((_url: string, init?: RequestInit) =>
    new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as typeof fetch;
  try {
    await assert.rejects(
      overpass('q', undefined, 0, { hedgeMs: 10, timeoutMs: 60 }),
      /^Error: overpass-api\.de: timeout · overpass\.private\.coffee: timeout · maps\.mail\.ru: timeout · overpass\.kumi\.systems: timeout$/,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});
