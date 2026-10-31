/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ScoredSpot } from '../src/lib/score.ts';
import { mix, reachFor, travelMinutes } from '../src/lib/travel.ts';

test('travel time: walking is slowest, the car fastest beyond the first few minutes', () => {
  assert.ok(Math.abs(travelMinutes(1000, 'walk') - 16) < 0.5);
  assert.ok(Math.abs(travelMinutes(5000, 'bike') - 26) < 0.5);
  assert.ok(Math.abs(travelMinutes(10000, 'car') - 21) < 0.5);
  for (const m of [500, 3000, 10000]) assert.ok(travelMinutes(m, 'walk') > travelMinutes(m, 'bike'));
  // Around the block a bike beats the car (getting going and parking); further out the car wins.
  assert.ok(travelMinutes(500, 'bike') < travelMinutes(500, 'car'));
  for (const m of [3000, 10000]) assert.ok(travelMinutes(m, 'bike') > travelMinutes(m, 'car'));
});

test('reach colour: gold for golden hour, orange by sunset, faded after', () => {
  const golden = new Date('2026-10-31T14:19:00Z');
  const sunset = new Date('2026-10-31T14:53:00Z');
  const at = (iso: string) => reachFor(new Date(iso), golden, sunset);

  assert.deepEqual(at('2026-10-31T13:00:00Z'), { color: '#EFA22F', opacity: 1, inTime: true });
  assert.deepEqual(at('2026-10-31T14:53:00Z'), { color: '#E2622B', opacity: 1, inTime: true });
  const between = at('2026-10-31T14:36:00Z');
  assert.equal(between.color, mix('#EFA22F', '#E2622B', 0.5));
  assert.equal(between.inTime, true);

  const justLate = at('2026-10-31T15:00:00Z');
  assert.equal(justLate.inTime, false);
  assert.ok(justLate.opacity < 1 && justLate.opacity > 0.65);
  assert.deepEqual(at('2026-10-31T16:00:00Z'), { color: '#CDB8A6', opacity: 0.65, inTime: false });
});

test('mix blends colours channel by channel', () => {
  assert.equal(mix('#000000', '#FFFFFF', 0.5), '#808080');
  assert.equal(mix('#EFA22F', '#E2622B', 0), '#EFA22F');
  assert.equal(mix('#EFA22F', '#E2622B', 2), '#E2622B');
});

test('withReach colours by arrival and puts spots you would miss last', async () => {
  const { withReach } = await import('../src/lib/travel.ts');
  const golden = new Date('2026-10-31T14:19:00Z');
  const sunset = new Date('2026-10-31T14:53:00Z');
  const now = new Date('2026-10-31T14:30:00Z'); // 23 minutes to sunset
  const spot = (id: string, distance: number, score: number): ScoredSpot => ({
    id,
    distance,
    score,
    kind: 'bench',
    lat: 0,
    lon: 0,
    tags: {},
    nearby: [],
    view: 0,
    access: 0,
    pleasant: 0,
    reasons: [],
  });
  // Ranked by score: the far viewpoint first, but on foot you'd only make the near bench.
  const ranked = [spot('far', 4000, 90), spot('near', 600, 70)];
  const walking = withReach([...ranked], 'walk', now, golden, sunset);
  assert.deepEqual(walking.map((s) => [s.id, s.reach.inTime]), [['near', true], ['far', false]]);
  const driving = withReach([...ranked], 'car', now, golden, sunset);
  assert.deepEqual(driving.map((s) => [s.id, s.reach.inTime]), [['far', true], ['near', true]]);
});
