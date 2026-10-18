import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

/**
 * Device compass heading in degrees from north, or null where there is no compass
 * (web, simulators). Uses true north when available, magnetic north otherwise.
 */
export function useHeading(enabled: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let subscription: Location.LocationSubscription | undefined;
    let cancelled = false;

    Location.watchHeadingAsync(({ trueHeading, magHeading }) => {
      setHeading(trueHeading >= 0 ? trueHeading : magHeading);
    })
      .then((sub) => {
        if (cancelled) sub.remove();
        else subscription = sub;
      })
      .catch(() => setHeading(null));

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  return heading;
}
