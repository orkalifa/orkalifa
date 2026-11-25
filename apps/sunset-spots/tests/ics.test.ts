/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIcs,
  cleanText,
  escapeText,
  foldLine,
  googleCalendarUrl,
  MAX_EVENTS,
  MAX_TEXT,
  sunsetAlertTitle,
  type IcsEvent,
} from '../src/lib/ics.ts';
import { addToCalendar, ICS_FILE_NAME, webEnv, type WebEnv } from '../src/lib/addToCalendar.ts';

const NOW = new Date(Date.UTC(2026, 10, 25, 8, 0, 0));
const DAY = 24 * 60 * 60 * 1000;

/** Fourteen golden hours: 14:35Z, a minute earlier each day, 25 minutes long. */
function twoWeeks(alert = 60): IcsEvent[] {
  return Array.from({ length: 14 }, (_, i) => {
    const start = new Date(Date.UTC(2026, 10, 25, 14, 35) + i * DAY - i * 60_000);
    const end = new Date(start.getTime() + 25 * 60_000);
    const ymd = start.toISOString().slice(0, 10).replace(/-/g, '');
    return {
      start,
      end,
      alertMinutesBefore: alert,
      title: sunsetAlertTitle('19:42'),
      description: 'פותחים את Spotlight, רואים לאן ללכת',
      uidKey: `sunset-${ymd}`,
    };
  });
}

const lines = (ics: string) => ics.slice(0, -2).split('\r\n');
const unfold = (ics: string) => ics.replace(/\r\n /g, '');
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('text escaping: backslash, comma, semicolon and newline', () => {
  assert.equal(escapeText('a\\b,c;d\ne'), 'a\\\\b\\,c\\;d\\ne');
  assert.equal(escapeText(cleanText('x\r\ny\rz')), 'x\\ny\\nz');
  const ics = buildIcs([{ ...twoWeeks()[0], title: 'a,b;c\\d' }], { now: NOW });
  assert.ok(ics.includes('\r\nSUMMARY:a\\,b\\;c\\\\d\r\n'));
});

test('invisible characters are dropped and text is capped', () => {
  assert.equal(cleanText('a\u0000b\u200Fc\u202Ed\uFEFFe\u0007'), 'abcde');
  assert.equal(cleanText('x\uD800y'), 'x\uFFFDy');
  assert.equal(Array.from(cleanText('ש'.repeat(10_000))).length, MAX_TEXT);
  assert.equal(cleanText(42), '');
});

test('folding at 75 octets never splits a Hebrew letter or an emoji, and unfolds back', () => {
  const long = 'SUMMARY:' + 'שקיעה 🌅 בחוף, '.repeat(20);
  const folded = foldLine(long);
  for (const line of folded.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `${Buffer.byteLength(line)} bytes`);
    assert.ok(line.isWellFormed(), 'no half surrogate pair');
    assert.equal(Buffer.from(line, 'utf8').toString('utf8'), line);
  }
  assert.ok(folded.split('\r\n').length > 3);
  assert.equal(folded.replace(/\r\n /g, ''), long);

  // A full-length Hebrew title in a real file folds too, and unfolds to the escaped text.
  const title = 'ש'.repeat(30) + ', ' + '🌅'.repeat(28);
  const ics = buildIcs([{ ...twoWeeks()[0], title }], { now: NOW });
  for (const line of lines(ics)) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
  assert.ok(unfold(ics).includes(`\r\nSUMMARY:${escapeText(cleanText(title))}\r\n`));
});

test('CRLF line endings only, no BOM, trailing CRLF', () => {
  const ics = buildIcs(twoWeeks(), { now: NOW, calendarName: 'Spotlight' });
  assert.equal(count(ics, /(?<!\r)\n/g), 0, 'bare LF');
  assert.equal(count(ics, /\r(?!\n)/g), 0, 'bare CR');
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.notEqual(ics.charCodeAt(0), 0xfeff);
});

test('header lines, and every BEGIN has its END', () => {
  const ics = buildIcs(twoWeeks(), { now: NOW, calendarName: 'שקיעות; Spotlight' });
  assert.deepEqual(lines(ics).slice(0, 6), [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Spotlight//Sunset Reminder//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:שקיעות\\; Spotlight',
  ]);
  for (const [name, n] of [['VCALENDAR', 1], ['VEVENT', 14], ['VALARM', 14]] as const) {
    assert.equal(count(ics, new RegExp(`^BEGIN:${name}\r$`, 'gm')), n, `BEGIN:${name}`);
    assert.equal(count(ics, new RegExp(`^END:${name}\r$`, 'gm')), n, `END:${name}`);
  }
});

test('14 events: 14 VEVENTs, each with a VALARM, times in UTC', () => {
  const ics = buildIcs(twoWeeks(), { now: NOW });
  assert.equal(count(ics, /^BEGIN:VEVENT\r$/gm), 14);
  assert.equal(count(ics, /^BEGIN:VALARM\r$/gm), 14);
  assert.equal(count(ics, /^ACTION:DISPLAY\r$/gm), 14);
  assert.equal(count(ics, /^TRANSP:TRANSPARENT\r$/gm), 14);
  const starts = lines(ics).filter((l) => l.startsWith('DTSTART:'));
  assert.equal(starts.length, 14);
  for (const l of [...starts, ...lines(ics).filter((x) => /^(DTEND|DTSTAMP):/.test(x))]) {
    assert.match(l, /^[A-Z]+:\d{8}T\d{6}Z$/);
  }
  assert.equal(starts[0], 'DTSTART:20261125T143500Z');
  assert.ok(ics.includes('\r\nDTEND:20261125T150000Z\r\n'));
  assert.ok(ics.includes('\r\nDTSTAMP:20261125T080000Z\r\n'));
});

test('VALARM trigger is N minutes before; bad values clamp', () => {
  const trigger = (alert: number) => buildIcs([twoWeeks(alert)[0]], { now: NOW }).match(/TRIGGER:(.*)\r/)?.[1];
  assert.equal(trigger(60), '-PT60M');
  assert.equal(trigger(15), '-PT15M');
  assert.equal(trigger(30.4), '-PT30M');
  assert.equal(trigger(Number.NaN), '-PT60M');
  assert.equal(trigger(99_999), '-PT1440M');
  assert.equal(trigger(-5), '-PT0M');
});

test('UIDs are deterministic, unique and carry nothing but the date', () => {
  const a = buildIcs(twoWeeks(), { now: NOW });
  assert.equal(buildIcs(twoWeeks(), { now: NOW }), a);
  const uids = lines(a).filter((l) => l.startsWith('UID:'));
  assert.equal(uids[0], 'UID:sunset-20261125@spotlight');
  assert.equal(new Set(uids).size, 14);
  for (const u of uids) assert.match(u, /^UID:sunset-\d{8}@spotlight$/);
  // Another day's export only changes DTSTAMP.
  const b = buildIcs(twoWeeks(), { now: new Date(NOW.getTime() + DAY) });
  assert.equal(a.replace(/DTSTAMP:\w+/g, ''), b.replace(/DTSTAMP:\w+/g, ''));
});

test('no coordinates: no decimal numbers anywhere in the file', () => {
  const ics = buildIcs(twoWeeks(), { now: NOW, calendarName: 'Spotlight' });
  // VERSION:2.0 is the only number with a dot, and it's the format's own version.
  const rest = unfold(ics).replace('\r\nVERSION:2.0\r\n', '\r\n');
  assert.doesNotMatch(rest, /\d+\.\d+/);
  assert.doesNotMatch(rest, /\d{2,3}\.\d{3,}/);
});

test('malformed events are skipped, never thrown on', () => {
  const ok = twoWeeks()[0];
  const bad = [
    { ...ok, uidKey: 'bad key' },
    { ...ok, uidKey: 'x'.repeat(65) },
    { ...ok, uidKey: 'sunset-1', start: new Date(Number.NaN) },
    { ...ok, uidKey: 'sunset-2', end: ok.start },
    { ...ok, uidKey: 'sunset-3', end: new Date(ok.start.getTime() + 2 * DAY) },
    { ...ok, uidKey: 'sunset-4', start: 'tomorrow' as unknown as Date },
    null as unknown as IcsEvent,
  ];
  assert.equal(buildIcs(bad, { now: NOW }), '');
  assert.equal(buildIcs(undefined as unknown as IcsEvent[]), '');
  // A repeated uidKey keeps only the first.
  assert.equal(count(buildIcs([ok, ok], { now: NOW }), /^BEGIN:VEVENT\r$/gm), 1);
  // A huge title is cut; an empty one falls back to the generic title.
  const big = buildIcs([{ ...ok, title: 'ש'.repeat(10_000) }], { now: NOW });
  assert.ok(unfold(big).includes(`SUMMARY:${'ש'.repeat(MAX_TEXT)}\r\n`));
  assert.ok(buildIcs([{ ...ok, title: '\u0000' }], { now: NOW }).includes('SUMMARY:שעת הזהב מתחילה\r\n'));
  // More than a month of events is cut to MAX_EVENTS.
  const many = Array.from({ length: 40 }, (_, i) => ({ ...ok, uidKey: `sunset-${i}` }));
  assert.equal(count(buildIcs(many, { now: NOW }), /^BEGIN:VEVENT\r$/gm), MAX_EVENTS);
});

test('the title helper takes only a clock', () => {
  assert.equal(sunsetAlertTitle('19:42'), 'שעת הזהב מתחילה · שקיעה ב־19:42');
  assert.equal(sunsetAlertTitle('7:05'), 'שעת הזהב מתחילה · שקיעה ב־7:05');
  assert.equal(sunsetAlertTitle('31.82,35.13'), 'שעת הזהב מתחילה');
  assert.equal(sunsetAlertTitle('25:00'), 'שעת הזהב מתחילה');
});

test('Google Calendar link: one event, UTC dates, encoded text', () => {
  const ev = { ...twoWeeks()[0], description: 'a&b=c #d\nשורה' };
  const url = googleCalendarUrl(ev);
  assert.ok(url);
  assert.ok(url.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE&'));
  const q = new URL(url).searchParams;
  assert.equal(q.get('action'), 'TEMPLATE');
  assert.equal(q.get('text'), sunsetAlertTitle('19:42'));
  assert.equal(q.get('dates'), '20261125T143500Z/20261125T150000Z');
  assert.equal(q.get('details'), 'a&b=c #d\nשורה');
  assert.equal([...q.keys()].length, 4, 'no extra parameters smuggled in');
  assert.doesNotMatch(url, /\d+\.\d+/);
  const noDetails = googleCalendarUrl({ ...ev, description: undefined });
  assert.equal(new URL(noDetails ?? '').searchParams.has('details'), false);
  assert.equal(googleCalendarUrl({ ...ev, end: ev.start }), null);
  assert.equal(googleCalendarUrl({ ...ev, title: 'x\uD800' }) !== null, true, 'lone surrogate does not throw');
});

// --- delivery ---------------------------------------------------------------------------

type Fake = {
  env: WebEnv;
  clicked: { href: string; download: string }[];
  blobs: Blob[];
  revoked: string[];
  timers: (() => void)[];
  shared: File[][];
};

function fakeEnv(opts: { downloadAttr?: boolean; canShare?: boolean; shareError?: string; clickThrows?: boolean } = {}): Fake {
  const f: Fake = { clicked: [], blobs: [], revoked: [], timers: [], shared: [], env: undefined as unknown as WebEnv };
  const attached = new Set<unknown>();
  f.env = {
    document: {
      createElement: () => {
        const a = {
          href: '',
          rel: '',
          style: { display: '' },
          click() {
            if (opts.clickThrows) throw new Error('blocked');
            assert.ok(attached.has(a), 'clicked while attached');
            f.clicked.push({ href: a.href, download: a.download });
          },
        } as { href: string; rel: string; style: { display: string }; click(): void; download: string };
        if (opts.downloadAttr !== false) a.download = '';
        return a;
      },
      body: {
        appendChild: (n) => attached.add(n),
        removeChild: (n) => attached.delete(n),
      },
    },
    URL: {
      createObjectURL: (b) => {
        f.blobs.push(b);
        return `blob:fake/${f.blobs.length}`;
      },
      revokeObjectURL: (u) => {
        f.revoked.push(u);
      },
    },
    navigator: {
      canShare: () => opts.canShare ?? false,
      share: async (d) => {
        f.shared.push(d.files);
        if (opts.shareError) throw Object.assign(new Error('x'), { name: opts.shareError });
      },
    },
    setTimeout: (fn) => f.timers.push(fn),
  };
  return f;
}

test('delivery: download is the default, and the object URL is revoked later', async () => {
  const ics = buildIcs(twoWeeks(), { now: NOW });
  const f = fakeEnv({ canShare: true });
  assert.equal(await addToCalendar(ics, f.env), 'downloaded');
  assert.deepEqual(f.clicked, [{ href: 'blob:fake/1', download: ICS_FILE_NAME }]);
  assert.equal(f.shared.length, 0, 'no share sheet when a download works');
  assert.equal(f.blobs[0].type, 'text/calendar');
  const bytes = new Uint8Array(await f.blobs[0].arrayBuffer());
  assert.notDeepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], 'no BOM');
  assert.equal(new TextDecoder().decode(bytes), ics);
  assert.deepEqual(f.revoked, [], 'not revoked during the click');
  f.timers.forEach((t) => t());
  assert.deepEqual(f.revoked, ['blob:fake/1']);
});

test('delivery: the share menu is only a fallback when a download is not possible', async () => {
  const ics = buildIcs(twoWeeks(), { now: NOW });
  const noAttr = fakeEnv({ downloadAttr: false, canShare: true });
  assert.equal(await addToCalendar(ics, noAttr.env), 'shared');
  assert.equal(noAttr.shared[0][0].name, ICS_FILE_NAME);
  assert.equal(noAttr.shared[0][0].type, 'text/calendar');

  const clickFails = fakeEnv({ clickThrows: true, canShare: true });
  assert.equal(await addToCalendar(ics, clickFails.env), 'shared');
  assert.deepEqual(clickFails.revoked, ['blob:fake/1'], 'a failed download frees its URL at once');

  assert.equal(await addToCalendar(ics, fakeEnv({ downloadAttr: false, canShare: true, shareError: 'AbortError' }).env), 'cancelled');
  assert.equal(await addToCalendar(ics, fakeEnv({ downloadAttr: false, canShare: true, shareError: 'NotAllowedError' }).env), 'failed');
  assert.equal(await addToCalendar(ics, fakeEnv({ downloadAttr: false, canShare: false }).env), 'failed');
});

test('delivery: native builds are unsupported, empty or oversized files fail', async () => {
  assert.equal(webEnv(), null, 'Node has no DOM, like a native build');
  assert.equal(await addToCalendar('BEGIN:VCALENDAR'), 'unsupported');
  assert.equal(await addToCalendar('', fakeEnv().env), 'failed');
  assert.equal(await addToCalendar('x'.repeat(300_000), fakeEnv().env), 'failed');
});
