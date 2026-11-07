import { useCallback, useEffect, useState } from 'react';
import { EMPTY_LAYERS, fetchMapLayers, zoomForRange, type MapLayers } from '../lib/tiles';
import type { Coords } from './useLocation';

/** Fetch a bit past what the map shows: its corners reach further than the zoom range, and so does the card's edge. */
const OVERSCAN = 1.3;
/** Round the radius so small changes in the zoom don't refetch; tiles already loaded come from the cache anyway. */
const STEP_M = 1000;

/**
 * Roads, land and place names around you for the map, out to `rangeMeters` (the map's zoom).
 * On failure the layers stay as they were (the map still shows the spots and the sunset) and `error` says why.
 */
export function useMapLayers(coords: Coords | null, rangeMeters: number) {
  const [layers, setLayers] = useState<MapLayers>(EMPTY_LAYERS);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lat = coords?.latitude;
  const lon = coords?.longitude;
  const radius = Math.ceil((rangeMeters * OVERSCAN) / STEP_M) * STEP_M;
  const zoom = zoomForRange(rangeMeters);

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    let current = true;
    fetchMapLayers({ lat, lon }, radius, zoom)
      .then((next) => {
        if (!current) return;
        setLayers(next);
        setError(null);
      })
      .catch((e: unknown) => {
        if (current) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      current = false;
    };
  }, [lat, lon, radius, zoom, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { layers, error, retry };
}
