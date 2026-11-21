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

// Lazily load bundled data only once.
let _bundled: Spot[] | null = null;
function getBundledSpots(): Spot[] {
  if (_bundled === null) {
    try {
      _bundled = require('../data/spots-il.json') as Spot[];
    } catch {
      _bundled = [];
    }
  }
  return _bundled;
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
      // Use bundled data for Israel – wrap in microtask to avoid sync setState in effect body.
      void Promise.resolve().then(() => {
        const nearby = filterByRadius(getBundledSpots(), { lat, lon }, RADIUS_METERS);
        setState({ status: 'ready', spots: mergeNearby(nearby) });
      });
      return;
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
