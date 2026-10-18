import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

export type Coords = { latitude: number; longitude: number };

export type LocationState =
  | { status: 'loading' }
  | { status: 'ready'; coords: Coords }
  // No permission or no fix: fall back to a sample spot so the screen still works.
  | { status: 'fallback'; coords: Coords; reason: 'denied' | 'error' };

const FALLBACK: Coords = { latitude: 32.08, longitude: 34.78 }; // Tel Aviv

async function locate(): Promise<LocationState> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return { status: 'fallback', coords: FALLBACK, reason: 'denied' };
    const position =
      (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync());
    const { latitude, longitude } = position.coords;
    return { status: 'ready', coords: { latitude, longitude } };
  } catch {
    return { status: 'fallback', coords: FALLBACK, reason: 'error' };
  }
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    locate().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
