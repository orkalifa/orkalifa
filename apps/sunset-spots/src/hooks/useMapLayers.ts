import { useCallback, useEffect, useState } from 'react';
import { EMPTY_LAYERS, fetchMapLayers, zoomForRange, type MapLayers } from '../lib/tiles';
import type { Coords } from './useLocation';

/**
 * How far the map reaches from you, in multiples of its zoom range. You sit low on the map (below
 * the sunset card), so the map runs about twice the range to the north, up behind the card and the
 * status bar, and a little past the range the other ways (its corners).
 */
const REACH = { north: 2.2, south: 1.3, east: 1.3, west: 1.3 };
/** Round distances so small changes in the zoom don't refetch; tiles already loaded come from the cache anyway. */
const STEP_M = 500;

/**
 * Roads, land and place names around you for the map at a zoom of `rangeMeters`. While loading or
 * after a failure the last layers stay (the map still shows the spots and the sunset), and `error`
 * says what's missing.
 */
export function useMapLayers(coords: Coords | null, rangeMeters: number) {
  const [layers, setLayers] = useState<MapLayers>(EMPTY_LAYERS);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lat = coords?.latitude;
  const lon = coords?.longitude;
  const reach = (k: number) => Math.ceil((rangeMeters * k) / STEP_M) * STEP_M;
  const north = reach(REACH.north);
  const side = reach(REACH.south);
  const zoom = zoomForRange(rangeMeters);

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    let current = true;
    fetchMapLayers({ lat, lon }, { north, south: side, east: side, west: side }, zoom)
      .then(({ layers: next, missing }) => {
        if (!current) return;
        setLayers(next);
        setError(missing);
      })
      .catch((e: unknown) => {
        if (current) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      current = false;
    };
  }, [lat, lon, north, side, zoom, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { layers, error, retry };
}
