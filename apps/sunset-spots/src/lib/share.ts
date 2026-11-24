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

/** Exactly two plain decimal numbers, "lat,lon". No exponents, hex, spaces, or a third value. */
const LL = /^(-?\d{1,3}(?:\.\d{1,10})?),(-?\d{1,3}(?:\.\d{1,10})?)$/;
/** Every id the app makes: node/…, way/…, relation/… (OpenStreetMap) and mine/<base36>. */
const ID = /^[a-z]{1,10}\/[0-9a-z]{1,24}$/;
/** Control characters, and bidi overrides/embeddings/isolates that could flip the text around them. */
const UNSAFE = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;
const NAME_MAX = 60;

/**
 * A place's name made safe to show: no control or bidi-override characters, single spaces, at most
 * 60 characters (counted whole, so an emoji is never cut in half). Nothing left gives undefined.
 * LRM/RLM marks stay: they are ordinary in Hebrew text.
 */
export function cleanName(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, NAME_MAX).join('').trim() || undefined;
}

export function buildShareUrl(spot: SharedSpot, base = PUBLIC_URL): string {
  const params = [
    `spot=${encodeURIComponent(spot.id)}`,
    `ll=${spot.lat.toFixed(5)},${spot.lon.toFixed(5)}`,
    `k=${spot.kind}`,
  ];
  const name = cleanName(spot.name);
  if (name) params.push(`n=${encodeURIComponent(name)}`);
  return `${base}?${params.join('&')}`;
}

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The spot a shared link points at, from its query parameters, or null if they don't make one.
 * A link is untrusted input: anything not in the exact shape the app writes is rejected.
 */
export function parseSharedSpot(params: Params): SharedSpot | null {
  const id = first(params.spot);
  const ll = first(params.ll);
  if (!id || !ll || !ID.test(id)) return null;
  const m = LL.exec(ll);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const k = first(params.k) as SpotKind | undefined;
  const kind = k && KINDS.includes(k) ? k : 'viewpoint';
  return { id, kind, lat, lon, name: cleanName(first(params.n)) };
}

/** The message that goes with the link. */
export function shareMessage(spot: SharedSpot, sunsetClock: string, isTomorrow: boolean): string {
  const title = cleanName(spot.name) ?? KIND_LABEL[spot.kind];
  const when = isTomorrow ? 'מחר' : 'היום';
  return `🌅 בואו לשקיעה ב${title}! השקיעה ${when} ב־${sunsetClock}`;
}
