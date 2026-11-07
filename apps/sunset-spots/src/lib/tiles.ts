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

/** Zoom 12 tiles are ~8 km across here and still carry every street and field: a 10 km map is 3×3 to 4×4 tiles. */
export const TILE_ZOOM = 12;
const TILEJSON_URL = 'https://tiles.openfreemap.org/planet';

const ROAD_RANK: Record<string, number> = { motorway: 0, trunk: 0, primary: 0, secondary: 1, tertiary: 2, minor: 3 };
const PLACE_RANK: Record<string, number> = { city: 0, town: 1, village: 2, hamlet: 3 };

export type TileId = { z: number; x: number; y: number };

/** The tiles that cover a circle of `radiusMeters` around `center`. */
export function tilesCovering(center: LatLon, radiusMeters: number, z = TILE_ZOOM): TileId[] {
  const dLat = radiusMeters / 110574;
  const dLon = radiusMeters / (111320 * Math.cos((center.lat * Math.PI) / 180));
  const n = 2 ** z;
  const tileX = (lon: number) => Math.floor(((lon + 180) / 360) * n);
  const tileY = (lat: number) => {
    const r = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  };
  const tiles: TileId[] = [];
  for (let x = tileX(center.lon - dLon); x <= tileX(center.lon + dLon); x++) {
    for (let y = tileY(center.lat + dLat); y <= tileY(center.lat - dLat); y++) tiles.push({ z, x, y });
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
    if (seen.has(p.name)) continue;
    seen.add(p.name);
    places.push(p);
  }
  return { roads: parts.flatMap((p) => p.roads), areas: parts.flatMap((p) => p.areas), places };
}

// Tiles don't change while the app runs, so each is fetched once.
const tileCache = new Map<string, Promise<MapLayers>>();
let tileUrl: Promise<string> | null = null;

/** The current tile URL template ("…/{z}/{x}/{y}.pbf"); OpenFreeMap puts the build date in the path. */
function currentTileUrl(): Promise<string> {
  tileUrl ??= fetch(TILEJSON_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`tiles: HTTP ${r.status}`);
      return r.json() as Promise<{ tiles: string[] }>;
    })
    .then((json) => json.tiles[0])
    .catch((e: unknown) => {
      tileUrl = null; // try again next time
      throw e;
    });
  return tileUrl;
}

function loadTile(template: string, tile: TileId): Promise<MapLayers> {
  const url = template.replace('{z}', String(tile.z)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y));
  let pending = tileCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`tile ${tile.z}/${tile.x}/${tile.y}: HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => decodeTile(buf, tile));
    pending.catch(() => tileCache.delete(url));
    tileCache.set(url, pending);
  }
  return pending;
}

/**
 * Roads, land and place names within `radiusMeters` of `center`. Tiles that fail are left out;
 * it only throws if none could be loaded, with the first reason.
 */
export async function fetchMapLayers(center: LatLon, radiusMeters: number): Promise<MapLayers> {
  const template = await currentTileUrl();
  const results = await Promise.allSettled(tilesCovering(center, radiusMeters).map((t) => loadTile(template, t)));
  const loaded = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  if (loaded.length === 0) {
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    throw failed?.reason instanceof Error ? failed.reason : new Error('tiles: none loaded');
  }
  return mergeLayers(loaded);
}
