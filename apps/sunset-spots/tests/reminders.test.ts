/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToKey,
  intlJerusalemDayKey,
  israelFallbackDayKey,
  israelOffsetHours,
  jerusalemDayKey,
  reminderTimes,
  type LeadMinutes,
  type Reminder,
} from '../src/lib/reminders.ts';
import { getEveningLight } from '../src/lib/sun.ts';

// Tel Aviv area. All instants are UTC so results never depend on the machine's time zone.
const LAT = 32.08;
const LON = 34.78;
const MIN = 60 * 1000;

const israelHour = (d: Date) =>
  Number(d.toLocaleString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hourCycle: 'h23' }));

function assertConsecutive(list: Reminder[]) {
  for (let i = 1; i < list.length; i++) {
    assert.equal(list[i].day, addDaysToKey(list[i - 1].day, 1), `day after ${list[i - 1].day}`);
    assert.ok(list[i].goldenHour > list[i - 1].goldenHour);
    assert.ok(list[i].alertAt > list[i - 1].alertAt);
  }
}

test('alertAt is exactly leadMinutes before golden hour, the same golden hour the app shows', () => {
  const from = new Date('2026-10-18T03:00:00Z');
  for (const lead of [15, 30, 60] as LeadMinutes[]) {
    const [r] = reminderTimes({ lat: LAT, lon: LON, from, days: 1, leadMinutes: lead });
    assert.ok(r);
    assert.equal(r.day, '2026-10-18');
    assert.equal(r.goldenHour.getTime() - r.alertAt.getTime(), lead * MIN);
    const shown = getEveningLight(LAT, LON, from);
    assert.ok(shown);
    assert.equal(r.goldenHour.getTime(), shown.goldenHour.getTime());
    assert.equal(r.sunset.getTime(), shown.sunset.getTime());
    assert.ok(r.sunset > r.goldenHour);
  }
});

test('today, before the alert: today', () => {
  const list = reminderTimes({ lat: LAT, lon: LON, from: new Date('2026-10-18T06:00:00Z'), days: 1, leadMinutes: 60 });
  assert.equal(list.length, 1);
  assert.equal(list[0].day, '2026-10-18');
});

test("today's alert already passed (or is exactly now): tomorrow, never in the past", () => {
  const [today] = reminderTimes({ lat: LAT, lon: LON, from: new Date('2026-10-18T06:00:00Z'), days: 1, leadMinutes: 60 });
  for (const from of [new Date(today.alertAt.getTime() + MIN), new Date(today.alertAt.getTime())]) {
    const list = reminderTimes({ lat: LAT, lon: LON, from, days: 1, leadMinutes: 60 });
    assert.equal(list.length, 1);
    assert.equal(list[0].day, '2026-10-19');
    assert.ok(list[0].alertAt > from);
  }
});

test('every day: 14 consecutive days, strictly increasing, all in the future', () => {
  const from = new Date('2026-11-25T08:00:00Z');
  const list = reminderTimes({ lat: LAT, lon: LON, from, days: 14, leadMinutes: 30 });
  assert.equal(list.length, 14);
  assert.equal(list[0].day, '2026-11-25');
  assert.equal(list[13].day, '2026-12-08');
  assertConsecutive(list);
  for (const r of list) assert.ok(r.alertAt > from);
});

test('every day after tonight\'s alert starts tomorrow and still gives 14', () => {
  const list = reminderTimes({ lat: LAT, lon: LON, from: new Date('2026-11-25T15:00:00Z'), days: 14, leadMinutes: 60 });
  assert.equal(list.length, 14);
  assert.equal(list[0].day, '2026-11-26');
  assertConsecutive(list);
});

test('across both Israeli DST switches of 2026 the lead stays exact and days stay one each', () => {
  for (const [start, switchDay] of [
    ['2026-03-20T06:00:00Z', '2026-03-27'], // spring forward, Friday
    ['2026-10-18T06:00:00Z', '2026-10-25'], // fall back, Sunday
  ]) {
    for (const lead of [15, 30, 60] as LeadMinutes[]) {
      const list = reminderTimes({ lat: LAT, lon: LON, from: new Date(start), days: 14, leadMinutes: lead });
      assert.equal(list.length, 14);
      assertConsecutive(list);
      assert.ok(list.some((r) => r.day === switchDay));
      for (const r of list) {
        assert.equal(r.goldenHour.getTime() - r.alertAt.getTime(), lead * MIN, r.day);
        assert.equal(jerusalemDayKey(r.goldenHour), r.day);
        const h = israelHour(r.goldenHour);
        assert.ok(h >= 15 && h <= 19, `${r.day} golden hour at ${h}h`);
      }
    }
  }
});

test('polar latitudes skip days without golden hour and never throw', () => {
  for (const from of ['2026-06-10T06:00:00Z', '2026-12-10T06:00:00Z']) {
    const list = reminderTimes({ lat: 78, lon: 15, from: new Date(from), days: 14, leadMinutes: 60 });
    assert.equal(list.length, 0, from);
  }
  const lapland = reminderTimes({ lat: 69, lon: 20, from: new Date('2026-06-10T06:00:00Z'), days: 14, leadMinutes: 60 });
  assert.ok(lapland.length < 14);
});

test('bad input gives [] or the default lead, never throws', () => {
  const from = new Date('2026-10-18T06:00:00Z');
  assert.deepEqual(reminderTimes({ lat: NaN, lon: LON, from, days: 14, leadMinutes: 60 }), []);
  assert.deepEqual(reminderTimes({ lat: 91, lon: LON, from, days: 14, leadMinutes: 60 }), []);
  assert.deepEqual(reminderTimes({ lat: LAT, lon: LON, from: new Date('nope'), days: 14, leadMinutes: 60 }), []);
  const [r] = reminderTimes({ lat: LAT, lon: LON, from, days: 1, leadMinutes: 45 as unknown as LeadMinutes });
  assert.equal(r.goldenHour.getTime() - r.alertAt.getTime(), 60 * MIN);
  const odd = reminderTimes({ lat: LAT, lon: LON, from, days: 7 as unknown as 1, leadMinutes: 60 });
  assert.equal(odd.length, 1);
});

test('Israeli day keys around midnight and the DST switches', () => {
  const cases: [string, string][] = [
    ['2026-10-24T21:30:00Z', '2026-10-25'], // 00:30 IDT
    ['2026-10-24T20:30:00Z', '2026-10-24'], // 23:30 IDT
    ['2026-10-24T22:59:00Z', '2026-10-25'], // 01:59 IDT, just before fall back
    ['2026-10-24T23:00:00Z', '2026-10-25'], // 01:00 IST after fall back
    ['2026-10-25T21:59:00Z', '2026-10-25'], // 23:59 IST
    ['2026-10-25T22:00:00Z', '2026-10-26'],
    ['2026-03-26T21:59:00Z', '2026-03-26'], // 23:59 IST
    ['2026-03-26T22:30:00Z', '2026-03-27'], // 00:30 IST
    ['2026-03-26T23:59:00Z', '2026-03-27'], // 01:59 IST, just before spring forward
    ['2026-03-27T00:00:00Z', '2026-03-27'], // 03:00 IDT
    ['2026-03-27T21:00:00Z', '2026-03-28'], // 00:00 IDT
  ];
  for (const [iso, key] of cases) {
    const d = new Date(iso);
    assert.equal(intlJerusalemDayKey(d), key, `intl ${iso}`);
    assert.equal(israelFallbackDayKey(d), key, `fallback ${iso}`);
  }
  assert.equal(israelOffsetHours(new Date('2026-03-26T23:59:00Z')), 2);
  assert.equal(israelOffsetHours(new Date('2026-03-27T00:00:00Z')), 3);
  assert.equal(israelOffsetHours(new Date('2026-10-24T22:59:00Z')), 3);
  assert.equal(israelOffsetHours(new Date('2026-10-24T23:00:00Z')), 2);
});

test('the fallback rule matches Intl hour by hour, 2023-2027 (2023: March 31 is a Friday)', () => {
  for (let t = Date.UTC(2023, 0, 1); t < Date.UTC(2028, 0, 1); t += 60 * MIN) {
    const d = new Date(t);
    assert.equal(israelFallbackDayKey(d), intlJerusalemDayKey(d), d.toISOString());
  }
});

test('forcing the fallback gives the same reminders across the 2026 switches', () => {
  for (const start of ['2026-03-20T06:00:00Z', '2026-10-18T06:00:00Z']) {
    const opts = { lat: LAT, lon: LON, from: new Date(start), days: 14, leadMinutes: 60 } as const;
    const viaIntl = reminderTimes(opts);
    const viaFallback = reminderTimes({ ...opts, dayKey: israelFallbackDayKey });
    assert.deepEqual(viaFallback, viaIntl);
  }
});
