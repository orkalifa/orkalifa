import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchHorizons } from '../lib/horizon';
import {
  FAILED_RETRY_MS,
  HORIZON_CACHE_KEY,
  horizonCacheKey,
  horizonsAfterFetch,
  lookupHorizons,
  parseHorizonCache,
  planFetch,
  recordFailures,
  storeHorizons,
  type HorizonCache,
  type HorizonsState,
} from '../lib/horizonCache';
import type { Spot } from '../lib/osm';
import { rankSpots } from '../lib/score';
import type { Coords } from './useLocation';

export type { HorizonsState } from '../lib/horizonCache';

/** How many of the best provisional spots get a terrain check (17 elevation points each). */
const MAX_CHECKED = 18;

// Shared by every mounted hook for the app session.
let cache: HorizonCache | null = null;
let cacheLoad: Promise<HorizonCache> | null = null;
const inFlight = new Set<string>();
const failedAt = new Map<string, number>();
const listeners = new Set<() => void>();

function loadCache(): Promise<HorizonCache> {
  if (cache) return Promise.resolve(cache);
  cacheLoad ??= AsyncStorage.getItem(HORIZON_CACHE_KEY)
    .catch(() => null)
    .then((raw) => {
      // A store that landed while loading wins over the older stored copy.
      cache ??= parseHorizonCache(raw);
      return cache;
    });
  return cacheLoad;
}

const notify = () => listeners.forEach((l) => l());

// One shared timer: when the failure backoff is over, wake the hooks so they plan again.
let retryTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    notify();
  }, FAILED_RETRY_MS + 1000);
}
function cancelRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

/**
 * Terrain horizon toward the sunset for the most promising spots. Results are cached on the device by
 * spot + whole-degree bearing (see `horizonCache.ts`), so only spots missing from the cache are fetched,
 * and a fetch already running is never started twice. While this loads, or if it fails with no results,
 * every spot keeps its provisional score. A failure keeps the horizons already known,
 * and the failed spots are tried again once FAILED_RETRY_MS is over.
 */
export function useHorizons(spots: Spot[] | null, coords: Coords | null, bearing: number | null): HorizonsState {
  const [state, setState] = useState<HorizonsState>({ status: 'idle', horizons: {} });
  // Bumped when any fetch lands (or fails), so this hook re-reads the cache.
  const [version, setVersion] = useState(0);
  // The sunset bearing drifts by a fraction of a degree a day; round it so this doesn't refetch every second.
  const roundedBearing = bearing === null ? null : Math.round(bearing);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    listeners.add(bump);
    return () => {
      listeners.delete(bump);
      if (listeners.size === 0) cancelRetry();
    };
  }, []);

  // Aborted only on unmount: a change of `spots` must not throw away a request already in flight.
  const [controller] = useState(() => new AbortController());
  useEffect(() => () => controller.abort(), [controller]);

  useEffect(() => {
    if (!spots || spots.length === 0 || !coords || roundedBearing === null) return;
    const from = { lat: coords.latitude, lon: coords.longitude };
    const candidates = rankSpots(spots, from, roundedBearing).slice(0, MAX_CHECKED);
    let stale = false;

    loadCache().then((loaded) => {
      if (stale) return;
      const now = Date.now();
      const { hits, missing } = lookupHorizons(loaded, candidates, roundedBearing, now);
      const { toFetch, waiting, failed } = planFetch(missing, roundedBearing, inFlight, failedAt, now);

      if (toFetch.length === 0) {
        if (waiting.length > 0) return; // an earlier fetch will land and bump `version`
        if (failed.length > 0) scheduleRetry();
        setState((prev) => horizonsAfterFetch(prev.horizons, hits, failed.length ? { ok: false } : { ok: true, horizons: {} }));
        return;
      }

      const keys = toFetch.map((s) => horizonCacheKey(s, roundedBearing));
      keys.forEach((k) => inFlight.add(k));
      fetchHorizons(toFetch, roundedBearing, controller.signal)
        .then((fetched) => {
          cache = storeHorizons(cache ?? loaded, toFetch, roundedBearing, fetched, Date.now());
          keys.forEach((k) => failedAt.delete(k));
          AsyncStorage.setItem(HORIZON_CACHE_KEY, JSON.stringify(cache)).catch(() => {});
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          recordFailures(failedAt, keys, Date.now());
          scheduleRetry();
        })
        .finally(() => {
          keys.forEach((k) => inFlight.delete(k));
          notify();
        });
    });

    return () => {
      stale = true;
    };
  }, [spots, coords, roundedBearing, controller, version]);

  return state;
}
