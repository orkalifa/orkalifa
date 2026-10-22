import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { Coords } from './useLocation';

/** The settlement or area you're in ("זרועה", "באר שבע"), or null until known or if the phone can't tell. */
export function usePlaceName(coords: Coords | null): string | null {
  const [place, setPlace] = useState<string | null>(null);
  const lat = coords?.latitude;
  const lon = coords?.longitude;

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    let cancelled = false;
    Location.reverseGeocodeAsync({ latitude: lat, longitude: lon })
      .then(([address]) => {
        if (!cancelled) setPlace(address?.city ?? address?.district ?? address?.subregion ?? address?.region ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  return place;
}
