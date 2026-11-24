/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIsraelQuery,
  checkOverpassResponse,
  toSpots,
  validateSpots,
  FILTERS,
  MIN_SPOTS,
  type BuiltSpot,
} from '../scripts/spots-build.ts';

/** n valid, distinct spots inside Israel. */
function makeSpots(n: number): BuiltSpot[] {
  return Array.from({ length: n }, (_, i) => ({ id: `node/${i + 1}`, kind: 'bench', lat: 32, lon: 34.8, tags: {} }));
}

test('checkOverpassResponse rejects a remark (overload/timeout answer with HTTP 200)', () => {
  assert.throws(
    () => checkOverpassResponse(200, { remark: 'runtime error: Query timed out in "query" at line 1', elements: [] }),
    /remark/,
  );
});

test('checkOverpassResponse rejects non-200 statuses', () => {
  assert.throws(() => checkOverpassResponse(429, { elements: [] }), /429/);
  assert.throws(() => checkOverpassResponse(504, { elements: [] }), /504/);
});

test('checkOverpassResponse rejects a missing elements array or non-object', () => {
  assert.throws(() => checkOverpassResponse(200, {}), /elements/);
  assert.throws(() => checkOverpassResponse(200, null), /JSON/);
});

test('checkOverpassResponse passes a clean response', () => {
  const r = checkOverpassResponse(200, { elements: [{ type: 'node', id: 1 }], remark: '' });
  assert.equal(r.elements.length, 1);
});

test('toSpots maps nodes and way centers, filters and trims', () => {
  const spots = toSpots({
    elements: [
      { type: 'node', id: 1, lat: 32.1234567, lon: 34.7654321, tags: { tourism: 'viewpoint', name: 'X', 'name:he': 'תצפית', direction: 'W', foo: 'bar' } },
      { type: 'way', id: 2, center: { lat: 31.5, lon: 35 }, tags: { leisure: 'picnic_table' } },
      { type: 'node', id: 3, lat: 32, lon: 35, tags: { amenity: 'cafe' } }, // unknown kind
      { type: 'node', id: 4, tags: { natural: 'peak' } }, // no position
    ],
  });
  assert.equal(spots.length, 2);
  assert.deepEqual(spots[0], { id: 'node/1', kind: 'viewpoint', lat: 32.12346, lon: 34.76543, tags: { direction: 'W' }, name: 'תצפית' });
  assert.deepEqual(spots[1], { id: 'way/2', kind: 'picnic', lat: 31.5, lon: 35, tags: {} });
});

test('validateSpots enforces the minimum count', () => {
  assert.equal(validateSpots(makeSpots(MIN_SPOTS - 1)).ok, false);
  assert.equal(validateSpots(makeSpots(MIN_SPOTS)).ok, true);
  assert.equal(validateSpots([]).ok, false);
  assert.equal(validateSpots({}).ok, false);
});

test('validateSpots rejects bad shapes', () => {
  const bad = (patch: Record<string, unknown>) => {
    const spots: unknown[] = makeSpots(10);
    spots[3] = { ...(spots[3] as object), ...patch };
    return validateSpots(spots, { min: 1 });
  };
  assert.equal(validateSpots(makeSpots(10), { min: 1 }).ok, true);
  assert.equal(bad({ id: 'node/1' }).ok, false, 'duplicate id');
  assert.equal(bad({ id: 'n1' }).ok, false, 'bad id format');
  assert.equal(bad({ kind: 'mine' }).ok, false, 'kind not in the bundled set');
  assert.equal(bad({ lat: NaN }).ok, false, 'NaN lat');
  assert.equal(bad({ lat: 48.86, lon: 2.35 }).ok, false, 'outside Israel');
  assert.equal(bad({ tags: null }).ok, false, 'tags not an object');
  assert.equal(bad({ name: 5 }).ok, false, 'name not a string');
});

test('validateSpots shrink guard: rejects >10% drop unless forced', () => {
  assert.equal(validateSpots(makeSpots(8900), { previousCount: 10000 }).ok, false);
  assert.equal(validateSpots(makeSpots(9500), { previousCount: 10000 }).ok, true);
  assert.equal(validateSpots(makeSpots(8900), { previousCount: 10000, force: true }).ok, true);
  assert.equal(validateSpots(makeSpots(MIN_SPOTS - 1), { previousCount: 10000, force: true }).ok, false, 'force never bypasses the minimum');
});

test('buildIsraelQuery has all filters, the bbox and a long timeout', () => {
  const q = buildIsraelQuery();
  for (const [k, v] of FILTERS) assert.ok(q.includes(`["${k}"="${v}"](29.45,34.27,33.34,35.85)`), `${k}=${v}`);
  assert.ok(q.includes('[timeout:180]'));
});
