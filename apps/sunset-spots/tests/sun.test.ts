/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  angleBetween,
  bearingToHebrew,
  formatCountdown,
  getSunsetInfo,
  normalizeBearing,
} from '../src/lib/sun.ts';

// Tel Aviv area
const LAT = 32.08;
const LON = 34.78;

test('normalizeBearing wraps into [0, 360)', () => {
  assert.equal(normalizeBearing(370), 10);
  assert.equal(normalizeBearing(-90), 270);
  assert.equal(normalizeBearing(0), 0);
});

test('October sunset in Israel is a little south of west', () => {
  const info = getSunsetInfo(LAT, LON, new Date('2026-10-18T09:00:00Z'));
  assert.ok(info);
  assert.equal(info.isTomorrow, false);
  assert.ok(info.bearing > 250 && info.bearing < 265, `bearing was ${info.bearing}`);
  assert.ok(info.goldenHour < info.sunset);
});

test('June sunset is in the west-northwest', () => {
  const info = getSunsetInfo(LAT, LON, new Date('2026-06-21T09:00:00Z'));
  assert.ok(info);
  assert.ok(info.bearing > 290 && info.bearing < 305, `bearing was ${info.bearing}`);
});

test('after sunset, the next sunset is tomorrow', () => {
  const info = getSunsetInfo(LAT, LON, new Date('2026-10-18T20:00:00Z'));
  assert.ok(info);
  assert.equal(info.isTomorrow, true);
  assert.ok(info.sunset.getTime() > new Date('2026-10-19T00:00:00Z').getTime());
});

test('sunset is null during polar day', () => {
  assert.equal(getSunsetInfo(78.2, 15.6, new Date('2026-06-21T09:00:00Z')), null); // Svalbard
});

test('bearingToHebrew uses 16 compass points', () => {
  assert.equal(bearingToHebrew(0), 'צפון');
  assert.equal(bearingToHebrew(247.5), 'מערב־דרום־מערב');
  assert.equal(bearingToHebrew(259), 'מערב');
  assert.equal(bearingToHebrew(359), 'צפון');
});

test('formatCountdown', () => {
  assert.equal(formatCountdown(72 * 60000), "1:12 שע'");
  assert.equal(formatCountdown(24 * 60000 + 30000), "24 דק'");
  assert.equal(formatCountdown(-5000), "0 דק'");
});

test('angleBetween wraps around north', () => {
  assert.equal(angleBetween(350, 10), 20);
  assert.equal(angleBetween(10, 350), -20);
  assert.equal(angleBetween(0, 180), 180);
});
