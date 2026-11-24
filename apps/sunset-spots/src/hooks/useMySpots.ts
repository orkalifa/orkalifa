import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeMySpot, parseStored, type MySpot } from '../lib/myspots';

const KEY = 'spotlight.mySpots.v1';

/** Places you saved yourself, kept only on this phone (on the web: this browser). */
export function useMySpots() {
  const [spots, setSpots] = useState<MySpot[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const stored = parseStored(raw);
        // Keep anything saved before this read came back (and store the merged list).
        setSpots((prev) => {
          if (prev.length === 0) return stored;
          const merged = [...stored, ...prev.filter((p) => !stored.some((s) => s.id === p.id))];
          AsyncStorage.setItem(KEY, JSON.stringify(merged)).catch(() => {});
          return merged;
        });
      })
      .catch(() => {});
  }, []);

  const save = useCallback((next: MySpot[]) => {
    setSpots(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const add = useCallback(
    (name: string, lat: number, lon: number) => {
      const spot = makeMySpot(name, lat, lon);
      save([...spots, spot]);
      return spot;
    },
    [spots, save],
  );

  const remove = useCallback((id: string) => save(spots.filter((s) => s.id !== id)), [spots, save]);

  return { spots, add, remove };
}
