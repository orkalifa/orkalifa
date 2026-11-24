import { useEffect, useState } from 'react';
import { fetchSkyVerdict, type SkyVerdict } from '../lib/sky';
import type { Coords } from './useLocation';

/**
 * Tonight's sunset outlook from the cloud forecast, or null while loading or if it failed
 * (the app then just shows the usual time-of-day line).
 */
export function useSky(coords: Coords | null, bearing: number | null, sunset: Date | null): SkyVerdict | null {
  const [verdict, setVerdict] = useState<SkyVerdict | null>(null);
  // Refetch only when you move ~1 km, or for a different sunset (not every second).
  const lat = coords ? Math.round(coords.latitude * 100) / 100 : null;
  const lon = coords ? Math.round(coords.longitude * 100) / 100 : null;
  const sunsetMs = sunset ? Math.round(sunset.getTime() / 60000) * 60000 : null;
  const roundedBearing = bearing === null ? null : Math.round(bearing);

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
