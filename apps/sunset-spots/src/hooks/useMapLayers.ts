import { useCallback, useEffect, useState } from 'react';
import { fetchMapLayers, type MapLayers } from '../lib/osm';
import type { Coords } from './useLocation';

const RADIUS_METERS = 10000;
const EMPTY: MapLayers = { roads: [], areas: [], places: [] };

/**
 * Roads, land use and settlement names around you from OpenStreetMap, for the map.
 * On failure the layers stay empty (the map still shows the spots and the sunset) and `error` says why.
 */
export function useMapLayers(coords: Coords | null) {
  const [layers, setLayers] = useState<MapLayers>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lat = coords?.latitude;
  const lon = coords?.longitude;

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    const controller = new AbortController();
    fetchMapLayers({ lat, lon }, RADIUS_METERS, controller.signal)
      .then((next) => {
        setLayers(next);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      });
    return () => controller.abort();
  }, [lat, lon, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { layers, error, retry };
}
