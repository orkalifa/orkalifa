import { getEveningLight } from './sun.ts';

// Sunset reminders, part 1: when to alert. Pure: no I/O, no clock reads, nothing leaves the device.
// Days are calendar days in Israel (Asia/Jerusalem); every Date is an absolute instant.

export type LeadMinutes = 15 | 30 | 60;
export type ReminderDays = 1 | 14;

export type Reminder = {
  /** Calendar day in Asia/Jerusalem, YYYY-MM-DD. */
  day: string;
  /** Start of that evening's golden hour (sun at +6°), the same one the app shows. */
  goldenHour: Date;
  sunset: Date;
  /** goldenHour minus the lead time. Always after `from`. */
  alertAt: Date;
};

export type ReminderOptions = {
  lat: number;
  lon: number;
  from: Date;
  /** 1 = "today" (or tomorrow if today's alert has passed); 14 = "every day" for the next 14 days. */
  days: ReminderDays;
  leadMinutes: LeadMinutes;
  /** Overrides how an instant maps to its Israeli calendar day (tests use it to force the fallback). */
  dayKey?: (date: Date) => string;
};

export const DEFAULT_LEAD: LeadMinutes = 60;
const LEADS: readonly number[] = [15, 30, 60];
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

const pad = (n: number) => String(n).padStart(2, '0');
const utcKey = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// --- Israeli calendar day -------------------------------------------------------------------

let formatter: Intl.DateTimeFormat | null | undefined;

/** The day via Intl's Asia/Jerusalem zone, or null where Intl time zones are missing or broken. */
export function intlJerusalemDayKey(date: Date): string | null {
  try {
    if (formatter === undefined) {
      formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    }
    if (!formatter || typeof formatter.formatToParts !== 'function') return null;
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const key = `${get('year')}-${get('month')}-${get('day')}`;
    return KEY_RE.test(key) ? key : null;
  } catch {
    formatter = null;
    return null;
  }
}

/** Last `weekday` (0 = Sunday) of a month, as a UTC day number. */
function lastWeekday(year: number, month: number, weekday: number): number {
  const last = new Date(Date.UTC(year, month + 1, 0));
  return last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7);
}

/**
 * Israel's fixed rule (since 2013): summer time (+3) from the Friday before the last Sunday of March
 * at 02:00 local (00:00 UTC) until the last Sunday of October at 02:00 local (Saturday 23:00 UTC);
 * otherwise +2. Only used when Intl can't do Asia/Jerusalem.
 */
export function israelOffsetHours(date: Date): number {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 2, lastWeekday(year, 2, 0) - 2, 0);
  const end = Date.UTC(year, 9, lastWeekday(year, 9, 0), 2) - 3 * HOUR_MS;
  const t = date.getTime();
  return t >= start && t < end ? 3 : 2;
}

export function israelFallbackDayKey(date: Date): string {
  return utcKey(new Date(date.getTime() + israelOffsetHours(date) * HOUR_MS));
}

export function jerusalemDayKey(date: Date): string {
  return intlJerusalemDayKey(date) ?? israelFallbackDayKey(date);
}

/** Calendar arithmetic on a day key — never "+24 h", so DST days stay one day each. */
export function addDaysToKey(key: string, n: number): string {
  const m = KEY_RE.exec(key);
  if (!m) return key;
  return utcKey(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n)));
}

/** 09:00 UTC = 11:00 or 12:00 in Israel: inside that Israeli day and before any evening. */
function noonAnchor(key: string): Date {
  const m = KEY_RE.exec(key)!;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 9));
}

const valid = (d: Date) => Number.isFinite(d.getTime());

// --- Reminder times -------------------------------------------------------------------------

/**
 * Alert times for the coming evenings. Days without a golden hour (polar) are skipped, so there
 * may be fewer than `days`; bad input gives []. Never throws, never returns an alert at or before `from`.
 */
export function reminderTimes(options: ReminderOptions): Reminder[] {
  const { lat, lon, from } = options;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90) return [];
  if (!(from instanceof Date) || !valid(from)) return [];
  const days = options.days === 14 ? 14 : 1;
  const lead = LEADS.includes(options.leadMinutes) ? options.leadMinutes : DEFAULT_LEAD;
  const leadMs = lead * MINUTE_MS;
  const dayKey = options.dayKey ?? jerusalemDayKey;

  const first = dayKey(from);
  if (!KEY_RE.test(first)) return [];
  const result: Reminder[] = [];
  // At most days + 1 calendar days: the extra one covers "today's alert has already passed".
  for (let i = 0; i <= days && result.length < days; i++) {
    const day = addDaysToKey(first, i);
    const light = getEveningLight(lat, lon, noonAnchor(day));
    if (!light || light.isTomorrow || !valid(light.goldenHour) || !valid(light.sunset)) continue;
    const alertAt = new Date(light.goldenHour.getTime() - leadMs);
    if (alertAt.getTime() <= from.getTime()) continue;
    result.push({ day, goldenHour: light.goldenHour, sunset: light.sunset, alertAt });
  }
  return result;
}
