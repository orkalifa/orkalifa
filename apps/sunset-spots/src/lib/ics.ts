/**
 * Sunset reminders as a calendar file (RFC 5545 iCalendar) and as a Google Calendar link.
 *
 * Privacy — exactly what these produce: event times (UTC), a short generic Hebrew text
 * ("שעת הזהב מתחילה · שקיעה ב־19:42") and a UID made of the date ("sunset-20261125@spotlight").
 * No coordinates, no place name, nothing about the user. The .ics file stays on the device until
 * the user opens it in a calendar; the Google link sends the same times and text to Google.
 *
 * Times are written in UTC with a trailing Z, so there is no VTIMEZONE and no daylight-saving
 * guesswork: every calendar shows them in the phone's own time.
 */

export type IcsEvent = {
  start: Date;
  end: Date;
  alertMinutesBefore: number;
  title: string;
  description?: string;
  /** Becomes the UID: `<uidKey>@spotlight`. Letters, digits and dashes only, e.g. "sunset-20261125". */
  uidKey: string;
};

/** "Every day" is 14 events; anything past a month is a bug upstream, so it's cut. */
export const MAX_EVENTS = 31;
/** SUMMARY / DESCRIPTION / calendar name: short, so lines rarely need folding (F1d). */
export const MAX_TEXT = 60;
const MAX_ALERT_MINUTES = 1440;
const DEFAULT_ALERT_MINUTES = 60;
const MAX_EVENT_MS = 24 * 60 * 60 * 1000;
const UID_KEY = /^[A-Za-z0-9-]{1,64}$/;
const DEFAULT_TITLE = 'שעת הזהב מתחילה';
const PRODID = '-//Spotlight//Sunset Reminder//HE';
const GOOGLE_TEMPLATE = 'https://calendar.google.com/calendar/render';

/** Control characters, bidi controls and BOM/line separators: invisible, so never let them in. */
function isDropped(cp: number): boolean {
  return (
    (cp < 0x20 && cp !== 0x0a) ||
    (cp >= 0x7f && cp <= 0x9f) ||
    cp === 0x061c ||
    cp === 0x200e ||
    cp === 0x200f ||
    (cp >= 0x202a && cp <= 0x202e) ||
    (cp >= 0x2066 && cp <= 0x2069) ||
    cp === 0x2028 ||
    cp === 0x2029 ||
    cp === 0xfeff
  );
}

/**
 * Untrusted-ish text -> safe, short text: length capped before any other work, CR/CRLF -> LF,
 * invisible characters dropped, lone surrogates -> U+FFFD, at most `max` characters (code points).
 */
export function cleanText(raw: unknown, max = MAX_TEXT): string {
  if (typeof raw !== 'string') return '';
  let s = raw.slice(0, max * 4);
  // Don't leave half of a surrogate pair at the cut.
  const last = s.charCodeAt(s.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) s = s.slice(0, -1);
  s = s.replace(/\r\n?/g, '\n');
  const out: string[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (isDropped(cp)) continue;
    out.push(cp >= 0xd800 && cp <= 0xdfff ? '\uFFFD' : ch);
    if (out.length === max) break;
  }
  return out.join('').trim();
}

/** RFC 5545 TEXT escaping (3.3.11): backslash first, then ; , and newline. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function utf8Length(cp: number): number {
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

/**
 * RFC 5545 line folding (3.1): no line longer than 75 OCTETS of UTF-8, continuation lines start
 * with one space. Walks whole code points, so a Hebrew letter (2 bytes) or an emoji (4 bytes) is
 * never split between lines.
 */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const n = utf8Length(ch.codePointAt(0) ?? 0);
    if (bytes + n > 75) {
      out.push(current);
      current = ' ';
      bytes = 1;
    }
    current += ch;
    bytes += n;
  }
  out.push(current);
  return out.join('\r\n');
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** UTC date-time, e.g. 20261125T143500Z. */
function utcStamp(d: Date): string {
  return (
    `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function isUsableDate(d: unknown): d is Date {
  if (!(d instanceof Date)) return false;
  const t = d.getTime();
  if (!Number.isFinite(t)) return false;
  const year = d.getUTCFullYear();
  return year >= 1970 && year <= 9999;
}

/** Start and end are real dates, end after start, and the event is at most a day long. */
function usableSpan(start: unknown, end: unknown): start is Date {
  if (!isUsableDate(start) || !isUsableDate(end)) return false;
  const ms = end.getTime() - start.getTime();
  return ms > 0 && ms <= MAX_EVENT_MS;
}

function alertMinutes(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_ALERT_MINUTES;
  return Math.min(MAX_ALERT_MINUTES, Math.max(0, Math.round(raw)));
}

/** The event's title: "שעת הזהב מתחילה · שקיעה ב־19:42", or without the time if it isn't a clock. */
export function sunsetAlertTitle(clock: string): string {
  const c = typeof clock === 'string' ? clock.slice(0, 8) : '';
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(c) ? `${DEFAULT_TITLE} · שקיעה ב־${c}` : DEFAULT_TITLE;
}

/**
 * The whole calendar file as a string (CRLF line endings, UTF-8 text, no BOM). Malformed events
 * are skipped, never thrown on: a bad date, end not after start, a uidKey that isn't letters,
 * digits and dashes, or a repeated uidKey. Returns '' when no event is usable.
 */
export function buildIcs(
  events: readonly IcsEvent[],
  opts: { calendarName?: string; now?: Date } = {},
): string {
  if (!Array.isArray(events)) return '';
  const now = isUsableDate(opts.now) ? opts.now : new Date();
  const stamp = utcStamp(now);
  const seen = new Set<string>();
  const body: string[] = [];

  for (const e of events.slice(0, MAX_EVENTS)) {
    if (!e || typeof e !== 'object') continue;
    const key = typeof e.uidKey === 'string' ? e.uidKey.slice(0, 65) : '';
    if (!UID_KEY.test(key) || seen.has(key)) continue;
    if (!usableSpan(e.start, e.end)) continue;
    seen.add(key);
    const summary = escapeText(cleanText(e.title) || DEFAULT_TITLE);
    const description = escapeText(cleanText(e.description));
    body.push(
      'BEGIN:VEVENT',
      `UID:${key}@spotlight`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${utcStamp(e.start)}`,
      `DTEND:${utcStamp(e.end)}`,
      `SUMMARY:${summary}`,
      ...(description ? [`DESCRIPTION:${description}`] : []),
      // Free time: a sunset reminder shouldn't mark the user busy.
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${summary}`,
      `TRIGGER:-PT${alertMinutes(e.alertMinutesBefore)}M`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  if (body.length === 0) return '';

  const name = escapeText(cleanText(opts.calendarName));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...(name ? [`X-WR-CALNAME:${name}`] : []),
    ...body,
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * "Add to Google Calendar" for ONE event (the next golden hour). Google ignores VALARM in imported
 * files and its Android app can't import a multi-event file, so this link is the Google path; the
 * reminder then follows the user's Google default. Sends Google the times and the generic text
 * only. Returns null for an unusable event.
 */
export function googleCalendarUrl(event: {
  start: Date;
  end: Date;
  title: string;
  description?: string;
}): string | null {
  if (!event || typeof event !== 'object' || !usableSpan(event.start, event.end)) return null;
  const params = [
    'action=TEMPLATE',
    `text=${encodeURIComponent(cleanText(event.title) || DEFAULT_TITLE)}`,
    `dates=${utcStamp(event.start)}/${utcStamp(event.end)}`,
  ];
  const details = cleanText(event.description);
  if (details) params.push(`details=${encodeURIComponent(details)}`);
  return `${GOOGLE_TEMPLATE}?${params.join('&')}`;
}
