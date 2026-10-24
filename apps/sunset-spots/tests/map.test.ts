/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinationPoint } from '../src/lib/geo.ts';
import { edgePoint, layoutLabels, makeProjection, mapRange, shapePath } from '../src/lib/mapview.ts';

const HOME = { lat: 31.9, lon: 34.85 };

test('projection puts you in the middle, north up, at the right scale', () => {
  const proj = makeProjection(HOME, 400, 600, 5000);
  assert.deepEqual(proj.toXY(HOME), { x: 200, y: 300 });
  const north = proj.toXY(destinationPoint(HOME, 0, 5000));
  const west = proj.toXY(destinationPoint(HOME, 270, 5000));
  // 5 km fits the shorter side (400 px wide, 28 px margin): 172 px.
  assert.ok(Math.abs(north.x - 200) < 0.5 && Math.abs(300 - north.y - 172) < 1, JSON.stringify(north));
  assert.ok(Math.abs(west.y - 300) < 0.5 && Math.abs(200 - west.x - 172) < 1, JSON.stringify(west));
});

test('mapRange fits the farthest spot within 2–10 km', () => {
  assert.equal(mapRange([]), 2000);
  assert.equal(mapRange([500, 4000]), 5000);
  assert.equal(mapRange([30000]), 10000);
});

test('shapePath drops points on the same pixel and skips shapes off screen', () => {
  const proj = makeProjection(HOME, 400, 400, 5000);
  const dense = Array.from({ length: 200 }, (_, i) => destinationPoint(HOME, 90, i));
  const d = shapePath(dense, proj, false)!;
  assert.ok((d.match(/L/g) ?? []).length < 10, d);
  assert.match(d, /^M200\.0 200\.0/);

  const far = destinationPoint(HOME, 0, 50000);
  const offscreen = [far, destinationPoint(far, 90, 1000), destinationPoint(far, 180, 1000)];
  assert.equal(shapePath(offscreen, proj, true), null);

  const field = [HOME, destinationPoint(HOME, 90, 800), destinationPoint(HOME, 135, 1100), HOME];
  assert.match(shapePath(field, proj, true)!, /Z$/);
  assert.equal(shapePath([HOME, destinationPoint(HOME, 90, 5), HOME], proj, true), null);
});

test('a card over the top of the map moves you down into the space left', () => {
  const proj = makeProjection(HOME, 400, 700, 5000, 100);
  assert.deepEqual(proj.toXY(HOME), { x: 200, y: 400 });
  assert.ok(Math.abs(edgePoint(proj, 0, 20).y - 120) < 1e-6);
});

test('edgePoint follows the sunset bearing to the map edge', () => {
  const proj = makeProjection(HOME, 400, 600, 5000);
  const west = edgePoint(proj, 270, 20);
  assert.ok(Math.abs(west.x - 20) < 1e-6 && Math.abs(west.y - 300) < 1e-6);
  const south = edgePoint(proj, 180, 20);
  assert.ok(Math.abs(south.y - 580) < 1e-6);
  const wsw = edgePoint(proj, 250, 20);
  assert.ok(wsw.x >= 20 - 1e-6 && wsw.y > 300 && wsw.y < 580);
});

test('layoutLabels nudges a name off you rather than dropping it', () => {
  const proj = makeProjection(HOME, 400, 400, 5000);
  const [label] = layoutLabels([{ id: 'home', name: 'המושב', rank: 2, ...destinationPoint(HOME, 0, 10) }], proj);
  assert.ok(label && label.y <= 200 - 18 - 4, JSON.stringify(label));
});

test('layoutLabels puts the bigger place first and moves the smaller one aside', () => {
  const proj = makeProjection(HOME, 400, 400, 5000);
  const at = (b: number, m: number) => destinationPoint(HOME, b, m);
  const placed = layoutLabels(
    [
      { id: 'v', name: 'מושב', rank: 2, ...at(0, 2000) },
      { id: 't', name: 'עיר', rank: 0, ...at(0, 2050) },
      { id: 'h', name: 'חווה', rank: 3, ...at(90, 3000) },
      { id: 'out', name: 'רחוק', rank: 1, ...at(180, 20000) },
    ],
    proj,
  );
  assert.deepEqual(placed.map((p) => p.id), ['t', 'v', 'h']);
  const [town, village] = placed;
  assert.equal(town.y, proj.toXY(at(0, 2050)).y);
  assert.ok(Math.abs(village.y - town.y) >= town.fontSize, `${village.y} vs ${town.y}`);
});
