import { useCallback, useEffect, useState } from 'react';
import type { Coords } from './useLocation';
import { fetchCandidates, mergeNearby, type Spot } from '../lib/osm';
import { distanceMeters } from '../lib/geo';

export type SpotsState =
  | { status: 'loading' }
  | { status: 'ready'; spots: Spot[] }
  | { status: 'error'; message: string };

const RADIUS_METERS = 10000;

/** Rough bounding box for Israel (incl. Golan & Eilat). */
const IL_BOUNDS = { south: 29.45, north: 33.34, west: 34.27, east: 35.85 };

function isInIsrael(coords: Coords): boolean {
  const { latitude: lat, longitude: lon } = coords;
  return lat >= IL_BOUNDS.south && lat <= IL_BOUNDS.north && lon >= IL_BOUNDS.west && lon <= IL_BOUNDS.east;
}

// The bundled spots (~1 MB) load on their own, after the map: a dynamic import becomes a separate
// file on the web, so the first screen doesn't wait for it. Loaded once, then kept.
let bundled: Promise<Spot[]> | null = null;
function loadBundledSpots(): Promise<Spot[]> {
  bundled ??= import('../data/spots-il.json').then(
    (m) => ((m as { default?: unknown }).default ?? m) as Spot[],
  );
  return bundled;
}

/** Filter bundled spots to those within radiusMeters of center. */
function filterByRadius(spots: Spot[], center: { lat: number; lon: number }, radiusMeters: number): Spot[] {
  return spots.filter((s) => distanceMeters(s, center) <= radiusMeters);
}

/** Nearby sunset-spot candidates from OpenStreetMap. Pass null until the location is known. */
export function useSpots(coords: Coords | null) {
  const [state, setState] = useState<SpotsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const lat = coords?.latitude;
  const lon = coords?.longitude;
  const inIsrael = coords ? isInIsrael(coords) : false;

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;

    if (inIsrael) {
      let current = true;
      loadBundledSpots()
        .then((all) => {
          if (!current) return;
          const nearby = filterByRadius(all, { lat, lon }, RADIUS_METERS);
          setState({ status: 'ready', spots: mergeNearby(nearby) });
        })
        .catch((error: unknown) => {
          bundled = null; // try again on retry
          if (current) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
        });
      return () => {
        current = false;
      };
    }

    // Fallback to live Overpass query outside Israel
    const controller = new AbortController();
    fetchCandidates({ lat, lon }, RADIUS_METERS, controller.signal)
      .then((candidates) => setState({ status: 'ready', spots: mergeNearby(candidates) }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, [lat, lon, attempt, inIsrael]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
