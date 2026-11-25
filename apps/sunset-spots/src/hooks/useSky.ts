import { useEffect, useState } from 'react';
import { fetchSkyVerdict, skyRequestKey, type SkyVerdict } from '../lib/sky';
import type { Coords } from './useLocation';

/**
 * Tonight's sunset outlook from the cloud forecast, or null while loading or if it failed
 * (the app then just shows the usual time-of-day line).
 */
export function useSky(coords: Coords | null, bearing: number | null, sunset: Date | null): SkyVerdict | null {
  const [verdict, setVerdict] = useState<SkyVerdict | null>(null);
  // Refetch only when you move into another ~1.1 km sky cell, or for a different sunset (not every
  // second). The key is the same snapped values the request is built from (see skyRequestKey).
  const key = skyRequestKey(coords, bearing, sunset);
  const lat = key?.lat ?? null;
  const lon = key?.lon ?? null;
  const sunsetMs = key?.sunsetMs ?? null;
  const roundedBearing = key?.bearing ?? null;

  useEffect(() => {
    if (lat === null || lon === null || sunsetMs === null || roundedBearing === null) return;
    const controller = new AbortController();
    fetchSkyVerdict({ lat, lon }, roundedBearing, new Date(sunsetMs), controller.signal)
      .then((v) => setVerdict(v))
      .catch(() => {
        if (!controller.signal.aborted) setVerdict(null);
      });
    return () => controller.abort();
  }, [lat, lon, sunsetMs, roundedBearing]);

  return verdict;
}
