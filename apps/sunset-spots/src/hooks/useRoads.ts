import { useEffect, useState } from 'react';
import { fetchRoads, type Road } from '../lib/osm';
import type { Coords } from './useLocation';

const RADIUS_METERS = 10000;

/** Roads around you from OpenStreetMap, for the map. An empty list on failure: the map still works without them. */
export function useRoads(coords: Coords | null): Road[] {
  const [roads, setRoads] = useState<Road[]>([]);
  const lat = coords?.latitude;
  const lon = coords?.longitude;

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    const controller = new AbortController();
    fetchRoads({ lat, lon }, RADIUS_METERS, controller.signal)
      .then(setRoads)
      .catch(() => {});
    return () => controller.abort();
  }, [lat, lon]);

  return roads;
}
