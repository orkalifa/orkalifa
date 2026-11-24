import { distanceMeters } from './geo.ts';

/**
 * Pure state transitions for hooks/useLocation.ts, kept here so they can be tested without React.
 */

export type Coords = { latitude: number; longitude: number };

export type LocationState =
  | { status: 'loading' }
  /**
   * `fresh`: false while showing where you were last time (instant start) and the phone is still
   * finding you. `here` is the exact fix (for saving a spot); `coords` only moves when you have,
   * so a few meters of GPS jitter don't reload the map.
   */
  | { status: 'ready'; coords: Coords; fresh: boolean; here?: Coords }
  // No permission or no fix: fall back to where you were last time, or to a sample spot.
  | { status: 'fallback'; coords: Coords; reason: 'denied' | 'error' | 'stale' };

export const FALLBACK: Coords = { latitude: 32.08, longitude: 34.78 }; // Tel Aviv
/** Moving less than this doesn't move the map. */
export const MOVE_M = 150;

export const meters = (a: Coords, b: Coords) =>
  distanceMeters({ lat: a.latitude, lon: a.longitude }, { lat: b.latitude, lon: b.longitude });

/**
 * "נסה שוב" pressed. A fallback stays as it is (same place, same reason) until the new attempt
 * answers; before, it became a not-fresh "ready" at Tel Aviv, and a second failure then read as
 * "last known location".
 */
export function onRetry(prev: LocationState): LocationState {
  if (prev.status === 'ready') return { status: 'ready', coords: prev.coords, fresh: false };
  return prev;
}

/** The result of one attempt to locate (a fix, or a failure) applied to the current state. */
export function onResult(prev: LocationState, next: LocationState): LocationState {
  if (next.status === 'ready') {
    const keep = prev.status !== 'loading' && meters(prev.coords, next.coords) < MOVE_M;
    return { status: 'ready', coords: keep ? prev.coords : next.coords, fresh: true, here: next.coords };
  }
  if (next.status !== 'fallback') return next;
  // No fix now: if we were showing last time's place, stay there (and say so).
  if (prev.status === 'ready' && !prev.fresh) return { status: 'fallback', coords: prev.coords, reason: 'stale' };
  if (prev.status === 'fallback' && prev.reason === 'stale') return prev;
  return next;
}
