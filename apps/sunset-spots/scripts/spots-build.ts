// spots-build.ts
// Pure logic for scripts/build-spots.mjs: the Overpass query, parsing and validation.
// No I/O here, so it is unit-tested without the network (tests/build-spots.test.ts).
// Only erasable TypeScript, so Node runs it directly (type stripping).

export type BuiltKind = 'viewpoint' | 'peak' | 'picnic' | 'bench' | 'shelter';

export type BuiltSpot = {
  id: string;
  kind: BuiltKind;
  lat: number;
  lon: number;
  tags: Record<string, string>;
  name?: string;
};

type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

/** Filters identical to src/lib/osm.ts (minus the live-only ones). */
export const FILTERS: readonly (readonly [string, string])[] = [
  ['tourism', 'viewpoint'],
  ['natural', 'peak'],
  ['tourism', 'picnic_site'],
  ['leisure', 'picnic_table'],
  ['amenity', 'bench'],
  ['amenity', 'shelter'],
];

/** Bounding box for Israel (must match src/hooks/useSpots.ts). */
export const IL_BOUNDS = { south: 29.45, west: 34.27, north: 33.34, east: 35.85 } as const;

/** A full build has ~11k spots; anything far below means Overpass gave a partial answer. */
export const MIN_SPOTS = 8000;

/** Refuse a rebuild that loses more than this share of the current spots (unless forced). */
export const MAX_SHRINK = 0.1;

/** Only the tags the app reads (score.ts); the rest would just make the download bigger. */
export const KEPT_TAGS = ['direction', 'wheelchair', 'covered', 'backrest'] as const;

const KINDS: ReadonlySet<string> = new Set<BuiltKind>(['viewpoint', 'peak', 'picnic', 'bench', 'shelter']);
const ID_RE = /^(node|way|relation)\/\d+$/;

export function buildIsraelQuery(): string {
  const { south, west, north, east } = IL_BOUNDS;
  const parts = FILTERS.map(([k, v]) => `nwr["${k}"="${v}"](${south},${west},${north},${east});`).join('');
  // 180s: the whole country does not fit in the default 25s, and a timeout comes back as a 200 with a remark.
  return `[out:json][timeout:180];(${parts});out center tags;`;
}

export function kindOf(tags: Record<string, string>): BuiltKind | null {
  if (tags.tourism === 'viewpoint') return 'viewpoint';
  if (tags.natural === 'peak') return 'peak';
  if (tags.tourism === 'picnic_site' || tags.leisure === 'picnic_table') return 'picnic';
  if (tags.amenity === 'bench') return 'bench';
  if (tags.amenity === 'shelter') return 'shelter';
  return null;
}

export function keptTags(tags: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of KEPT_TAGS) if (tags[k] !== undefined) out[k] = tags[k];
  return out;
}

/**
 * Throws unless this is a complete, successful Overpass answer. Overpass reports overload,
 * timeouts and memory limits as HTTP 200 with a `remark` and few or no elements.
 */
export function checkOverpassResponse(status: number, json: unknown): { elements: OverpassElement[] } {
  if (status !== 200) throw new Error(`Overpass HTTP ${status}`);
  if (!json || typeof json !== 'object') throw new Error('Overpass returned no JSON object');
  const { remark, elements } = json as { remark?: unknown; elements?: unknown };
  if (typeof remark === 'string' && remark.trim()) throw new Error(`Overpass remark: ${remark.trim().slice(0, 300)}`);
  if (!Array.isArray(elements)) throw new Error('Overpass response has no elements array');
  return { elements: elements as OverpassElement[] };
}

export function toSpots(json: { elements: OverpassElement[] }): BuiltSpot[] {
  const spots: BuiltSpot[] = [];
  for (const el of json.elements) {
    const tags = el.tags ?? {};
    const kind = kindOf(tags);
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!kind || lat === undefined || lon === undefined) continue;
    const spot: BuiltSpot = {
      id: `${el.type}/${el.id}`,
      kind,
      lat: Number(lat.toFixed(5)),
      lon: Number(lon.toFixed(5)),
      tags: keptTags(tags),
    };
    const name = tags['name:he'] ?? tags.name;
    if (name) spot.name = name;
    spots.push(spot);
  }
  return spots;
}

export type ValidateOptions = { min?: number; previousCount?: number; force?: boolean };

const MAX_ERRORS = 10;

/** Checks count and shape. Never throws; returns the first few problems found. */
export function validateSpots(spots: unknown, opts: ValidateOptions = {}): { ok: boolean; errors: string[] } {
  const { min = MIN_SPOTS, previousCount, force = false } = opts;
  const errors: string[] = [];
  const add = (msg: string) => {
    if (errors.length < MAX_ERRORS) errors.push(msg);
  };
  if (!Array.isArray(spots)) return { ok: false, errors: ['spots is not an array'] };

  if (spots.length < min) add(`only ${spots.length} spots (need at least ${min})`);
  if (!force && previousCount !== undefined && previousCount > 0 && spots.length < previousCount * (1 - MAX_SHRINK)) {
    add(`spots dropped from ${previousCount} to ${spots.length} (more than ${MAX_SHRINK * 100}%); use --force if this is real`);
  }

  const seen = new Set<string>();
  spots.forEach((s: unknown, i) => {
    if (!s || typeof s !== 'object') return add(`#${i}: not an object`);
    const { id, kind, lat, lon, tags, name } = s as Record<string, unknown>;
    if (typeof id !== 'string' || !ID_RE.test(id)) add(`#${i}: bad id ${JSON.stringify(id)}`);
    else if (seen.has(id)) add(`#${i}: duplicate id ${id}`);
    else seen.add(id);
    if (typeof kind !== 'string' || !KINDS.has(kind)) add(`#${i}: bad kind ${JSON.stringify(kind)}`);
    const inLat = typeof lat === 'number' && Number.isFinite(lat) && lat >= IL_BOUNDS.south && lat <= IL_BOUNDS.north;
    const inLon = typeof lon === 'number' && Number.isFinite(lon) && lon >= IL_BOUNDS.west && lon <= IL_BOUNDS.east;
    if (!inLat || !inLon) add(`#${i}: position out of Israel bounds (${String(lat)}, ${String(lon)})`);
    if (!tags || typeof tags !== 'object' || Array.isArray(tags)) add(`#${i}: tags is not an object`);
    if (name !== undefined && typeof name !== 'string') add(`#${i}: name is not a string`);
  });

  return { ok: errors.length === 0, errors };
}
