import { useEffect, useState } from 'react';
import { fetchHorizons, type Horizon } from '../lib/horizon';
import type { Spot } from '../lib/osm';
import { rankSpots } from '../lib/score';
import type { Coords } from './useLocation';

/** How many of the best provisional spots get a terrain check (17 elevation points each). */
const MAX_CHECKED = 18;

export type HorizonsState = { status: 'idle' | 'ready' | 'error'; horizons: Record<string, Horizon> };

/**
 * Terrain horizon toward the sunset for the most promising spots. Spots without a result
 * keep their provisional view score, so the list is usable while this loads or if it fails.
 */
export function useHorizons(spots: Spot[] | null, coords: Coords | null, bearing: number | null): HorizonsState {
  const [state, setState] = useState<HorizonsState>({ status: 'idle', horizons: {} });
  // The sunset bearing drifts by a fraction of a degree a day; round it so this doesn't refetch every second.
  const roundedBearing = bearing === null ? null : Math.round(bearing);

  useEffect(() => {
    if (!spots || spots.length === 0 || !coords || roundedBearing === null) return;
    const from = { lat: coords.latitude, lon: coords.longitude };
    const candidates = rankSpots(spots, from, roundedBearing).slice(0, MAX_CHECKED);
    const controller = new AbortController();
    fetchHorizons(candidates, roundedBearing, controller.signal)
      .then((horizons) => setState({ status: 'ready', horizons }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error', horizons: {} });
      });
    return () => controller.abort();
  }, [spots, coords, roundedBearing]);

  return state;
}
