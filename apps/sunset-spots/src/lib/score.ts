import { distanceMeters, type LatLon } from './geo.ts';
import { horizonScore, type Horizon } from './horizon.ts';
import type { Spot, SpotKind } from './osm.ts';

export type ScoredSpot = Spot & {
  distance: number;
  view: number;
  access: number;
  pleasant: number;
  score: number;
  reasons: string[];
  /**
   * Whether the terrain toward the sunset was checked: true = checked, false = not checked although
   * checks ran for other spots (marked and discounted), null = no check has produced a result yet.
   */
  horizonChecked: boolean | null;
};

const CARDINAL: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

/** OSM `direction` on a viewpoint: degrees ("270"), a compass point ("WSW") or a range ("180-300"). */
export function parseDirection(value: string | undefined): { from: number; to: number } | null {
  if (!value) return null;
  const toDegrees = (s: string) => {
    const t = s.trim().toUpperCase();
    if (t in CARDINAL) return CARDINAL[t];
    const n = Number(t);
    return Number.isFinite(n) ? ((n % 360) + 360) % 360 : null;
  };
  const range = value.split('-');
  if (range.length === 2) {
    const from = toDegrees(range[0]);
    const to = toDegrees(range[1]);
    return from === null || to === null ? null : { from, to };
  }
  const single = toDegrees(value);
  // A single direction means roughly that way: give it a 60° field of view.
  return single === null ? null : { from: (single + 330) % 360, to: (single + 30) % 360 };
}

function withinArc(bearing: number, arc: { from: number; to: number }, slack: number): boolean {
  const span = (arc.to - arc.from + 360) % 360;
  const offset = (bearing - arc.from + slack + 360) % 360;
  return offset <= span + 2 * slack;
}

/** Total-score multiplier for terrain above the sunset line, by angle (degrees). Linear between points. */
const BLOCKED_STEPS: [number, number][] = [[2, 1], [3, 0.75], [5, 0.5], [8, 0.3]];

/**
 * A blocked sun is a strong penalty on the whole score, not just a lower view ring:
 * up to 2° nothing, then ×0.75 at 3°, ×0.5 at 5°, ×0.3 from 8°.
 */
export function blockedFactor({ angle }: Horizon): number {
  if (!(angle > BLOCKED_STEPS[0][0])) return 1;
  for (let i = 1; i < BLOCKED_STEPS.length; i++) {
    const [a0, f0] = BLOCKED_STEPS[i - 1];
    const [a1, f1] = BLOCKED_STEPS[i];
    if (angle <= a1) return f0 + ((angle - a0) / (a1 - a0)) * (f1 - f0);
  }
  return BLOCKED_STEPS[BLOCKED_STEPS.length - 1][1];
}

/** A spot left out of the terrain check can't outrank checked open-horizon spots on its base view alone. */
export const UNCHECKED_FACTOR = 0.85;
export const UNCHECKED_REASON = 'האופק עוד לא נבדק';

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// A place you saved yourself is one you already know is good for the sunset.
const BASE_VIEW: Record<SpotKind, number> = { viewpoint: 85, peak: 80, picnic: 60, shelter: 55, bench: 55, mine: 90 };

/**
 * Scores a spot for tonight. `viewWeight` is the "comfort ↔ view" slider: 0 = only comfort, 1 = only view.
 * With a `horizon` (terrain check) the view score is mostly how open the horizon is toward the sunset;
 * without one it falls back to the spot type and its OSM `direction`. Access is distance from you for now.
 * A horizon above ~2° multiplies the whole score down (`blockedFactor`). `checksRan` says whether the terrain
 * check has produced results for any spot: if so, a spot without a horizon is marked unchecked and discounted;
 * if not (still loading, or the check failed) every spot is scored on the base formula, unmarked.
 */
export function scoreSpot(
  spot: Spot,
  from: LatLon,
  sunsetBearing: number,
  viewWeight = 0.4,
  horizon?: Horizon,
  checksRan = true,
): ScoredSpot {
  const reasons: string[] = [];
  const kinds = new Set<SpotKind>([spot.kind, ...spot.nearby]);

  let view = BASE_VIEW[spot.kind];
  const facing = parseDirection(spot.tags.direction);
  if (facing) {
    if (withinArc(sunsetBearing, facing, 15)) {
      view += 15;
      reasons.push('פונה לשקיעה');
    } else if (!withinArc(sunsetBearing, facing, 60)) {
      view -= 30;
    }
  }
  if (horizon) {
    view = 0.7 * horizonScore(horizon) + 0.3 * view;
    if (horizon.sea && horizon.angle <= 0.5) reasons.push('אופק ים');
    else if (horizon.angle <= 0.5) reasons.push('אופק פתוח');
    else if (horizon.angle > 2) reasons.push('האופק חסום חלקית');
  }
  const unchecked = !horizon && checksRan;
  if (unchecked) reasons.push(UNCHECKED_REASON);
  if (spot.kind === 'viewpoint') reasons.push('נקודת תצפית');
  if (spot.kind === 'peak') reasons.push('פסגה');
  if (spot.kind === 'mine') reasons.push('המקום שלך');

  const distance = distanceMeters(from, spot);
  const km = distance / 1000;
  let access = km <= 1 ? 100 : 100 - ((Math.min(km, 15) - 1) / 14) * 60;
  if (spot.tags.wheelchair === 'yes') reasons.push('נגיש');
  if (spot.tags.wheelchair === 'no') access -= 15;

  let pleasant = 40;
  if (kinds.has('bench') || kinds.has('picnic')) {
    pleasant += 25;
    reasons.push('יש ישיבה');
  }
  if (kinds.has('picnic')) pleasant += 15;
  if (kinds.has('shelter') || spot.tags.covered === 'yes') {
    pleasant += 15;
    reasons.push('יש צל');
  }
  if (spot.tags.backrest === 'yes') pleasant += 5;
  if (spot.name) pleasant += 5;
  if (spot.kind === 'mine') pleasant += 20;

  const v = clamp(view);
  const a = clamp(access);
  const p = clamp(pleasant);
  const factor = horizon ? blockedFactor(horizon) : unchecked ? UNCHECKED_FACTOR : 1;
  const score = clamp((viewWeight * v + (1 - viewWeight) * ((a + p) / 2)) * factor);
  const horizonChecked = horizon ? true : unchecked ? false : null;
  return { ...spot, distance, view: v, access: a, pleasant: p, score, reasons, horizonChecked };
}

export function rankSpots(
  spots: Spot[],
  from: LatLon,
  sunsetBearing: number,
  viewWeight = 0.4,
  horizons: Record<string, Horizon> = {},
): ScoredSpot[] {
  const checksRan = Object.keys(horizons).length > 0;
  return spots
    .map((s) => scoreSpot(s, from, sunsetBearing, viewWeight, horizons[s.id], checksRan))
    .sort((a, b) => b.score - a.score);
}
