import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRAVEL_MODES, type TravelMode } from '../lib/travel';

const KEY = 'spotlight.travelMode';

/** How you're getting there tonight, remembered between launches. Starts as car. */
export function useTravelMode(): [TravelMode, (mode: TravelMode) => void] {
  const [mode, setModeState] = useState<TravelMode>('car');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((saved) => {
        if (saved && (TRAVEL_MODES as string[]).includes(saved)) setModeState(saved as TravelMode);
      })
      .catch(() => {});
  }, []);

  const setMode = useCallback((next: TravelMode) => {
    setModeState(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);

  return [mode, setMode];
}
