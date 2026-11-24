import type { LatLon } from './geo.ts';
import { rayOrigin, type Horizon } from './horizon.ts';

/**
 * Persistent horizon cache. Terrain doesn't change and tonight's sunset bearing drifts only ~0.2° a day,
 * so a horizon keyed by spot + whole-degree bearing stays valid for weeks. Pure logic only: the hook
 * (`useHorizons`) does the storage and network side.
 */

export const HORIZON_CACHE_KEY = 'spotlight.horizons.v1';
export const MAX_AGE_MS = 42 * 24 * 60 * 60 * 1000;
export const MAX_ENTRIES = 400;
/** After a failed fetch, don't retry the same spots for this long (avoids a retry loop). */
export const FAILED_RETRY_MS = 60 * 1000;

export type HorizonCache = { v: 1; entries: Record<string, { h: Horizon; t: number }> };
export type CacheSpot = LatLon & { id: string; kind?: string };
export type HorizonsState = { status: 'idle' | 'ready' | 'error'; horizons: Record<string, Horizon> };

export const emptyHorizonCache = (): HorizonCache => ({ v: 1, entries: {} });

const normalizeBearing = (bearing: number) => ((Math.round(bearing) % 360) + 360) % 360;

/**
 * Cache key: spot id + whole-degree bearing. A saved place ('mine') can be moved or re-saved under the
 * same id, so its key also carries the ray origin, which is already rounded to ~100 m (the exact point is
 * never stored).
 */
export function horizonCacheKey(spot: CacheSpot, bearing: number): string {
  const key = `${spot.id}|${normalizeBearing(bearing)}`;
  if (spot.kind !== 'mine') return key;
  const o = rayOrigin(spot);
  return `${key}|${o.lat},${o.lon}`;
}

const isHorizon = (h: unknown): h is Horizon =>
  typeof h === 'object' &&
  h !== null &&
  typeof (h as Horizon).angle === 'number' &&
  Number.isFinite((h as Horizon).angle) &&
  typeof (h as Horizon).sea === 'boolean';

/** Parse stored JSON. Anything malformed is dropped; never throws. */
export function parseHorizonCache(raw: string | null): HorizonCache {
  if (!raw) return emptyHorizonCache();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyHorizonCache();
  }
  const d = data as { v?: unknown; entries?: unknown };
  if (!d || typeof d !== 'object' || d.v !== 1 || !d.entries || typeof d.entries !== 'object') {
    return emptyHorizonCache();
  }
  const entries: HorizonCache['entries'] = {};
  for (const [key, e] of Object.entries(d.entries as Record<string, unknown>)) {
    const entry = e as { h?: unknown; t?: unknown };
    if (entry && isHorizon(entry.h) && typeof entry.t === 'number' && Number.isFinite(entry.t)) {
      entries[key] = { h: { angle: entry.h.angle, sea: entry.h.sea }, t: entry.t };
    }
  }
  return { v: 1, entries };
}

const fresh = (t: number, now: number) => t <= now && now - t <= MAX_AGE_MS;

/** Split spots into cached horizons (by spot id) and spots still missing. Expired entries are misses. */
export function lookupHorizons<S extends CacheSpot>(
  cache: HorizonCache,
  spots: S[],
  bearing: number,
  now: number,
): { hits: Record<string, Horizon>; missing: S[] } {
  const hits: Record<string, Horizon> = {};
  const missing: S[] = [];
  for (const s of spots) {
    const e = cache.entries[horizonCacheKey(s, bearing)];
    if (e && fresh(e.t, now)) hits[s.id] = e.h;
    else missing.push(s);
  }
  return { hits, missing };
}

/** New cache with `results` (by spot id) added, expired entries dropped and only the newest MAX_ENTRIES kept. */
export function storeHorizons(
  cache: HorizonCache,
  spots: CacheSpot[],
  bearing: number,
  results: Record<string, Horizon>,
  now: number,
): HorizonCache {
  const all: HorizonCache['entries'] = {};
  for (const [k, e] of Object.entries(cache.entries)) if (fresh(e.t, now)) all[k] = e;
  for (const s of spots) {
    const h = results[s.id];
    if (h) all[horizonCacheKey(s, bearing)] = { h, t: now };
  }
  const kept = Object.entries(all)
    .sort((a, b) => b[1].t - a[1].t)
    .slice(0, MAX_ENTRIES);
  return { v: 1, entries: Object.fromEntries(kept) };
}

/**
 * Which missing spots to fetch now. Spots already being fetched (by cache key) are waited for, not
 * fetched twice; spots whose fetch failed less than FAILED_RETRY_MS ago count as failed.
 */
export function planFetch<S extends CacheSpot>(
  missing: S[],
  bearing: number,
  inFlight: ReadonlySet<string>,
  failedAt: ReadonlyMap<string, number>,
  now: number,
): { toFetch: S[]; waiting: S[]; failed: S[] } {
  const toFetch: S[] = [];
  const waiting: S[] = [];
  const failed: S[] = [];
  for (const s of missing) {
    const key = horizonCacheKey(s, bearing);
    const f = failedAt.get(key);
    if (inFlight.has(key)) waiting.push(s);
    else if (f !== undefined && now - f < FAILED_RETRY_MS) failed.push(s);
    else toFetch.push(s);
  }
  return { toFetch, waiting, failed };
}

/** State after a round: on success cached + fetched; on error the earlier results are kept, not wiped. */
export function horizonsAfterFetch(
  prev: Record<string, Horizon>,
  hits: Record<string, Horizon>,
  result: { ok: true; horizons: Record<string, Horizon> } | { ok: false },
): HorizonsState {
  if (result.ok) return { status: 'ready', horizons: { ...hits, ...result.horizons } };
  return { status: 'error', horizons: { ...prev, ...hits } };
}
