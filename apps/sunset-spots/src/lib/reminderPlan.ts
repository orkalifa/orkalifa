import { googleCalendarUrl, sunsetAlertTitle, type IcsEvent } from './ics.ts';
import type { LeadMinutes, Reminder, ReminderDays } from './reminders.ts';
import { formatClock } from './sun.ts';

/**
 * The reminder sheet's glue (F1c): the user's last choices, and reminder times -> calendar events.
 * Pure. Privacy: the events carry times and the generic Hebrew title only, never coordinates or
 * a place name (the location is used on the phone to compute the times, and stops there).
 */

export type ReminderPrefs = { days: ReminderDays; lead: LeadMinutes };

export const DEFAULT_PREFS: ReminderPrefs = { days: 1, lead: 60 };
export const PREFS_KEY = 'spotlight.reminderPrefs.v1';
/** A stored value is a tiny JSON object; anything longer isn't ours. */
const MAX_PREFS_CHARS = 200;

/** Stored prefs -> prefs. Missing, too long, corrupt or out-of-range fields -> the defaults. */
export function parsePrefs(raw: unknown): ReminderPrefs {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_PREFS_CHARS) return { ...DEFAULT_PREFS };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_PREFS };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ...DEFAULT_PREFS };
  const { days, lead } = data as Record<string, unknown>;
  return {
    days: days === 1 || days === 14 ? days : DEFAULT_PREFS.days,
    lead: lead === 15 || lead === 30 || lead === 60 ? lead : DEFAULT_PREFS.lead,
  };
}

export function serializePrefs(p: ReminderPrefs): string {
  return JSON.stringify({ days: p.days, lead: p.lead });
}

/** One calendar event per evening: golden hour to sunset, alert `lead` minutes before it starts. */
export function toIcsEvents(reminders: readonly Reminder[], lead: LeadMinutes, clock: (d: Date) => string = formatClock): IcsEvent[] {
  return reminders.map((r) => ({
    start: r.goldenHour,
    end: r.sunset,
    alertMinutesBefore: lead,
    title: sunsetAlertTitle(clock(r.sunset)),
    uidKey: `sunset-${r.day.replace(/-/g, '')}`,
  }));
}

/** Google Calendar link for the next evening only (Google sets the alert by the user's own default). */
export function googleEventFor(r: Reminder | undefined, clock: (d: Date) => string = formatClock): string | null {
  if (!r) return null;
  return googleCalendarUrl({ start: r.goldenHour, end: r.sunset, title: sunsetAlertTitle(clock(r.sunset)) });
}

/**
 * One "visit" of the sheet, so late async results can't leak into the wrong one:
 * - a stored-prefs read that finishes after the user already tapped a chip must not overwrite it;
 * - a calendar result that finishes after the sheet closed (or reopened) must not show its status.
 * `open()` and `close()` both start a new generation; work started in an older one is ignored.
 */
export type SheetSession = {
  open(): number;
  close(): void;
  current(): number;
  /** The user picked something during this visit. */
  touch(): void;
  /** May a stored-prefs read started in generation `id` still be applied? */
  acceptStored(id: number): boolean;
  isCurrent(id: number): boolean;
};

export function createSheetSession(): SheetSession {
  let gen = 0;
  let touched = false;
  return {
    open() {
      gen += 1;
      touched = false;
      return gen;
    },
    close() {
      gen += 1;
    },
    current: () => gen,
    touch() {
      touched = true;
    },
    acceptStored: (id) => id === gen && !touched,
    isCurrent: (id) => id === gen,
  };
}
