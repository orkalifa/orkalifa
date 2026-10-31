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

test('bearingToHebrew uses 8 compass points', () => {
  assert.equal(bearingToHebrew(0), 'צפון');
  assert.equal(bearingToHebrew(240), 'דרום־מערב');
  assert.equal(bearingToHebrew(254), 'מערב');
  assert.equal(bearingToHebrew(296), 'צפון־מערב');
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

/**
 * Independent check of the times SunCalc gives us, with NOAA's solar position equations
 * (the ones behind NOAA's solar calculator). Returns the geometric altitude and azimuth in degrees.
 */
function noaaSun(date: Date, lat: number, lon: number) {
  const rad = Math.PI / 180;
  const T = (date.getTime() / 86400000 + 2440587.5 - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * rad) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * rad);
  const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(omega * rad);
  const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad));
  const y = Math.tan((eps / 2) * rad) ** 2;
  const eot =
    4 /
    rad *
    (y * Math.sin(2 * L0 * rad) -
      2 * e * Math.sin(M * rad) +
      4 * e * y * Math.sin(M * rad) * Math.cos(2 * L0 * rad) -
      0.5 * y * y * Math.sin(4 * L0 * rad) -
      1.25 * e * e * Math.sin(2 * M * rad));
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const hourAngle = (((utcMinutes + eot + 4 * lon) % 1440) + 1440) % 1440 / 4 - 180;
  const cosZen = Math.sin(lat * rad) * Math.sin(decl) + Math.cos(lat * rad) * Math.cos(decl) * Math.cos(hourAngle * rad);
  const zen = Math.acos(Math.min(1, Math.max(-1, cosZen)));
  const azAcos = Math.acos((Math.sin(lat * rad) * Math.cos(zen) - Math.sin(decl)) / (Math.cos(lat * rad) * Math.sin(zen))) / rad;
  const azimuth = hourAngle > 0 ? (azAcos + 180) % 360 : (540 - azAcos) % 360;
  return { altitude: 90 - zen / rad, azimuth };
}

test('golden hour, sunset and bearing agree with NOAA across the year and the country', () => {
  const places = [
    { lat: 33.0, lon: 35.5 }, // north
    { lat: 31.25, lon: 34.79 }, // Negev
    { lat: 29.55, lon: 34.95 }, // Eilat
  ];
  const days = ['2026-01-15', '2026-03-20', '2026-06-21', '2026-09-22', '2026-10-31', '2026-12-21'];
  for (const p of places) {
    for (const day of days) {
      const info = getSunsetInfo(p.lat, p.lon, new Date(`${day}T08:00:00Z`))!;
      const golden = noaaSun(info.goldenHour, p.lat, p.lon);
      const sunset = noaaSun(info.sunset, p.lat, p.lon);
      const at = `${day} @ ${p.lat}`;
      // Golden hour starts when the sun is 6° up; sunset is when its top edge touches the horizon (−0.833°).
      // The sun moves ~0.2° a minute here, so 0.25° is well under a minute.
      assert.ok(Math.abs(golden.altitude - 6) < 0.25, `${at}: golden hour altitude ${golden.altitude}`);
      assert.ok(Math.abs(sunset.altitude + 0.833) < 0.25, `${at}: sunset altitude ${sunset.altitude}`);
      assert.ok(Math.abs(angleBetween(sunset.azimuth, info.bearing)) < 0.5, `${at}: bearing ${info.bearing} vs ${sunset.azimuth}`);
      const minutes = (info.sunset.getTime() - info.goldenHour.getTime()) / 60000;
      assert.ok(minutes > 25 && minutes < 45, `${at}: golden hour lasts ${minutes} min`);
    }
  }
});
