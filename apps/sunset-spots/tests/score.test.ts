/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Horizon } from '../src/lib/horizon.ts';
import type { Spot } from '../src/lib/osm.ts';
import {
  blockedFactor,
  rankSpots,
  scoreSpot,
  UNCHECKED_FACTOR,
  UNCHECKED_REASON,
  type ScoredSpot,
} from '../src/lib/score.ts';

const HOME = { lat: 32.08, lon: 34.78 };
const SUNSET = 270;
const WEIGHT = 0.4; // VIEW_WEIGHT in the app
const KM_LON = 1 / (111.32 * Math.cos((HOME.lat * Math.PI) / 180)); // degrees of longitude per km here

const spot = (id: string, kind: Spot['kind'], kmWest: number, tags: Record<string, string> = {}): Spot => ({
  id,
  kind,
  lat: HOME.lat,
  lon: HOME.lon - kmWest * KM_LON,
  tags,
  nearby: [],
});

const OPEN: Horizon = { angle: 0, sea: false };
const ridge = (angle: number): Horizon => ({ angle, sea: false });

/** The score before any horizon gate or unchecked discount. */
const baseScore = (s: ScoredSpot) => Math.round(WEIGHT * s.view + (1 - WEIGHT) * ((s.access + s.pleasant) / 2));

test('a sunset blocked by a 3° ridge nearby ranks below an open viewpoint farther away', () => {
  const bench = spot('bench', 'bench', 1);
  const viewpoint = spot('viewpoint', 'viewpoint', 8);
  const ranked = rankSpots([bench, viewpoint], HOME, SUNSET, WEIGHT, { bench: ridge(3), viewpoint: OPEN });
  assert.deepEqual(ranked.map((s) => s.id), ['viewpoint', 'bench']);
  const [open, blocked] = ranked;
  assert.ok(open.score - blocked.score >= 15, `gap ${open.score - blocked.score} is not a strong penalty`);
  assert.ok(blocked.reasons.includes('האופק חסום חלקית'));
  assert.equal(blocked.horizonChecked, true);
});

test('the blocked-sun penalty grows with the angle', () => {
  const bench = spot('bench', 'bench', 1);
  assert.equal(blockedFactor(ridge(0)), 1);
  assert.equal(blockedFactor(ridge(2)), 1);
  assert.equal(blockedFactor(ridge(3)), 0.75);
  assert.equal(blockedFactor(ridge(5)), 0.5);
  assert.equal(blockedFactor(ridge(20)), 0.3);
  const scores = [0, 1, 2, 3, 4, 5, 8, 10].map((a) => scoreSpot(bench, HOME, SUNSET, WEIGHT, ridge(a)).score);
  for (let i = 1; i < scores.length; i++) assert.ok(scores[i] <= scores[i - 1], `score rose at step ${i}: ${scores}`);
  const open = scoreSpot(bench, HOME, SUNSET, WEIGHT, OPEN).score;
  const hill = scoreSpot(bench, HOME, SUNSET, WEIGHT, ridge(10)).score;
  assert.ok(hill < 0.35 * open, `a 10° hill still scores ${hill} vs ${open} open`);
});

test('an unchecked spot is marked and cannot outrank a checked open one on its base view alone', () => {
  const bench = spot('bench', 'bench', 1);
  const viewpoint = spot('viewpoint', 'viewpoint', 5, { direction: 'W' });
  // Checks ran (the bench has a result), the viewpoint was outside the checked set.
  const ranked = rankSpots([viewpoint, bench], HOME, SUNSET, WEIGHT, { bench: OPEN });
  assert.deepEqual(ranked.map((s) => s.id), ['bench', 'viewpoint']);
  const unchecked = ranked[1];
  assert.equal(unchecked.horizonChecked, false);
  assert.ok(unchecked.reasons.includes(UNCHECKED_REASON));
  assert.ok(Math.abs(unchecked.score - baseScore(unchecked) * UNCHECKED_FACTOR) <= 1);
  assert.equal(ranked[0].horizonChecked, true);
  assert.ok(!ranked[0].reasons.includes(UNCHECKED_REASON));
  // A lone scoreSpot call (e.g. a far shared spot) is marked unchecked by default.
  assert.equal(scoreSpot(viewpoint, HOME, SUNSET, WEIGHT).horizonChecked, false);
});

test('before any horizon result (loading or failed) there is no discount and no mark', () => {
  const spots = [spot('a', 'bench', 1), spot('b', 'viewpoint', 8), spot('c', 'picnic', 3), spot('d', 'peak', 12)];
  const ranked = rankSpots(spots, HOME, SUNSET, WEIGHT, {});
  const expectedOrder = [...ranked].sort((x, y) => baseScore(y) - baseScore(x)).map((s) => s.id);
  assert.deepEqual(ranked.map((s) => s.id), expectedOrder);
  for (const s of ranked) {
    assert.equal(s.score, baseScore(s));
    assert.equal(s.horizonChecked, null);
    assert.ok(!s.reasons.includes(UNCHECKED_REASON));
  }
});

test('the unchecked discount keeps the order among unchecked spots', () => {
  const spots = [spot('a', 'bench', 1), spot('b', 'viewpoint', 8), spot('c', 'picnic', 3), spot('d', 'peak', 12)];
  const before = rankSpots(spots, HOME, SUNSET, WEIGHT, {}).map((s) => s.id);
  const checked = spot('z', 'shelter', 30);
  const after = rankSpots([...spots, checked], HOME, SUNSET, WEIGHT, { z: ridge(10) })
    .filter((s) => s.id !== 'z')
    .map((s) => s.id);
  assert.deepEqual(after, before);
});

test('a sea horizon is scored as before: no gate, no discount', () => {
  const beach = spot('beach', 'bench', 2);
  const sea = scoreSpot(beach, HOME, SUNSET, WEIGHT, { angle: 0, sea: true });
  assert.equal(blockedFactor({ angle: 0, sea: true }), 1);
  assert.equal(sea.score, baseScore(sea));
  assert.equal(sea.view, Math.round(0.7 * 100 + 0.3 * 55));
  assert.ok(sea.reasons.includes('אופק ים'));
  assert.equal(sea.horizonChecked, true);
});
