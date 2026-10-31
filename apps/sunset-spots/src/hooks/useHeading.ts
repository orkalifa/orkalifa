import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';

/**
 * Calls `onHeading` with the device compass heading (degrees from north) on every sensor
 * reading, without re-rendering. Uses true north when available, magnetic north otherwise.
 * Nothing is called where there's no compass (web, simulators).
 *
 * On Android, expo-location reports only changes of 2° or more, at most every 50 ms, so callers
 * should animate between readings rather than jump to them.
 */
export function useHeading(enabled: boolean, onHeading: (heading: number) => void): void {
  const latest = useRef(onHeading);
  useEffect(() => {
    latest.current = onHeading;
  });

  useEffect(() => {
    if (!enabled) return;
    let subscription: Location.LocationSubscription | undefined;
    let cancelled = false;

    Location.watchHeadingAsync(({ trueHeading, magHeading }) => {
      latest.current(trueHeading >= 0 ? trueHeading : magHeading);
    })
      .then((sub) => {
        if (cancelled) sub.remove();
        else subscription = sub;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);
}
