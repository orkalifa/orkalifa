/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bearingDegrees, distanceMeters, formatDistance } from '../src/lib/geo.ts';
import { buildOverpassQuery, mergeNearby, parseOverpass } from '../src/lib/osm.ts';
import { parseDirection, rankSpots, scoreSpot } from '../src/lib/score.ts';

const HOME = { lat: 32.08, lon: 34.78 };
const SUNSET = 259;

// Shape of a real Overpass `out center tags` response: nodes carry lat/lon, ways carry center.
const FIXTURE = {
  elements: [
    { type: 'node', id: 1, lat: 32.081, lon: 34.775, tags: { amenity: 'bench', backrest: 'yes' } },
    { type: 'node', id: 2, lat: 32.08102, lon: 34.77502, tags: { amenity: 'bench' } },
    { type: 'node', id: 3, lat: 32.09, lon: 34.76, tags: { tourism: 'viewpoint', name: 'תצפית הים', direction: 'W' } },
    { type: 'way', id: 4, center: { lat: 32.07, lon: 34.79 }, tags: { tourism: 'picnic_site', name: 'Picnic', 'name:he': 'חורשת הפיקניק' } },
    { type: 'node', id: 5, lat: 32.1, lon: 34.8, tags: { tourism: 'viewpoint', direction: 'E' } },
    { type: 'node', id: 6, lat: 32.1, lon: 34.8, tags: { shop: 'bakery' } },
    { type: 'way', id: 7, tags: { amenity: 'bench' } },
  ],
} as const;

test('geo helpers', () => {
  assert.ok(Math.abs(distanceMeters(HOME, { lat: 32.09, lon: 34.78 }) - 1112) < 5);
  assert.ok(Math.abs(bearingDegrees(HOME, { lat: 32.08, lon: 34.7 }) - 270) < 1);
  assert.equal(formatDistance(347), "350 מ'");
  assert.equal(formatDistance(2345), '2.3 ק"מ');
});

test('overpass query asks for every spot type around the user', () => {
  const q = buildOverpassQuery(HOME, 5000);
  assert.match(q, /^\[out:json\]/);
  assert.match(q, /nwr\(around:5000,32\.08,34\.78\)\["tourism"="viewpoint"\];/);
  assert.match(q, /\["amenity"="bench"\]/);
  assert.match(q, /out center tags;$/);
});

test('parseOverpass keeps known spot types, uses way centers and Hebrew names', () => {
  const spots = parseOverpass(FIXTURE as never);
  assert.deepEqual(spots.map((s) => s.id), ['node/1', 'node/2', 'node/3', 'way/4', 'node/5']);
  const picnic = spots.find((s) => s.id === 'way/4');
  assert.equal(picnic?.kind, 'picnic');
  assert.equal(picnic?.name, 'חורשת הפיקניק');
  assert.equal(picnic?.lat, 32.07);
});

test('mergeNearby turns a pair of benches into one place', () => {
  const merged = mergeNearby(parseOverpass(FIXTURE as never));
  assert.equal(merged.length, 4);
  const bench = merged.find((s) => s.kind === 'bench');
  assert.deepEqual(bench?.nearby, ['bench']);
});

test('parseDirection understands degrees, compass points and ranges', () => {
  assert.deepEqual(parseDirection('270'), { from: 240, to: 300 });
  assert.deepEqual(parseDirection('W'), { from: 240, to: 300 });
  assert.deepEqual(parseDirection('180-300'), { from: 180, to: 300 });
  assert.equal(parseDirection('somewhere'), null);
  assert.equal(parseDirection(undefined), null);
});

test('a viewpoint facing the sunset beats one facing east', () => {
  const merged = mergeNearby(parseOverpass(FIXTURE as never));
  const west = scoreSpot(merged.find((s) => s.id === 'node/3')!, HOME, SUNSET, 1);
  const east = scoreSpot(merged.find((s) => s.id === 'node/5')!, HOME, SUNSET, 1);
  assert.ok(west.view > east.view);
  assert.ok(west.reasons.includes('פונה לשקיעה'));
});

test('the slider moves the ranking between comfort and view', () => {
  const merged = mergeNearby(parseOverpass(FIXTURE as never));
  const comfort = rankSpots(merged, HOME, SUNSET, 0);
  const view = rankSpots(merged, HOME, SUNSET, 1);
  assert.equal(comfort[0].kind, 'picnic');
  assert.equal(view[0].id, 'node/3');
  for (const s of view) assert.ok(s.score >= 0 && s.score <= 100);
});

test('a blocked horizon pulls a spot down, an open one lifts it', () => {
  const merged = mergeNearby(parseOverpass(FIXTURE as never));
  const bench = merged.find((s) => s.kind === 'bench')!;
  const open = scoreSpot(bench, HOME, SUNSET, 1, { angle: 0, sea: false });
  const blocked = scoreSpot(bench, HOME, SUNSET, 1, { angle: 4, sea: false });
  const unknown = scoreSpot(bench, HOME, SUNSET, 1);
  assert.ok(open.view > unknown.view && unknown.view > blocked.view);
  assert.ok(open.reasons.includes('אופק פתוח'));
  assert.ok(blocked.reasons.includes('האופק חסום חלקית'));
});


test('roads query: main roads far, small streets near', async () => {
  const { buildRoadsQuery, parseRoads } = await import('../src/lib/osm.ts');
  const q = buildRoadsQuery(HOME, 10000);
  assert.match(q, /way\(around:10000,32\.08,34\.78\)\["highway"~"\^\(motorway\|trunk\|primary\|secondary\|tertiary\)\$"\]/);
  assert.match(q, /way\(around:3000,/);
  assert.match(q, /out geom;$/);
  const roads = parseRoads({
    elements: [
      { type: 'way', id: 1, tags: { highway: 'primary' }, geometry: [{ lat: 32, lon: 34.7 }, { lat: 32.1, lon: 34.8 }] },
      { type: 'way', id: 2, tags: { highway: 'residential' }, geometry: [{ lat: 32, lon: 34.7 }, { lat: 32.01, lon: 34.71 }] },
      { type: 'way', id: 3, tags: { highway: 'primary' }, geometry: [{ lat: 32, lon: 34.7 }] },
      { type: 'node', id: 4 },
    ],
  });
  assert.deepEqual(roads.map((r) => [r.id, r.major]), [['way/1', true], ['way/2', false]]);
});
