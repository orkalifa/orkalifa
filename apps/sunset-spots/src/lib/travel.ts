import type { ScoredSpot } from './score.ts';

/**
 * Can you make it in time? A rough door-to-spot time for each way of getting there, and the
 * pin colour that follows from it: gold if you'll be there for golden hour, shading to orange
 * the closer to sunset you'd arrive, and fading out if you'd miss the sunset.
 *
 * Times are straight-line distance stretched by how winding the way usually is, at a typical
 * average speed. Good enough to colour pins; real routing comes with Mapbox.
 */

export type TravelMode = 'car' | 'bike' | 'walk';

const PROFILE: Record<TravelMode, { kmh: number; detour: number; overheadMin: number }> = {
  // Rural roads and towns, not highways; a few minutes to get going and to park.
  car: { kmh: 45, detour: 1.35, overheadMin: 3 },
  bike: { kmh: 15, detour: 1.25, overheadMin: 1 },
  walk: { kmh: 4.5, detour: 1.2, overheadMin: 0 },
};

export function travelMinutes(distanceMeters: number, mode: TravelMode): number {
  const { kmh, detour, overheadMin } = PROFILE[mode];
  return overheadMin + ((distanceMeters / 1000) * detour * 60) / kmh;
}

export type Reach = { color: string; opacity: number; /** Arrives before the sunset. */ inTime: boolean };

const GOLD = '#EFA22F';
const ORANGE = '#E2622B';
const FADED = '#CDB8A6';
/** After sunset the pin keeps fading for this long, then stays faded. */
const FADE_MIN = 15;

/** Pin colour for arriving at `arrival`, given tonight's golden hour and sunset. */
export function reachFor(arrival: Date, goldenHour: Date, sunset: Date): Reach {
  const t = arrival.getTime();
  const golden = goldenHour.getTime();
  const set = sunset.getTime();
  if (t <= golden) return { color: GOLD, opacity: 1, inTime: true };
  if (t <= set) return { color: mix(GOLD, ORANGE, (t - golden) / (set - golden)), opacity: 1, inTime: true };
  const late = Math.min(1, (t - set) / (FADE_MIN * 60000));
  return { color: mix(ORANGE, FADED, late), opacity: 1 - 0.35 * late, inTime: false };
}

/** Linear mix of two #RRGGBB colours, `k` from 0 (a) to 1 (b). */
export function mix(a: string, b: string, k: number): string {
  const f = Math.max(0, Math.min(1, k));
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * f));
  return `#${out.map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export type ShownSpot = ScoredSpot & { reach: Reach };

/**
 * Colours each ranked spot by whether you'd make the sunset from here, and moves the ones
 * you'd miss below the ones you'd make (keeping the score order within each group).
 */
export function withReach(spots: ScoredSpot[], mode: TravelMode, now: Date, goldenHour: Date, sunset: Date): ShownSpot[] {
  const shown = spots.map((s) => ({
    ...s,
    reach: reachFor(new Date(now.getTime() + travelMinutes(s.distance, mode) * 60000), goldenHour, sunset),
  }));
  return [...shown.filter((s) => s.reach.inTime), ...shown.filter((s) => !s.reach.inTime)];
}
