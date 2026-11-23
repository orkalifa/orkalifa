/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareUrl, parseSharedSpot, shareMessage, PUBLIC_URL } from '../src/lib/share.ts';
import { isMine, makeMySpot, parseStored, toSpot } from '../src/lib/myspots.ts';
import { scoreSpot } from '../src/lib/score.ts';

const query = (url: string) => Object.fromEntries(new URL(url).searchParams);

test('a shared link round-trips the spot, Hebrew name included', () => {
  const spot = { id: 'node/246825278', kind: 'peak' as const, lat: 31.82407, lon: 35.13018, name: 'גבעת הרדאר' };
  const url = buildShareUrl(spot);
  assert.ok(url.startsWith(PUBLIC_URL));
  assert.deepEqual(parseSharedSpot(query(url)), spot);
});

test('a link to your own spot works without a name', () => {
  const url = buildShareUrl({ id: 'mine/abc', kind: 'mine', lat: 32.1, lon: 34.9 });
  assert.deepEqual(parseSharedSpot(query(url)), { id: 'mine/abc', kind: 'mine', lat: 32.1, lon: 34.9, name: undefined });
});

test('broken or missing parameters give no spot', () => {
  assert.equal(parseSharedSpot({}), null);
  assert.equal(parseSharedSpot({ spot: 'node/1' }), null);
  assert.equal(parseSharedSpot({ spot: 'node/1', ll: 'abc' }), null);
  assert.equal(parseSharedSpot({ spot: 'node/1', ll: '95,10' }), null);
});

test('an unknown kind falls back to a viewpoint', () => {
  assert.equal(parseSharedSpot({ spot: 'x', ll: '32,35', k: 'castle' })?.kind, 'viewpoint');
});

test('share message names the place and the time', () => {
  const msg = shareMessage({ id: 'x', kind: 'bench', lat: 0, lon: 0 }, '16:41', false);
  assert.match(msg, /ספסל/);
  assert.match(msg, /היום ב־16:41/);
});

test('my spots: made, recognised and stored safely', () => {
  const mine = makeMySpot('  העץ הבודד  ', 32.123456, 34.987654, 1_700_000_000_000);
  assert.equal(mine.name, 'העץ הבודד');
  assert.equal(mine.lat, 32.12346);
  assert.ok(isMine(mine));
  assert.equal(makeMySpot('   ', 0, 0).name, 'המקום שלי');

  const stored = JSON.stringify([mine, { id: 'node/1', name: 'x', lat: 1, lon: 1, createdAt: 1 }, null, 'junk']);
  assert.deepEqual(parseStored(stored), [mine]);
  assert.deepEqual(parseStored('not json'), []);
  assert.deepEqual(parseStored(null), []);
});

test('your own spot ranks well and says it is yours', () => {
  const from = { lat: 32.1, lon: 34.9 };
  const mine = scoreSpot(toSpot(makeMySpot('העץ', 32.105, 34.9)), from, 260);
  const bench = scoreSpot({ id: 'node/2', kind: 'bench', lat: 32.105, lon: 34.9, tags: {}, nearby: [] }, from, 260);
  assert.ok(mine.score > bench.score);
  assert.ok(mine.reasons.includes('המקום שלך'));
});
