import { destinationPoint, type LatLon } from './geo.ts';

/**
 * Horizon check: walk outwards from a spot toward the sunset and find the highest
 * terrain angle above eye level. A low angle means the sun stays visible down to the horizon.
 */

/**
 * Sample distances along the sunset ray: dense near the spot, where a small hill blocks the most,
 * and no gap wider than 1 km in the first 5 km so a narrow ridge isn't skipped over.
 */
export const SAMPLE_DISTANCES_M = [
  200, 400, 700, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7000, 10000, 14000, 20000, 27000, 35000,
];

const EARTH_RADIUS_M = 6371000;
const REFRACTION_K = 0.13; // standard atmospheric refraction coefficient
const EYE_HEIGHT_M = 1.7;
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/elevation';
const MAX_POINTS_PER_REQUEST = 100;

export type Horizon = {
  /** Highest terrain angle toward the sunset, degrees above the eye's horizontal plane. */
  angle: number;
  /** The far end of the ray is at sea level (sea horizon). */
  sea: boolean;
};

export function samplePoints(spot: LatLon, bearing: number): LatLon[] {
  return [spot, ...SAMPLE_DISTANCES_M.map((d) => destinationPoint(spot, bearing, d))];
}

/** Elevation angle in degrees of terrain at `distance` metres, corrected for earth curvature and refraction. */
export function elevationAngle(eyeElevation: number, targetElevation: number, distance: number): number {
  const drop = ((distance * distance) / (2 * EARTH_RADIUS_M)) * (1 - REFRACTION_K);
  return (Math.atan2(targetElevation - drop - eyeElevation, distance) * 180) / Math.PI;
}

/** `elevations` = [spot, ...one per SAMPLE_DISTANCES_M]. */
export function horizonFromElevations(elevations: number[]): Horizon {
  const eye = elevations[0] + EYE_HEIGHT_M;
  let angle = -Infinity;
  SAMPLE_DISTANCES_M.forEach((d, i) => {
    angle = Math.max(angle, elevationAngle(eye, elevations[i + 1], d));
  });
  const far = elevations.slice(-3);
  return { angle, sea: far.every((e) => e <= 1) };
}

/**
 * 0–100 view score from the horizon angle. The sun sets at about −0.8° (with refraction),
 * so anything at or below 0.5° lets you watch it reach the horizon.
 */
export function horizonScore({ angle, sea }: Horizon): number {
  let score: number;
  if (angle <= 0.5) score = 95;
  else if (angle <= 3) score = 95 - ((angle - 0.5) / 2.5) * 65; // 95 → 30
  else score = Math.max(10, 30 - (angle - 3) * 5);
  if (sea && angle <= 0.5) score += 5;
  return Math.round(Math.min(100, score));
}

export function elevationRequestUrls(points: LatLon[]): string[] {
  const urls: string[] = [];
  for (let i = 0; i < points.length; i += MAX_POINTS_PER_REQUEST) {
    const chunk = points.slice(i, i + MAX_POINTS_PER_REQUEST);
    const lat = chunk.map((p) => p.lat.toFixed(5)).join(',');
    const lon = chunk.map((p) => p.lon.toFixed(5)).join(',');
    urls.push(`${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}`);
  }
  return urls;
}

/** Horizons for several spots, keyed by spot id, using Open-Meteo's free elevation API (90 m DEM). */
export async function fetchHorizons(
  spots: (LatLon & { id: string })[],
  bearing: number,
  signal?: AbortSignal,
): Promise<Record<string, Horizon>> {
  const perSpot = SAMPLE_DISTANCES_M.length + 1;
  const points = spots.flatMap((s) => samplePoints(s, bearing));
  const elevations: number[] = [];
  for (const url of elevationRequestUrls(points)) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
    const json: { elevation?: number[] } = await response.json();
    elevations.push(...(json.elevation ?? []));
  }
  if (elevations.length !== points.length) throw new Error('Elevation count mismatch');
  const out: Record<string, Horizon> = {};
  spots.forEach((s, i) => {
    out[s.id] = horizonFromElevations(elevations.slice(i * perSpot, (i + 1) * perSpot));
  });
  return out;
}
