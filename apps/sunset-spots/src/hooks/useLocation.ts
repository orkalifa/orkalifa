import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { distanceMeters } from '../lib/geo';

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

const FALLBACK: Coords = { latitude: 32.08, longitude: 34.78 }; // Tel Aviv
const LAST_KEY = 'spotlight.lastLocation.v1';
/** Moving less than this doesn't move the map. */
const MOVE_M = 150;
/** A last-known fix younger than this counts as where you are now. */
const RECENT_FIX_MS = 2 * 60 * 1000;

async function locate(): Promise<LocationState> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return { status: 'fallback', coords: FALLBACK, reason: 'denied' };
    // A last-known fix can be hours old and somewhere else (it's what you'd save, or log as a sunset
    // visit), so take it only if it's recent; otherwise ask the phone for a current one.
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: RECENT_FIX_MS, requiredAccuracy: 200 })) ??
      (await Location.getCurrentPositionAsync());
    const { latitude, longitude } = position.coords;
    return { status: 'ready', coords: { latitude, longitude }, fresh: true };
  } catch {
    return { status: 'fallback', coords: FALLBACK, reason: 'error' };
  }
}

/**
 * Don't wait forever: on the web an unanswered permission prompt (or a phone without a fix) would
 * leave the app on "מחפש את המיקום שלך" indefinitely. After this long, show the fallback instead;
 * "נסה שוב" asks again.
 */
const LOCATE_TIMEOUT_MS = 12000;

function locateWithTimeout(): Promise<LocationState> {
  return Promise.race([
    locate(),
    new Promise<LocationState>((resolve) =>
      setTimeout(() => resolve({ status: 'fallback', coords: FALLBACK, reason: 'error' }), LOCATE_TIMEOUT_MS),
    ),
  ]);
}

function readLast(raw: string | null): Coords | null {
  try {
    const c = raw ? JSON.parse(raw) : null;
    return c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude) ? { latitude: c.latitude, longitude: c.longitude } : null;
  } catch {
    return null;
  }
}

const meters = (a: Coords, b: Coords) => distanceMeters({ lat: a.latitude, lon: a.longitude }, { lat: b.latitude, lon: b.longitude });

/**
 * Where you are. Opens instantly on where you were last time (kept only on this phone), then
 * moves to the real fix when the phone has it.
 */
export function useLocation() {
  const [state, setState] = useState<LocationState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Last time's location first (milliseconds), so a quick failure below, like a permission
      // that's already denied, can still fall back to it rather than to Tel Aviv.
      const last = readLast(await AsyncStorage.getItem(LAST_KEY).catch(() => null));
      if (cancelled) return;
      if (last) setState((prev) => (prev.status === 'loading' ? { status: 'ready', coords: last, fresh: false } : prev));

      const next = await locateWithTimeout();
      if (cancelled) return;
      if (next.status === 'ready') {
        AsyncStorage.setItem(LAST_KEY, JSON.stringify(next.coords)).catch(() => {});
        setState((prev) => {
          const keep = prev.status !== 'loading' && meters(prev.coords, next.coords) < MOVE_M;
          return { status: 'ready', coords: keep ? prev.coords : next.coords, fresh: true, here: next.coords };
        });
      } else {
        // No fix now: if we were showing last time's place, stay there (and say so).
        setState((prev) =>
          prev.status === 'ready' && !prev.fresh ? { status: 'fallback', coords: prev.coords, reason: 'stale' } : next,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    // Keep showing the map while looking again; only the very first start shows the loading screen.
    setState((prev) => (prev.status === 'loading' ? prev : { status: 'ready', coords: prev.coords, fresh: false }));
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
