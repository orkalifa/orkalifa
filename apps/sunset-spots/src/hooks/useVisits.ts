import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LatLon } from '../lib/geo';
import { addVisit, isSunsetTime, parseVisits, type Visit } from '../lib/visits';
import type { EveningLight } from '../lib/sun';

const KEY = 'spotlight.visits.v1';

/**
 * Remembers where you were at sunset (see lib/visits.ts), so a place you didn't save can be saved
 * later. `here` must be a real fix, never last time's location.
 */
export function useVisits(here: LatLon | null, light: EveningLight | null, now: Date, saved: LatLon[], place: string | null) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => setVisits(parseVisits(raw)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const sunsetNow = !!light && !light.isTomorrow && isSunsetTime(now, light.goldenHour, light.blueHourEnd);
  const lat = here?.lat;
  const lon = here?.lon;

  useEffect(() => {
    if (!loaded || !sunsetNow || lat === undefined || lon === undefined) return;
    // Recorded after this render (not during the effect), so the list updates once.
    void Promise.resolve().then(() =>
      setVisits((prev) => {
        const next = addVisit(prev, { lat, lon }, Date.now(), saved, place ?? undefined);
        if (next !== prev) AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
        return next;
      }),
    );
    // `saved` and `place` are read when you arrive; changing them later shouldn't re-record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, sunsetNow, lat, lon]);

  const clear = useCallback(() => {
    setVisits([]);
    AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);

  return { visits, clear };
}
