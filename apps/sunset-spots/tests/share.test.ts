/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareUrl, cleanName, parseSharedSpot, shareMessage, PUBLIC_URL } from '../src/lib/share.ts';
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

test('a link the app shares today still opens', () => {
  // Frozen copies of what buildShareUrl wrote before D5: links already sent must keep working.
  const peak =
    'https://orkalifa.github.io/orkalifa/?spot=node%2F246825278&ll=31.82407,35.13018&k=peak&n=%D7%92%D7%91%D7%A2%D7%AA%20%D7%94%D7%A8%D7%93%D7%90%D7%A8';
  assert.deepEqual(parseSharedSpot(query(peak)), {
    id: 'node/246825278', kind: 'peak', lat: 31.82407, lon: 35.13018, name: 'גבעת הרדאר',
  });
  const mine = 'https://orkalifa.github.io/orkalifa/?spot=mine%2Flx3k9a0b&ll=32.10000,34.90000&k=mine';
  assert.deepEqual(parseSharedSpot(query(mine)), { id: 'mine/lx3k9a0b', kind: 'mine', lat: 32.1, lon: 34.9, name: undefined });
});

test('coordinates must be exactly two numbers in range', () => {
  for (const ll of ['32,', ',35', '1,2,3', 'Infinity,0', '1e1,2', '0x10,2', '32,181', '-91,0', ' 32,35', '32 ,35', '']) {
    assert.equal(parseSharedSpot({ spot: 'node/1', ll }), null, `ll=${JSON.stringify(ll)}`);
  }
  assert.deepEqual(parseSharedSpot({ spot: 'node/1', ll: '-33.5,-70.6' }), { id: 'node/1', kind: 'viewpoint', lat: -33.5, lon: -70.6, name: undefined });
  assert.equal(parseSharedSpot({ spot: 'node/1', ll: '90,180' })?.lon, 180);
  assert.equal(parseSharedSpot({ spot: 'node/1', ll: '-0.00000,0.00000' })?.lat, -0);
});

test('a strange id gives no spot', () => {
  for (const id of ['<script>', 'node/1 2', 'node/' + '1'.repeat(30), '', '../x', 'node/', '/1', 'Node/1']) {
    assert.equal(parseSharedSpot({ spot: id, ll: '32,35' }), null, `id=${JSON.stringify(id)}`);
  }
  assert.equal(parseSharedSpot({ spot: 'relation/42', ll: '32,35' })?.id, 'relation/42');
});

test('only the id shapes the app makes are accepted', () => {
  for (const id of ['bogus/abc', 'node/notanumber', 'way/12a', 'mine/ABC', 'node/1234567890123456', 'mine/' + 'a'.repeat(25)]) {
    assert.equal(parseSharedSpot({ spot: id, ll: '32,35' }), null, `id=${JSON.stringify(id)}`);
  }
  for (const id of ['node/246825278', 'way/1', 'relation/42', 'mine/lx3k9a0b']) {
    assert.equal(parseSharedSpot({ spot: id, ll: '32,35' })?.id, id);
  }
});

test('huge parameters are bounded before any work', () => {
  const huge = 'א'.repeat(1_000_000);
  const started = performance.now();
  const name = cleanName(huge)!;
  const spot = parseSharedSpot({ spot: 'node/1', ll: '32,35', n: huge });
  assert.equal(parseSharedSpot({ spot: 'node/' + '1'.repeat(1_000_000), ll: '32,35' }), null);
  assert.equal(parseSharedSpot({ spot: 'node/1', ll: '3'.repeat(1_000_000) }), null);
  assert.ok(performance.now() - started < 200, 'returns quickly');
  assert.ok(Array.from(name).length <= 60);
  assert.ok(Array.from(spot!.name!).length <= 60);
});

test('names lose control and bidi characters and are capped', () => {
  assert.equal(cleanName('א\u202Eב\nג\u0007'), 'א ב ג');
  assert.equal(cleanName('a\u2066b\u2069c\u202Ad\u0085e\u007F'), 'a b c d e');
  assert.equal(cleanName('\u202E\u2066'), undefined);
  assert.equal(cleanName('   '), undefined);
  assert.equal(cleanName(undefined), undefined);
  assert.equal(cleanName('\u200Fא'), '\u200Fא', 'RLM stays');
  assert.equal(Array.from(cleanName('א'.repeat(200))!).length, 60);
  const emoji = cleanName('a'.repeat(59) + '\u{1F305}xyz')!;
  assert.equal(emoji, 'a'.repeat(59) + '\u{1F305}', 'the emoji is kept whole');
  assert.equal(parseSharedSpot({ spot: 'node/1', ll: '32,35', n: 'x\u202Ey' })?.name, 'x y');
});

test('the share message and link never carry a bidi override', () => {
  const dirty = { id: 'node/1', kind: 'bench' as const, lat: 32, lon: 35, name: 'evil\u202Etxt.exe' };
  assert.ok(!shareMessage(dirty, '16:41', false).includes('\u202E'));
  const url = buildShareUrl(dirty);
  assert.ok(!decodeURIComponent(url).includes('\u202E'));
  assert.equal(parseSharedSpot(query(url))?.name, 'evil txt.exe');
});

test('an unknown kind falls back to a viewpoint', () => {
  assert.equal(parseSharedSpot({ spot: 'node/1', ll: '32,35', k: 'castle' })?.kind, 'viewpoint');
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

test('counting is off until set up, and never carries a place', async () => {
  const { countUrl } = await import('../src/lib/stats.ts');
  assert.equal(countUrl('open', '', 'orkalifa.github.io'), null, 'off without a code');
  assert.equal(countUrl('open', 'spotlight', 'localhost:8765'), null, 'local tests never count');
  const open = new URL(countUrl('open', 'spotlight', 'orkalifa.github.io')!);
  assert.equal(open.host, 'spotlight.goatcounter.com');
  assert.equal(open.searchParams.get('p'), '/');
  const shared = new URL(countUrl('shared-link-opened', 'spotlight', 'orkalifa.github.io')!);
  assert.equal(shared.searchParams.get('p'), '/shared-link-opened');
  assert.equal(shared.searchParams.get('e'), 'true');
  assert.deepEqual([...shared.searchParams.keys()].sort(), ['e', 'p', 'rnd'], 'nothing else is sent');
});
