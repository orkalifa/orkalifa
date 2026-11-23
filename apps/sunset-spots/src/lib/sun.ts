import { addTime, getPosition, getTimes, times as sunTimes } from 'suncalc';

// Photographers' evening light: golden hour runs from the sun at +6° down to -4°, then the blue
// hour from -4° to -6° (civil dusk). SunCalc already knows +6° (goldenHour) and -6° (dusk).
const BLUE_START = 'blueHourStart';
if (!sunTimes.some(([, , evening]) => evening === BLUE_START)) addTime(-4, 'blueHourEndMorning', BLUE_START);

export type SunsetInfo = {
  /** The next sunset: today's if it hasn't happened yet, otherwise tomorrow's. */
  sunset: Date;
  /** Start of the evening golden hour before that sunset. */
  goldenHour: Date;
  /** Compass bearing of the sun at sunset, degrees clockwise from true north. */
  bearing: number;
  isTomorrow: boolean;
  /** End of the golden hour and start of the blue hour (sun 4° below the horizon). */
  blueHour: Date;
  /** End of the blue hour (civil dusk, sun 6° below the horizon). */
  blueHourEnd: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeBearing(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** Returns null where the sun doesn't set (polar day/night). */
export function getSunsetInfo(lat: number, lon: number, now: Date = new Date()): SunsetInfo | null {
  let times = getTimes(now, lat, lon);
  let isTomorrow = false;
  if (times.sunset && times.sunset.getTime() <= now.getTime()) {
    times = getTimes(new Date(now.getTime() + DAY_MS), lat, lon);
    isTomorrow = true;
  }
  const { sunset, goldenHour, dusk } = times;
  const blueHour = times[BLUE_START];
  if (!sunset || !goldenHour || !dusk || !(blueHour instanceof Date)) return null;
  // SunCalc 2.x reports azimuth in degrees, clockwise from north.
  const { azimuth } = getPosition(sunset, lat, lon);
  return { sunset, goldenHour, bearing: normalizeBearing(azimuth), isTomorrow, blueHour, blueHourEnd: dusk };
}

// Eight points are plenty to know which way to face, and short enough to read at a glance.
// Across Israel the sunset is always דרום־מערב, מערב or צפון־מערב.
const DIRECTIONS = ['צפון', 'צפון־מזרח', 'מזרח', 'דרום־מזרח', 'דרום', 'דרום־מערב', 'מערב', 'צפון־מערב'];

export function bearingToHebrew(bearing: number): string {
  const index = Math.round(normalizeBearing(bearing) / 45) % 8;
  return DIRECTIONS[index];
}

export function formatClock(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "1:12 שע'" for an hour or more, "24 דק'" below that. */
export function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')} שע'`;
  return `${minutes} דק'`;
}

/** Signed angle from `from` to `to` in degrees, in the range (-180, 180]. */
export function angleBetween(from: number, to: number): number {
  const diff = (((to - from) % 360) + 360) % 360;
  return diff > 180 ? diff - 360 : diff;
}
