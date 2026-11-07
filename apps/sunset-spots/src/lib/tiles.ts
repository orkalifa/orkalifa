import { VectorTile, type VectorTileFeature } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import type { LatLon } from './geo.ts';

/**
 * The map's roads, land and place names, from OpenFreeMap's vector tiles (OpenMapTiles schema,
 * built from OpenStreetMap). A tile service is made for apps to fetch from, unlike the public
 * Overpass servers, which turn apps away when busy. Free, no key: https://openfreemap.org
 */

/** `rank`: 0 motorway/trunk/primary, 1 secondary, 2 tertiary, 3 street. */
export type Road = { id: string; rank: number; points: LatLon[] };
export type AreaKind = 'field' | 'green' | 'water' | 'town';
export type Area = { id: string; kind: AreaKind; points: LatLon[] };
/** `rank`: 0 city, 1 town, 2 village (moshav, kibbutz), 3 hamlet. */
export type Place = LatLon & { id: string; name: string; rank: number };
export type MapLayers = { roads: Road[]; areas: Area[]; places: Place[] };

export const EMPTY_LAYERS: MapLayers = { roads: [], areas: [], places: [] };

/** Zoom 12 tiles are ~8 km across here: a 10 km map is 3×3 to 4×4 tiles. */
export const TILE_ZOOM = 12;

/**
 * Tile zoom for a map showing `rangeMeters` around you. Lower zooms are simplified (a roundabout
 * becomes a few straight sides), so a zoomed-in map uses more detailed tiles; each step down
 * quarters how many tiles cover the area, so a wide map uses coarser ones.
 */
export function zoomForRange(rangeMeters: number): number {
  if (rangeMeters <= 3000) return 14;
  if (rangeMeters <= 6500) return 13;
  return TILE_ZOOM;
}
const TILEJSON_URL = 'https://tiles.openfreemap.org/planet';

const ROAD_RANK: Record<string, number> = { motorway: 0, trunk: 0, primary: 0, secondary: 1, tertiary: 2, minor: 3 };
const PLACE_RANK: Record<string, number> = { city: 0, town: 1, village: 2, hamlet: 3 };

export type TileId = { z: number; x: number; y: number };

/** How far an area reaches from a point in each direction, in meters. */
export type Extent = { north: number; south: number; east: number; west: number };

/** The tiles that cover `extent` around `center` (a number means the same distance every way). */
export function tilesCovering(center: LatLon, extent: number | Extent, z = TILE_ZOOM): TileId[] {
  const e = typeof extent === 'number' ? { north: extent, south: extent, east: extent, west: extent } : extent;
  const mPerLat = 110574;
  const mPerLon = 111320 * Math.cos((center.lat * Math.PI) / 180);
  const n = 2 ** z;
  const tileX = (lon: number) => Math.floor(((lon + 180) / 360) * n);
  const tileY = (lat: number) => {
    const r = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  };
  const tiles: TileId[] = [];
  for (let x = tileX(center.lon - e.west / mPerLon); x <= tileX(center.lon + e.east / mPerLon); x++) {
    for (let y = tileY(center.lat + e.north / mPerLat); y <= tileY(center.lat - e.south / mPerLat); y++) tiles.push({ z, x, y });
  }
  return tiles;
}

/** A point inside a tile (0…extent on each axis) back to latitude and longitude. */
export function tilePointToLatLon({ z, x, y }: TileId, px: number, py: number, extent: number): LatLon {
  const n = 2 ** z;
  const lon = ((x + px / extent) / n) * 360 - 180;
  const merc = Math.PI - (2 * Math.PI * (y + py / extent)) / n;
  return { lat: (Math.atan(Math.sinh(merc)) * 180) / Math.PI, lon };
}

function areaKind(layer: string, props: Record<string, unknown>): AreaKind | null {
  const cls = props.class;
  const sub = props.subclass;
  if (layer === 'water') return 'water';
  if (layer === 'landuse') return cls === 'residential' || cls === 'suburb' || cls === 'neighbourhood' ? 'town' : null;
  if (layer !== 'landcover') return null;
  if (cls === 'farmland') return sub === 'farmland' ? 'field' : 'green'; // orchards and vineyards read as green
  if (cls === 'grass') return sub === 'meadow' ? 'field' : 'green';
  if (cls === 'wood') return 'green';
  return null;
}

/** Twice the signed area of a ring in tile coordinates; positive for outer rings (the tile spec's winding). */
function ringArea(ring: { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += ring[j].x * ring[i].y - ring[i].x * ring[j].y;
  return sum;
}

/** Decodes one tile into the map's layers. Holes in areas are dropped: fields are drawn faintly enough not to need them. */
export function decodeTile(data: ArrayBuffer | Uint8Array, tile: TileId): MapLayers {
  const vt = new VectorTile(new PbfReader(data instanceof Uint8Array ? data : new Uint8Array(data)));
  const out: MapLayers = { roads: [], areas: [], places: [] };
  const key = `${tile.z}/${tile.x}/${tile.y}`;

  const each = (layerName: string, fn: (f: VectorTileFeature, i: number, extent: number) => void) => {
    const layer = vt.layers[layerName];
    if (!layer) return;
    for (let i = 0; i < layer.length; i++) fn(layer.feature(i), i, layer.extent);
  };
  const toLatLon = (pts: { x: number; y: number }[], extent: number) => pts.map((p) => tilePointToLatLon(tile, p.x, p.y, extent));

  each('transportation', (f, i, extent) => {
    const rank = ROAD_RANK[String(f.properties.class)];
    if (f.type !== 2 || rank === undefined) return;
    f.loadGeometry().forEach((line, j) => {
      if (line.length >= 2) out.roads.push({ id: `${key}/r${i}.${j}`, rank, points: toLatLon(line, extent) });
    });
  });

  for (const layerName of ['landcover', 'landuse', 'water']) {
    each(layerName, (f, i, extent) => {
      const kind = areaKind(layerName, f.properties);
      if (!kind || f.type !== 3) return;
      f.loadGeometry().forEach((ring, j) => {
        if (ring.length >= 3 && ringArea(ring) > 0) out.areas.push({ id: `${key}/${layerName}${i}.${j}`, kind, points: toLatLon(ring, extent) });
      });
    });
  }

  each('place', (f, i, extent) => {
    const rank = PLACE_RANK[String(f.properties.class)];
    const name = f.properties['name:he'] ?? f.properties.name;
    const point = f.loadGeometry()[0]?.[0];
    if (rank === undefined || !name || !point) return;
    out.places.push({ id: `${key}/p${i}`, name: String(name), rank, ...tilePointToLatLon(tile, point.x, point.y, extent) });
  });

  return out;
}

/** Joins tiles' layers. A place near a tile edge appears in both tiles, so places are kept once by name. */
export function mergeLayers(parts: MapLayers[]): MapLayers {
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const p of parts.flatMap((part) => part.places)) {
    // A place repeated in a neighbouring tile has the same name at (almost) the same point; two different
    // places can share a name, so the position is part of the key.
    const key = `${p.name}|${p.lat.toFixed(3)}|${p.lon.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push(p);
  }
  return { roads: parts.flatMap((p) => p.roads), areas: parts.flatMap((p) => p.areas), places };
}

const FETCH_TIMEOUT_MS = 15000;
/** Decoded tiles kept in memory; the oldest go first. A 10 km map is at most ~25 tiles. */
const MAX_CACHED_TILES = 60;

// Tiles don't change while the app runs, so each is fetched once (until it falls out of the cache).
const tileCache = new Map<string, Promise<MapLayers>>();
let tileUrl: Promise<string> | null = null;

/** fetch that gives up after `ms`, so one stalled request can't hold up the whole map. */
async function fetchWithTimeout(url: string, ms = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (e) {
    throw controller.signal.aborted ? new Error(`timeout: ${url.replace(/^https?:\/\/[^/]+/, '')}`) : e;
  } finally {
    clearTimeout(timer);
  }
}

/** The current tile URL template ("…/{z}/{x}/{y}.pbf"); OpenFreeMap puts the build date in the path. */
function currentTileUrl(): Promise<string> {
  tileUrl ??= fetchWithTimeout(TILEJSON_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`tiles: HTTP ${r.status}`);
      return r.json() as Promise<{ tiles?: unknown[] }>;
    })
    .then((json) => {
      const template = json.tiles?.[0];
      if (typeof template !== 'string') throw new Error('tiles: no tile URL');
      return template;
    })
    .catch((e: unknown) => {
      tileUrl = null; // try again next time
      throw e;
    });
  return tileUrl;
}

function loadTile(template: string, tile: TileId): Promise<MapLayers> {
  const url = template.replace('{z}', String(tile.z)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y));
  let pending = tileCache.get(url);
  if (pending) {
    // Most recently used goes to the back of the line.
    tileCache.delete(url);
    tileCache.set(url, pending);
    return pending;
  }
  pending = fetchWithTimeout(url)
    .then((r) => {
      // A new OpenFreeMap build moves the tiles; fetch the template again next time.
      if (r.status === 404) tileUrl = null;
      if (!r.ok) throw new Error(`tile ${tile.z}/${tile.x}/${tile.y}: HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then((buf) => decodeTile(buf, tile));
  pending.catch(() => tileCache.delete(url));
  tileCache.set(url, pending);
  while (tileCache.size > MAX_CACHED_TILES) tileCache.delete(tileCache.keys().next().value!);
  return pending;
}

/** The map's layers, and if some tiles failed to load, why (the map then has gaps until a retry). */
export type MapFetch = { layers: MapLayers; missing: string | null };

/**
 * Roads, land and place names over `extent` around `center`, from tiles at zoom `z`. Tiles that
 * fail are left out and reported in `missing`; it only throws if none could be loaded.
 */
export async function fetchMapLayers(center: LatLon, extent: number | Extent, z = TILE_ZOOM): Promise<MapFetch> {
  const template = await currentTileUrl();
  const tiles = tilesCovering(center, extent, z);
  const results = await Promise.allSettled(tiles.map((t) => loadTile(template, t)));
  const loaded = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  const reason = (r: PromiseRejectedResult) => (r.reason instanceof Error ? r.reason.message : String(r.reason));
  if (loaded.length === 0) throw new Error(failed[0] ? reason(failed[0]) : 'tiles: none loaded');
  return {
    layers: mergeLayers(loaded),
    missing: failed.length ? `${failed.length}/${tiles.length} tiles: ${reason(failed[0])}` : null,
  };
}
