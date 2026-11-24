/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addVisit, formatDay, isSunsetTime, MAX_VISITS, parseVisits, unsavedVisits } from '../src/lib/visits.ts';
import { getEveningLight, getSunsetInfo } from '../src/lib/sun.ts';
import { makeProjection } from '../src/lib/mapview.ts';

const HERE = { lat: 32.1, lon: 34.9 };
const NEXT_DOOR = { lat: 32.1005, lon: 34.9 }; // ~55 m
const FAR = { lat: 32.2, lon: 34.9 }; // ~11 km

test('a sunset visit is remembered once per place, newest first', () => {
  let v = addVisit([], HERE, 1000, []);
  assert.equal(v.length, 1);
  v = addVisit(v, NEXT_DOOR, 2000, []);
  assert.equal(v.length, 1, 'same place again adds nothing');
  v = addVisit(v, FAR, 3000, [], 'רעננה');
  assert.deepEqual(v.map((x) => x.at), [3000, 1000]);
  assert.equal(v[0].place, 'רעננה');
});

test('a place you already saved is not a "visit"', () => {
  assert.deepEqual(addVisit([], HERE, 1, [NEXT_DOOR]), []);
});

test('only the last few visits are kept', () => {
  let v: ReturnType<typeof addVisit> = [];
  for (let i = 0; i < MAX_VISITS + 3; i++) v = addVisit(v, { lat: 31 + i * 0.1, lon: 35 }, i, []);
  assert.equal(v.length, MAX_VISITS);
  assert.equal(v[0].at, MAX_VISITS + 2);
});

test('saving a visit makes it drop off the list', () => {
  const v = addVisit(addVisit([], HERE, 1, []), FAR, 2, []);
  assert.deepEqual(unsavedVisits(v, [NEXT_DOOR]).map((x) => x.at), [2]);
});

test('stored visits survive junk', () => {
  assert.deepEqual(parseVisits('[{"lat":1,"lon":2,"at":3},{"lat":"x"},null]'), [{ lat: 1, lon: 2, at: 3 }]);
  assert.deepEqual(parseVisits('nope'), []);
  assert.equal(formatDay(new Date(2026, 10, 23, 17).getTime()), '23.11');
});

test('sunset time runs from golden hour to the end of the blue hour', () => {
  const g = new Date('2026-11-23T14:00:00Z');
  const e = new Date('2026-11-23T15:05:00Z');
  assert.ok(isSunsetTime(new Date('2026-11-23T14:30:00Z'), g, e));
  assert.ok(!isSunsetTime(new Date('2026-11-23T13:59:00Z'), g, e));
  assert.ok(!isSunsetTime(new Date('2026-11-23T15:06:00Z'), g, e));
});

test('just after sunset, the evening light is still tonight while the sunset info moves to tomorrow', () => {
  const today = getSunsetInfo(32.08, 34.78, new Date('2026-11-23T09:00:00Z'));
  assert.ok(today);
  const justAfter = new Date(today.sunset.getTime() + 5 * 60000);
  assert.equal(getSunsetInfo(32.08, 34.78, justAfter)?.isTomorrow, true);
  const light = getEveningLight(32.08, 34.78, justAfter);
  assert.ok(light);
  assert.equal(light.isTomorrow, false);
  assert.equal(light.sunset.getTime(), today.sunset.getTime());
  const afterBlue = getEveningLight(32.08, 34.78, new Date(today.blueHourEnd.getTime() + 60000));
  assert.equal(afterBlue?.isTomorrow, true);
});

test('a point on the map turns back into the same place', () => {
  const proj = makeProjection(HERE, 400, 500, 5000, 100);
  const spot = { lat: 32.123, lon: 34.871 };
  const back = proj.toLatLon(proj.toXY(spot));
  assert.ok(Math.abs(back.lat - spot.lat) < 1e-9 && Math.abs(back.lon - spot.lon) < 1e-9);
});
