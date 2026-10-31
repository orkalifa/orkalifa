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

// The main server often answers 429/504 when busy, so fall back to public mirrors.
export const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
// Overpass asks apps to identify themselves; some servers turn away anonymous clients.
const USER_AGENT = 'Spotlight/1.0 (sunset spots app)';

type OverpassOptions = {
  /** Give up on a server after this long. */
  timeoutMs?: number;
  /** If no server has answered after this long, also ask the next one. */
  hedgeMs?: number;
};

const host = (url: string) => url.replace(/^https?:\/\/([^/]+).*$/, '$1'); // React Native's URL has no `hostname`

/**
 * Runs an Overpass query against the public servers, starting at `first`, and returns the first
 * answer. A busy server can sit on a query for a long time, so rather than wait for it to time out
 * before trying the next, the next one is also asked if nothing has come back after `hedgeMs`, and
 * straight away when a server fails. The rest are cancelled once one answers.
 * If all of them fail, the error says why for each ("overpass-api.de: HTTP 429 · …") so the app can show it.
 */
export function overpass<T>(
  query: string,
  signal?: AbortSignal,
  first = 0,
  { timeoutMs = 25000, hedgeMs = 6000 }: OverpassOptions = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const failures: string[] = [];
    const inFlight: AbortController[] = [];
    let launched = 0;
    let failed = 0;
    let settled = false;
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    const settle = (done: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(hedgeTimer);
      signal?.removeEventListener('abort', onAbort);
      inFlight.forEach((c) => c.abort());
      done();
    };
    const onAbort = () => settle(() => reject(new Error('aborted')));

    const scheduleHedge = () => {
      clearTimeout(hedgeTimer);
      if (launched < OVERPASS_URLS.length) hedgeTimer = setTimeout(launchNext, hedgeMs);
    };

    function launchNext() {
      if (settled || launched >= OVERPASS_URLS.length) return;
      const url = OVERPASS_URLS[(first + launched++) % OVERPASS_URLS.length];
      const controller = new AbortController();
      inFlight.push(controller);
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      scheduleHedge();

      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return (await response.json()) as T;
        })
        .then((json) => settle(() => resolve(json)))
        .catch((error: unknown) => {
          if (settled) return;
          failures.push(`${host(url)}: ${timedOut ? 'timeout' : error instanceof Error ? error.message : String(error)}`);
          if (++failed === OVERPASS_URLS.length) settle(() => reject(new Error(failures.join(' · '))));
          else launchNext();
        })
        .finally(() => clearTimeout(timer));
    }

    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort);
    launchNext();
  });
}

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
  return parseOverpass(await overpass(buildOverpassQuery(center, radiusMeters), signal));
}

export type Road = { id: string; major: boolean; points: LatLon[] };
export type AreaKind = 'field' | 'green' | 'water' | 'town';
export type Area = { id: string; kind: AreaKind; points: LatLon[] };
/** `rank`: 0 city, 1 town, 2 village (moshav, kibbutz), 3 hamlet. */
export type Place = LatLon & { id: string; name: string; rank: number };
export type MapLayers = { roads: Road[]; areas: Area[]; places: Place[] };

const MAJOR_ROADS = 'motorway|trunk|primary|secondary|tertiary';
const MINOR_ROADS = 'unclassified|residential|living_street';
const PLACE_RANK: Record<string, number> = { city: 0, town: 1, village: 2, hamlet: 3 };
// Land use only out to here: farmland edges have many points, and past this the map is mostly roads anyway.
const AREAS_MAX_RADIUS_M = 8000;

/**
 * Everything the map draws besides the spots, in one request: main roads out to `radiusMeters`,
 * small streets close by (a city has thousands), fields, green areas, water, built-up areas
 * and settlement names.
 */
export function buildMapQuery(center: LatLon, radiusMeters: number): string {
  const at = (r: number) => `(around:${Math.round(r)},${center.lat},${center.lon})`;
  const areas = at(Math.min(radiusMeters, AREAS_MAX_RADIUS_M));
  return (
    `[out:json][timeout:30];(` +
    `way${at(radiusMeters)}["highway"~"^(${MAJOR_ROADS})$"];` +
    `way${at(Math.min(radiusMeters, 3000))}["highway"~"^(${MINOR_ROADS})$"];` +
    `way${areas}["landuse"~"^(farmland|meadow|orchard|vineyard|forest|grass|residential)$"];` +
    `way${areas}["natural"~"^(wood|scrub|water)$"];` +
    `way${areas}["leisure"="park"];` +
    `node${at(radiusMeters * 1.3)}["place"~"^(city|town|village|hamlet)$"]["name"];` +
    `);out geom;`
  );
}

function areaKind(tags: Record<string, string>): AreaKind | null {
  const { landuse, natural, leisure } = tags;
  if (landuse === 'farmland' || landuse === 'meadow') return 'field';
  if (landuse === 'residential') return 'town';
  if (natural === 'water') return 'water';
  if (['orchard', 'vineyard', 'forest', 'grass'].includes(landuse) || ['wood', 'scrub'].includes(natural) || leisure === 'park') {
    return 'green';
  }
  return null;
}

type OverpassMapElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: LatLon[];
};

export function parseMapLayers(json: { elements?: OverpassMapElement[] }): MapLayers {
  const major = new RegExp(`^(${MAJOR_ROADS})$`);
  const layers: MapLayers = { roads: [], areas: [], places: [] };
  for (const el of json.elements ?? []) {
    const tags = el.tags ?? {};
    if (el.type === 'node') {
      const rank = PLACE_RANK[tags.place];
      const name = tags['name:he'] ?? tags.name;
      if (rank !== undefined && name && el.lat !== undefined && el.lon !== undefined) {
        layers.places.push({ id: `node/${el.id}`, name, rank, lat: el.lat, lon: el.lon });
      }
      continue;
    }
    if (el.type !== 'way' || (el.geometry?.length ?? 0) < 2) continue;
    const id = `way/${el.id}`;
    if (tags.highway) {
      layers.roads.push({ id, major: major.test(tags.highway), points: el.geometry! });
      continue;
    }
    const kind = areaKind(tags);
    if (kind && el.geometry!.length >= 3) layers.areas.push({ id, kind, points: el.geometry! });
  }
  return layers;
}

/** Starts at the second server so it doesn't compete with the spots query for the same rate limit. */
export async function fetchMapLayers(center: LatLon, radiusMeters: number, signal?: AbortSignal): Promise<MapLayers> {
  return parseMapLayers(await overpass(buildMapQuery(center, radiusMeters), signal, 1));
}
