import { distanceMeters, type LatLon } from './geo.ts';

export type SpotKind = 'viewpoint' | 'peak' | 'picnic' | 'bench' | 'shelter';

export type Candidate = LatLon & {
  id: string;
  kind: SpotKind;
  name?: string;
  tags: Record<string, string>;
};

/** A candidate after merging, with the other spot types found at the same place. */
export type Spot = Candidate & { nearby: SpotKind[] };

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const FILTERS: [string, string][] = [
  ['tourism', 'viewpoint'],
  ['natural', 'peak'],
  ['tourism', 'picnic_site'],
  ['leisure', 'picnic_table'],
  ['amenity', 'bench'],
  ['amenity', 'shelter'],
];

export function buildOverpassQuery(center: LatLon, radiusMeters: number): string {
  const around = `(around:${Math.round(radiusMeters)},${center.lat},${center.lon})`;
  const parts = FILTERS.map(([k, v]) => `nwr${around}["${k}"="${v}"];`).join('');
  // `out center` gives ways and relations a single point; nodes keep their own lat/lon.
  return `[out:json][timeout:25];(${parts});out center tags;`;
}

function kindOf(tags: Record<string, string>): SpotKind | null {
  if (tags.tourism === 'viewpoint') return 'viewpoint';
  if (tags.natural === 'peak') return 'peak';
  if (tags.tourism === 'picnic_site' || tags.leisure === 'picnic_table') return 'picnic';
  if (tags.amenity === 'bench') return 'bench';
  if (tags.amenity === 'shelter') return 'shelter';
  return null;
}

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export function parseOverpass(json: { elements?: OverpassElement[] }): Candidate[] {
  const out: Candidate[] = [];
  for (const el of json.elements ?? []) {
    const tags = el.tags ?? {};
    const kind = kindOf(tags);
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!kind || lat === undefined || lon === undefined) continue;
    out.push({ id: `${el.type}/${el.id}`, kind, name: tags['name:he'] ?? tags.name, lat, lon, tags });
  }
  return out;
}

// Higher wins when two candidates sit on the same spot.
const KIND_RANK: Record<SpotKind, number> = { viewpoint: 5, peak: 4, picnic: 3, shelter: 2, bench: 1 };

/**
 * Collapses candidates closer than `radiusMeters` into one spot (a row of benches is one place),
 * keeping the most telling one and remembering what else is there.
 */
export function mergeNearby(candidates: Candidate[], radiusMeters = 40): Spot[] {
  const sorted = [...candidates].sort(
    (a, b) => KIND_RANK[b.kind] - KIND_RANK[a.kind] || Number(Boolean(b.name)) - Number(Boolean(a.name)),
  );
  const spots: Spot[] = [];
  for (const c of sorted) {
    const home = spots.find((s) => distanceMeters(s, c) <= radiusMeters);
    if (home) {
      home.nearby.push(c.kind);
      home.name ??= c.name;
    } else {
      spots.push({ ...c, nearby: [] });
    }
  }
  return spots;
}

export async function fetchCandidates(center: LatLon, radiusMeters: number, signal?: AbortSignal): Promise<Candidate[]> {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(buildOverpassQuery(center, radiusMeters))}`,
    signal,
  });
  if (!response.ok) throw new Error(`Overpass ${response.status}`);
  return parseOverpass(await response.json());
}

export type Road = { id: string; major: boolean; points: LatLon[] };

const MAJOR_ROADS = 'motorway|trunk|primary|secondary|tertiary';
const MINOR_ROADS = 'unclassified|residential|living_street';

/** Main roads out to `radiusMeters`, small streets only close by (a city has thousands of them). */
export function buildRoadsQuery(center: LatLon, radiusMeters: number): string {
  const at = (r: number) => `(around:${Math.round(r)},${center.lat},${center.lon})`;
  return (
    `[out:json][timeout:25];(` +
    `way${at(radiusMeters)}["highway"~"^(${MAJOR_ROADS})$"];` +
    `way${at(Math.min(radiusMeters, 3000))}["highway"~"^(${MINOR_ROADS})$"];` +
    `);out geom;`
  );
}

type OverpassWay = { type: string; id: number; tags?: Record<string, string>; geometry?: LatLon[] };

export function parseRoads(json: { elements?: OverpassWay[] }): Road[] {
  const major = new RegExp(`^(${MAJOR_ROADS})$`);
  return (json.elements ?? [])
    .filter((el) => el.type === 'way' && (el.geometry?.length ?? 0) >= 2 && el.tags?.highway)
    .map((el) => ({ id: `way/${el.id}`, major: major.test(el.tags!.highway), points: el.geometry! }));
}

export async function fetchRoads(center: LatLon, radiusMeters: number, signal?: AbortSignal): Promise<Road[]> {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(buildRoadsQuery(center, radiusMeters))}`,
    signal,
  });
  if (!response.ok) throw new Error(`Overpass ${response.status}`);
  return parseRoads(await response.json());
}
