import type { Spot } from './osm.ts';

/**
 * Places you saved yourself, like the lone tree by the field. They live only on your phone
 * (never sent anywhere); hooks/useMySpots.ts keeps them in the phone's storage.
 */

export type MySpot = { id: string; name: string; lat: number; lon: number; createdAt: number };

export const MAX_NAME = 40;

export function makeMySpot(name: string, lat: number, lon: number, now = Date.now()): MySpot {
  return {
    id: `mine/${now.toString(36)}`,
    name: name.trim().slice(0, MAX_NAME) || 'המקום שלי',
    lat: Number(lat.toFixed(5)),
    lon: Number(lon.toFixed(5)),
    createdAt: now,
  };
}

export function isMine(spot: { id: string }): boolean {
  return spot.id.startsWith('mine/');
}

/** As a spot the app can rank and show next to the ones from OpenStreetMap. */
export function toSpot(mine: MySpot): Spot {
  return { id: mine.id, kind: 'mine', name: mine.name, lat: mine.lat, lon: mine.lon, tags: {}, nearby: [] };
}

/** Reads what was stored, skipping anything broken instead of losing the whole list. */
export function parseStored(raw: string | null): MySpot[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.filter(
    (s): s is MySpot =>
      !!s &&
      typeof s === 'object' &&
      typeof s.id === 'string' &&
      s.id.startsWith('mine/') &&
      typeof s.name === 'string' &&
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lon) &&
      Number.isFinite(s.createdAt),
  );
}
