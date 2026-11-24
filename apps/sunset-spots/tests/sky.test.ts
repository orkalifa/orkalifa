/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecastUrl, hourAt, rateSunset, verdictFromForecast } from '../src/lib/sky.ts';

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

test('the forecast URL asks for both places, rounded to ~1 km', () => {
  const url = new URL(forecastUrl({ lat: 32.08531, lon: 34.77004 }, 260));
  const lats = url.searchParams.get('latitude')!.split(',');
  const lons = url.searchParams.get('longitude')!.split(',');
  assert.equal(lats.length, 2);
  assert.equal(lats[0], '32.09');
  assert.equal(lons[0], '34.77');
  assert.ok(Number(lons[1]) < 34.4, 'horizon point is ~40 km to the west');
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
