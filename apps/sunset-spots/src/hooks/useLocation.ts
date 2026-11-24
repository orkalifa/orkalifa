import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { FALLBACK, onResult, onRetry, type Coords, type LocationState } from '../lib/locationState';

export type { Coords, LocationState } from '../lib/locationState';

const LAST_KEY = 'spotlight.lastLocation.v1';
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
 * leave the app on "מחפש את המיקום שלך" indefinitely. After this long, show the fallback instead.
 * The attempt keeps going: a fix that arrives later (say the prompt is accepted at 20 s) still moves
 * you there; "נסה שוב" asks again.
 */
const LOCATE_TIMEOUT_MS = 12000;

function readLast(raw: string | null): Coords | null {
  try {
    const c = raw ? JSON.parse(raw) : null;
    return c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude) ? { latitude: c.latitude, longitude: c.longitude } : null;
  } catch {
    return null;
  }
}

/**
 * Where you are. Opens instantly on where you were last time (kept only on this phone), then
 * moves to the real fix when the phone has it.
 */
export function useLocation() {
  const [state, setState] = useState<LocationState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      // Last time's location first (milliseconds), so a quick failure below, like a permission
      // that's already denied, can still fall back to it rather than to Tel Aviv.
      const last = readLast(await AsyncStorage.getItem(LAST_KEY).catch(() => null));
      if (cancelled) return;
      if (last) setState((prev) => (prev.status === 'loading' ? { status: 'ready', coords: last, fresh: false } : prev));

      const apply = (next: LocationState) => {
        if (next.status === 'ready') AsyncStorage.setItem(LAST_KEY, JSON.stringify(next.coords)).catch(() => {});
        setState((prev) => onResult(prev, next));
      };
      let timedOut = false;
      timer = setTimeout(() => {
        timedOut = true;
        if (!cancelled) apply({ status: 'fallback', coords: FALLBACK, reason: 'error' });
      }, LOCATE_TIMEOUT_MS);
      const result = await locate();
      clearTimeout(timer);
      if (cancelled) return;
      // After the timeout only a real fix is news; a late failure would just repeat the fallback.
      if (!timedOut || result.status === 'ready') apply(result);
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attempt]);

  const retry = useCallback(() => {
    // Keep showing the map while looking again; only the very first start shows the loading screen.
    setState(onRetry);
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
