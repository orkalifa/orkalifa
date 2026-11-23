import { KIND_LABEL, type SpotKind } from './osm.ts';

/**
 * Sharing a spot as a link: "בואו לשקיעה פה". The link carries the place itself (where, what,
 * its name), not just its id, so it opens on any phone — even far from you, outside Israel, or
 * for a place someone saved themselves and that exists only on their phone.
 */

/** Where the web app lives (GitHub Pages, see .github/workflows/deploy-spotlight.yml). */
export const PUBLIC_URL = 'https://orkalifa.github.io/orkalifa/';

export type SharedSpot = { id: string; kind: SpotKind; lat: number; lon: number; name?: string };

const KINDS = Object.keys(KIND_LABEL) as SpotKind[];

export function buildShareUrl(spot: SharedSpot, base = PUBLIC_URL): string {
  const params = [
    `spot=${encodeURIComponent(spot.id)}`,
    `ll=${spot.lat.toFixed(5)},${spot.lon.toFixed(5)}`,
    `k=${spot.kind}`,
  ];
  if (spot.name) params.push(`n=${encodeURIComponent(spot.name)}`);
  return `${base}?${params.join('&')}`;
}

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The spot a shared link points at, from its query parameters, or null if they don't make one. */
export function parseSharedSpot(params: Params): SharedSpot | null {
  const id = first(params.spot);
  const ll = first(params.ll);
  if (!id || !ll) return null;
  const [lat, lon] = ll.split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const k = first(params.k) as SpotKind | undefined;
  const kind = k && KINDS.includes(k) ? k : 'viewpoint';
  const name = first(params.n)?.trim().slice(0, 60) || undefined;
  return { id: id.slice(0, 80), kind, lat, lon, name };
}

/** The message that goes with the link. */
export function shareMessage(spot: SharedSpot, sunsetClock: string, isTomorrow: boolean): string {
  const title = spot.name ?? KIND_LABEL[spot.kind];
  const when = isTomorrow ? 'מחר' : 'היום';
  return `🌅 בואו לשקיעה ב${title}! השקיעה ${when} ב־${sunsetClock}`;
}
