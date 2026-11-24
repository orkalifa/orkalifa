/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bearingDegrees, destinationPoint, distanceMeters, formatDistance } from '../src/lib/geo.ts';
import { angleBetween } from '../src/lib/sun.ts';

const TLV = { lat: 32.08, lon: 34.78 };
const JLM = { lat: 31.778, lon: 35.235 };

test('distanceMeters: known distances, symmetric, zero to itself', () => {
  const d = distanceMeters(TLV, JLM);
  assert.ok(Math.abs(d - 54500) < 1500, `TLV to JLM ${d}`);
  assert.equal(distanceMeters(JLM, TLV), d);
  assert.equal(distanceMeters(TLV, TLV), 0);
  // One degree of latitude on a 6371 km sphere.
  assert.ok(Math.abs(distanceMeters({ lat: 31, lon: 35 }, { lat: 32, lon: 35 }) - 111195) < 1);
});

test('destinationPoint and distance/bearing round trip in every direction', () => {
  for (let bearing = 0; bearing < 360; bearing += 45) {
    for (const dist of [200, 10000, 40000]) {
      const p = destinationPoint(TLV, bearing, dist);
      const label = `${bearing}° ${dist} m`;
      assert.ok(Math.abs(distanceMeters(TLV, p) - dist) < 0.5, `${label}: distance`);
      assert.ok(Math.abs(angleBetween(bearingDegrees(TLV, p), bearing)) < 0.05, `${label}: bearing`);
    }
  }
});

test('across the antimeridian longitudes wrap and distances stay short', () => {
  const east = { lat: 0, lon: 179.9 };
  const p = destinationPoint(east, 90, 30000);
  assert.ok(p.lon >= -180 && p.lon <= 180, `lon ${p.lon}`);
  assert.ok(Math.abs(p.lon - -179.83) < 0.01, `lon ${p.lon}`);
  assert.ok(Math.abs(distanceMeters(east, p) - 30000) < 0.5);

  const west = { lat: 0, lon: -179.9 };
  const across = distanceMeters(east, west);
  assert.ok(Math.abs(across - 22239) < 5, `179.9E to 179.9W ${across}`);
  assert.ok(Math.abs(bearingDegrees(east, west) - 90) < 0.01);
  assert.ok(Math.abs(bearingDegrees(west, east) - 270) < 0.01);
});

test('near the pole the results stay finite and on the globe', () => {
  const from = { lat: 89.9, lon: 0 };
  const p = destinationPoint(from, 0, 30000); // straight over the pole
  assert.ok(Number.isFinite(p.lat) && Number.isFinite(p.lon));
  assert.ok(p.lat <= 90 && Math.abs(p.lat - 89.83) < 0.01, `lat ${p.lat}`);
  assert.ok(Math.abs(Math.abs(p.lon) - 180) < 1e-6, `lon ${p.lon}`);
  assert.ok(Math.abs(distanceMeters(from, p) - 30000) < 0.5);
  for (let bearing = 0; bearing < 360; bearing += 90) {
    const q = destinationPoint(from, bearing, 50000);
    assert.ok(q.lat <= 90 && q.lat >= 89 && q.lon >= -180 && q.lon <= 180, `${bearing}°: ${q.lat},${q.lon}`);
  }
});

test('formatDistance: metres rounded to 10 below 1 km, then km', () => {
  assert.equal(formatDistance(954), "950 מ'");
  assert.equal(formatDistance(1234), '1.2 ק"מ');
});
