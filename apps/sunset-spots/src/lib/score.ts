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

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const BASE_VIEW: Record<SpotKind, number> = { viewpoint: 85, peak: 80, picnic: 60, shelter: 55, bench: 55 };

/**
 * Scores a spot for tonight. `viewWeight` is the "comfort ↔ view" slider: 0 = only comfort, 1 = only view.
 * With a `horizon` (terrain check) the view score is mostly how open the horizon is toward the sunset;
 * without one it falls back to the spot type and its OSM `direction`. Access is distance from you for now.
 */
export function scoreSpot(
  spot: Spot,
  from: LatLon,
  sunsetBearing: number,
  viewWeight = 0.4,
  horizon?: Horizon,
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
  if (spot.kind === 'viewpoint') reasons.push('נקודת תצפית');
  if (spot.kind === 'peak') reasons.push('פסגה');

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

  const v = clamp(view);
  const a = clamp(access);
  const p = clamp(pleasant);
  const score = clamp(viewWeight * v + (1 - viewWeight) * ((a + p) / 2));
  return { ...spot, distance, view: v, access: a, pleasant: p, score, reasons };
}

export function rankSpots(
  spots: Spot[],
  from: LatLon,
  sunsetBearing: number,
  viewWeight = 0.4,
  horizons: Record<string, Horizon> = {},
): ScoredSpot[] {
  return spots
    .map((s) => scoreSpot(s, from, sunsetBearing, viewWeight, horizons[s.id]))
    .sort((a, b) => b.score - a.score);
}
