import { useEffect, useState } from 'react';
import { fetchMapLayers, type MapLayers } from '../lib/osm';
import type { Coords } from './useLocation';

const RADIUS_METERS = 10000;
const EMPTY: MapLayers = { roads: [], areas: [], places: [] };

/**
 * Roads, land use and settlement names around you from OpenStreetMap, for the map.
 * Empty layers on failure: the map still works with just the spots and the sunset.
 */
export function useMapLayers(coords: Coords | null): MapLayers {
  const [layers, setLayers] = useState<MapLayers>(EMPTY);
  const lat = coords?.latitude;
  const lon = coords?.longitude;

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    const controller = new AbortController();
    fetchMapLayers({ lat, lon }, RADIUS_METERS, controller.signal)
      .then(setLayers)
      .catch(() => {});
    return () => controller.abort();
  }, [lat, lon]);

  return layers;
}
