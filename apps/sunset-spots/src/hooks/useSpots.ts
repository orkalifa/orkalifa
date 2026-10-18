import { useCallback, useEffect, useState } from 'react';
import type { Coords } from './useLocation';
import { fetchCandidates, mergeNearby, type Spot } from '../lib/osm';

export type SpotsState =
  | { status: 'loading' }
  | { status: 'ready'; spots: Spot[] }
  | { status: 'error' };

const RADIUS_METERS = 10000;

/** Nearby sunset-spot candidates from OpenStreetMap. Pass null until the location is known. */
export function useSpots(coords: Coords | null) {
  const [state, setState] = useState<SpotsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const lat = coords?.latitude;
  const lon = coords?.longitude;

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    const controller = new AbortController();
    fetchCandidates({ lat, lon }, RADIUS_METERS, controller.signal)
      .then((candidates) => setState({ status: 'ready', spots: mergeNearby(candidates) }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [lat, lon, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
