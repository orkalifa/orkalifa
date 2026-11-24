/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ScoredSpot } from '../src/lib/score.ts';
import { mapSpotsFor, minuteOf, reachClock, shortlist, SHORTLIST } from '../src/lib/shown.ts';
import type { ShownSpot } from '../src/lib/travel.ts';

const spot = (id: string, score = 50): ScoredSpot =>
  ({ id, kind: id.startsWith('mine/') ? 'mine' : 'viewpoint', lat: 32, lon: 34.8, tags: {}, nearby: [], score, distance: 1000 }) as unknown as ScoredSpot;
const shown = (id: string): ShownSpot => ({ ...spot(id), reach: { color: '#EFA22F', opacity: 1, inTime: true } });

test('minuteOf: one key per minute, so the reach colours recompute once a minute', () => {
  const a = minuteOf(new Date('2026-11-24T15:30:00.000Z'));
  assert.equal(minuteOf(new Date('2026-11-24T15:30:01.000Z')), a);
  assert.equal(minuteOf(new Date('2026-11-24T15:30:59.999Z')), a);
  assert.notEqual(minuteOf(new Date('2026-11-24T15:31:00.000Z')), a);
  assert.equal(minuteOf(new Date('2026-11-24T15:31:00.000Z')) - a, 60000);
});

test('reachClock: never earlier than now (errs late, never claims "in time" too long)', () => {
  for (const iso of ['2026-11-24T15:30:00.000Z', '2026-11-24T15:30:00.001Z', '2026-11-24T15:30:30.500Z', '2026-11-24T15:30:59.999Z']) {
    const now = new Date(iso);
    const t = reachClock(minuteOf(now)).getTime();
    assert.ok(t >= now.getTime(), iso);
    assert.ok(t - now.getTime() <= 60000, iso);
  }
});

test('shortlist: the top six, then your own spots further down, in order and without duplicates', () => {
  const scored = [spot('a'), spot('mine/1'), spot('b'), spot('c'), spot('d'), spot('e'), spot('f'), spot('mine/2'), spot('g'), spot('mine/3')];
  const ids = shortlist(scored).map((s) => s.id);
  assert.deepEqual(ids, ['a', 'mine/1', 'b', 'c', 'd', 'e', 'mine/2', 'mine/3']);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(SHORTLIST, 6);
  assert.deepEqual(shortlist([spot('a'), spot('b')]).map((s) => s.id), ['a', 'b']);
  assert.deepEqual(shortlist([]), []);
});

test('mapSpotsFor: adds the shared and selected spots only when they are missing', () => {
  const ranked = [shown('a'), shown('b')];
  assert.deepEqual(mapSpotsFor(ranked, null, null).map((s) => s.id), ['a', 'b']);
  assert.deepEqual(mapSpotsFor(ranked, shown('x'), shown('a')).map((s) => s.id), ['a', 'b', 'x']);
  assert.deepEqual(mapSpotsFor(ranked, shown('x'), shown('x')).map((s) => s.id), ['a', 'b', 'x']);
  assert.deepEqual(mapSpotsFor(ranked, null, shown('mine/9')).map((s) => s.id), ['a', 'b', 'mine/9']);
  assert.deepEqual(mapSpotsFor(null, shown('x'), null).map((s) => s.id), ['x']);
  assert.deepEqual(mapSpotsFor(null, null, null), []);
  // Doesn't change the list it was given.
  assert.equal(ranked.length, 2);
});
