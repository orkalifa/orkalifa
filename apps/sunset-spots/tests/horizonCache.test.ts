/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FAILED_RETRY_MS,
  MAX_AGE_MS,
  MAX_ENTRIES,
  MAX_FAILED,
  emptyHorizonCache,
  horizonCacheKey,
  horizonsAfterFetch,
  lookupHorizons,
  parseHorizonCache,
  planFetch,
  recordFailures,
  storeHorizons,
} from '../src/lib/horizonCache.ts';
import { rayOrigin } from '../src/lib/horizon.ts';

const NOW = Date.UTC(2026, 10, 24, 12);
const DAY = 24 * 60 * 60 * 1000;
const A = { id: 'a', lat: 31.43, lon: 34.6 };
const B = { id: 'b', lat: 31.5, lon: 34.7 };
const OPEN = { angle: 0.2, sea: false };
const SEA = { angle: -0.4, sea: true };

test('miss on an empty cache, hit after storing', () => {
  const empty = lookupHorizons(emptyHorizonCache(), [A, B], 259, NOW);
  assert.deepEqual(empty.hits, {});
  assert.deepEqual(empty.missing, [A, B]);

  const cache = storeHorizons(emptyHorizonCache(), [A, B], 259, { a: OPEN, b: SEA }, NOW);
  const r = lookupHorizons(cache, [A, B], 259, NOW + DAY);
  assert.deepEqual(r.hits, { a: OPEN, b: SEA });
  assert.deepEqual(r.missing, []);
});

test('bearing is rounded to a whole degree, 360 is 0', () => {
  assert.equal(horizonCacheKey(A, 259.4), horizonCacheKey(A, 258.6));
  assert.notEqual(horizonCacheKey(A, 259.4), horizonCacheKey(A, 259.6));
  assert.equal(horizonCacheKey(A, 360), horizonCacheKey(A, 0));
  assert.equal(horizonCacheKey(A, -1), horizonCacheKey(A, 359));
});

test("a saved place's key carries its rounded position", () => {
  const mine = { id: 'm1', kind: 'mine', lat: 31.43214, lon: 34.60187 };
  const cache = storeHorizons(emptyHorizonCache(), [mine], 259, { m1: OPEN }, NOW);
  // ~20 m jitter inside the same ~100 m cell: still a hit.
  assert.deepEqual(lookupHorizons(cache, [{ ...mine, lat: 31.43231 }], 259, NOW).hits, { m1: OPEN });
  // Moved ~300 m: a miss, so the terrain is checked again.
  assert.deepEqual(lookupHorizons(cache, [{ ...mine, lat: 31.43514 }], 259, NOW).missing.length, 1);
  // The exact coordinates are never in the key.
  const key = horizonCacheKey(mine, 259);
  assert.ok(!key.includes('31.43214') && !key.includes('34.60187'), key);
  const o = rayOrigin(mine);
  assert.ok(key.includes(`${o.lat},${o.lon}`), key);
});

test('entries expire after MAX_AGE_MS and are pruned on store', () => {
  const old = storeHorizons(emptyHorizonCache(), [A], 259, { a: OPEN }, NOW - 43 * DAY);
  assert.equal(lookupHorizons(old, [A], 259, NOW).missing.length, 1);
  const recent = storeHorizons(emptyHorizonCache(), [A], 259, { a: OPEN }, NOW - 41 * DAY);
  assert.deepEqual(lookupHorizons(recent, [A], 259, NOW).hits, { a: OPEN });
  assert.ok(41 * DAY < MAX_AGE_MS && 43 * DAY > MAX_AGE_MS);

  const pruned = storeHorizons(old, [B], 259, { b: SEA }, NOW);
  assert.deepEqual(Object.keys(pruned.entries), [horizonCacheKey(B, 259)]);
});

test('an entry stamped in the future is a miss', () => {
  const future = storeHorizons(emptyHorizonCache(), [A], 259, { a: OPEN }, NOW + DAY);
  assert.equal(lookupHorizons(future, [A], 259, NOW).missing.length, 1);
});

test('the cache keeps only the newest MAX_ENTRIES', () => {
  let cache = emptyHorizonCache();
  const n = MAX_ENTRIES + 10;
  for (let i = 0; i < n; i++) {
    cache = storeHorizons(cache, [{ ...A, id: `s${i}` }], 259, { [`s${i}`]: OPEN }, NOW - (n - i) * 1000);
  }
  assert.equal(Object.keys(cache.entries).length, MAX_ENTRIES);
  assert.ok(!(horizonCacheKey({ ...A, id: 's0' }, 259) in cache.entries));
  assert.ok(horizonCacheKey({ ...A, id: `s${n - 1}` }, 259) in cache.entries);
});

test('stored JSON round-trips; malformed data is dropped without throwing', () => {
  const cache = storeHorizons(emptyHorizonCache(), [A, B], 259, { a: OPEN, b: SEA }, NOW);
  assert.deepEqual(parseHorizonCache(JSON.stringify(cache)), cache);

  for (const raw of [null, '', 'garbage', '[]', 'null', '{"v":2,"entries":{}}', '{"v":1}']) {
    assert.deepEqual(parseHorizonCache(raw), emptyHorizonCache(), String(raw));
  }
  const mixed = JSON.stringify({
    v: 1,
    entries: {
      good: { h: OPEN, t: NOW },
      badAngle: { h: { angle: 'x', sea: false }, t: NOW },
      badSea: { h: { angle: 1, sea: 'no' }, t: NOW },
      badT: { h: OPEN, t: 'now' },
      nothing: null,
    },
  });
  assert.deepEqual(Object.keys(parseHorizonCache(mixed).entries), ['good']);
});

test('planFetch: missing minus in-flight, recent failures not retried', () => {
  const C = { id: 'c', lat: 31.6, lon: 34.8 };
  const inFlight = new Set([horizonCacheKey(A, 259)]);
  const failedAt = new Map([
    [horizonCacheKey(B, 259), NOW - 1000],
    [horizonCacheKey(C, 259), NOW - FAILED_RETRY_MS - 1],
  ]);
  const plan = planFetch([A, B, C], 259, inFlight, failedAt, NOW);
  assert.deepEqual(plan.waiting, [A]);
  assert.deepEqual(plan.failed, [B]);
  assert.deepEqual(plan.toFetch, [C]);

  // In flight under another bearing: a different key, so it is fetched.
  assert.deepEqual(planFetch([A], 262, inFlight, new Map(), NOW).toFetch, [A]);
});

test('an error keeps the horizons already known', () => {
  const err = horizonsAfterFetch({ a: OPEN }, { b: SEA }, { ok: false });
  assert.equal(err.status, 'error');
  assert.deepEqual(err.horizons, { a: OPEN, b: SEA });

  const ok = horizonsAfterFetch({ old: OPEN }, { b: SEA }, { ok: true, horizons: { a: OPEN } });
  assert.equal(ok.status, 'ready');
  assert.deepEqual(ok.horizons, { a: OPEN, b: SEA });
});

test('planFetch: once the backoff is over, a failed spot is fetched again', () => {
  const failedAt = new Map([[horizonCacheKey(A, 259), NOW]]);
  assert.deepEqual(planFetch([A], 259, new Set(), failedAt, NOW + FAILED_RETRY_MS - 1).failed, [A]);
  assert.deepEqual(planFetch([A], 259, new Set(), failedAt, NOW + FAILED_RETRY_MS).toFetch, [A]);
});

test('recordFailures prunes expired and future entries and keeps the rest', () => {
  const failedAt = new Map([
    ['old', NOW - FAILED_RETRY_MS],
    ['recent', NOW - 1000],
    ['future', NOW + 1000],
  ]);
  recordFailures(failedAt, ['a|259', 'b|259'], NOW);
  assert.deepEqual([...failedAt.keys()].sort(), ['a|259', 'b|259', 'recent']);
  assert.equal(failedAt.get('a|259'), NOW);

  // A repeated failure refreshes its stamp.
  recordFailures(failedAt, ['recent'], NOW + 10);
  assert.equal(failedAt.get('recent'), NOW + 10);
});

test('recordFailures caps the map at MAX_FAILED, dropping the oldest', () => {
  const failedAt = new Map<string, number>();
  for (let i = 0; i < MAX_FAILED; i++) failedAt.set(`s${i}`, NOW - 2000 + i / 1000);
  recordFailures(failedAt, ['new1', 'new2'], NOW);
  assert.equal(failedAt.size, MAX_FAILED);
  assert.ok(!failedAt.has('s0') && !failedAt.has('s1'), 'oldest dropped');
  assert.ok(failedAt.has('new1') && failedAt.has('new2') && failedAt.has(`s${MAX_FAILED - 1}`));
});
