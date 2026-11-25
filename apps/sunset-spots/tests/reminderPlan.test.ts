/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs } from '../src/lib/ics.ts';
import { createSheetSession, DEFAULT_PREFS, googleEventFor, parsePrefs, serializePrefs, toIcsEvents } from '../src/lib/reminderPlan.ts';
import { reminderTimes } from '../src/lib/reminders.ts';

const TLV = { lat: 32.0853, lon: 34.7818 };
const FROM = new Date('2026-11-25T08:00:00Z');
const clock = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

test('stored prefs: missing, corrupt or oversized -> defaults', () => {
  for (const raw of [null, undefined, '', '{', '[]', 'null', '42', JSON.stringify({ days: 7, lead: 45 }), 'x'.repeat(10_000)]) {
    assert.deepEqual(parsePrefs(raw), DEFAULT_PREFS, String(raw).slice(0, 20));
  }
  assert.deepEqual(DEFAULT_PREFS, { days: 1, lead: 60 });
});

test('stored prefs: valid values round-trip, bad fields fall back one by one', () => {
  assert.deepEqual(parsePrefs(serializePrefs({ days: 14, lead: 15 })), { days: 14, lead: 15 });
  assert.deepEqual(parsePrefs(JSON.stringify({ days: 14, lead: '30' })), { days: 14, lead: 60 });
  assert.deepEqual(parsePrefs(JSON.stringify({ days: 2, lead: 30 })), { days: 1, lead: 30 });
});

test('every day = 14 events, alert = lead, uid from the date', () => {
  const r = reminderTimes({ ...TLV, from: FROM, days: 14, leadMinutes: 30 });
  const events = toIcsEvents(r, 30, clock);
  assert.equal(events.length, 14);
  assert.equal(events[0].uidKey, 'sunset-20261125');
  for (const [i, e] of events.entries()) {
    assert.equal(e.start, r[i].goldenHour);
    assert.equal(e.end, r[i].sunset);
    assert.equal(e.alertMinutesBefore, 30);
    assert.match(e.uidKey, /^sunset-\d{8}$/);
    assert.match(e.title, /שקיעה ב־\d\d:\d\d$/);
  }
});

test('the calendar file: 14 VEVENTs, 60-minute alarm, CRLF, no coordinates', () => {
  const r = reminderTimes({ ...TLV, from: FROM, days: 14, leadMinutes: 60 });
  const ics = buildIcs(toIcsEvents(r, 60, clock), { now: FROM });
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 14);
  assert.equal(ics.match(/TRIGGER:-PT60M/g)?.length, 14);
  assert.equal(ics.replace(/\r\n/g, '').includes('\n'), false, 'no bare LF');
  assert.equal(ics.includes('\r\r'), false);
  for (const bad of ['32.', '34.', 'GEO', 'LOCATION']) assert.equal(ics.includes(bad), false, bad);
});

test('Google link: next evening only, no coordinates; none without a reminder', () => {
  assert.equal(googleEventFor(undefined), null);
  const [next] = reminderTimes({ ...TLV, from: FROM, days: 1, leadMinutes: 60 });
  const url = googleEventFor(next, clock);
  assert.ok(url?.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'));
  assert.equal(url?.includes('32.'), false);
  assert.equal(url?.includes('34.'), false);
});

test('sheet session: a late prefs read never overwrites a fresh tap', () => {
  const s = createSheetSession();
  const id = s.open();
  assert.equal(s.acceptStored(id), true, 'untouched: the stored value applies');
  s.touch();
  assert.equal(s.acceptStored(id), false, 'tapped before the read finished: keep the tap');
  const again = s.open();
  assert.equal(s.acceptStored(again), true, 'reopening starts clean');
  assert.equal(s.acceptStored(id), false, 'an older read never applies');
});

test('sheet session: a result that lands after close (or reopen) is dropped', () => {
  const s = createSheetSession();
  s.open();
  const started = s.current();
  assert.equal(s.isCurrent(started), true);
  s.close();
  assert.equal(s.isCurrent(started), false, 'closed while the download was in flight');
  s.open();
  assert.equal(s.isCurrent(started), false, 'still stale after reopening');
});
