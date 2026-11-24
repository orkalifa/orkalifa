import { distanceMeters, type LatLon } from './geo.ts';

/**
 * Sunsets you were at but didn't save: if the app is open (with a real location fix) between
 * golden hour and the end of the blue hour, that place is remembered, so you can come back
 * later and save it ("that was a good one"). Kept only on the phone, the last few only.
 */

export type Visit = LatLon & { at: number; place?: string };

export const MAX_VISITS = 8;
/** Closer than this, it's the same place. */
const SAME_PLACE_M = 300;

/** True while tonight's light is worth remembering: golden hour through the blue hour. */
export function isSunsetTime(now: Date, goldenHour: Date, blueHourEnd: Date): boolean {
  const t = now.getTime();
  return t >= goldenHour.getTime() && t <= blueHourEnd.getTime();
}

/**
 * The visit list with `here` added, or the same list if it adds nothing: you already have a
 * visit there, or it's one of your saved places.
 */
export function addVisit(visits: Visit[], here: LatLon, now: number, saved: LatLon[], place?: string): Visit[] {
  const near = (p: LatLon) => distanceMeters(p, here) <= SAME_PLACE_M;
  if (saved.some(near) || visits.some(near)) return visits;
  const visit: Visit = { lat: Number(here.lat.toFixed(5)), lon: Number(here.lon.toFixed(5)), at: now };
  if (place) visit.place = place;
  return [visit, ...visits].slice(0, MAX_VISITS);
}

/** Visits not yet saved as your own spot (saving one makes it drop off the list). */
export function unsavedVisits(visits: Visit[], saved: LatLon[]): Visit[] {
  return visits.filter((v) => !saved.some((s) => distanceMeters(s, v) <= SAME_PLACE_M));
}

export function parseVisits(raw: string | null): Visit[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (v): v is Visit =>
          !!v && typeof v === 'object' && Number.isFinite(v.lat) && Number.isFinite(v.lon) && Number.isFinite(v.at),
      )
      .slice(0, MAX_VISITS);
  } catch {
    return [];
  }
}

/** "23.11" */
export function formatDay(at: number): string {
  const d = new Date(at);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}
