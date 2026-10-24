import type { LatLon } from './geo.ts';

/**
 * Screen geometry for the main map: a flat, north-up projection centred on you.
 * Over the ~10 km the map covers, treating the earth as flat is off by well under a pixel.
 */

const METERS_PER_DEG_LAT = 110574;
const METERS_PER_DEG_LON_AT_EQUATOR = 111320;

export type Point = { x: number; y: number };

export type Projection = {
  width: number;
  height: number;
  /** Top of the visible map area (below any card floating over the map). */
  top: number;
  center: Point;
  pxPerMeter: number;
  toXY: (p: LatLon) => Point;
};

/**
 * `rangeMeters` is how far from you the map must show in every direction: it fits the
 * shorter side of the visible area, so a tall map shows more to the north and south.
 * `top` is covered by a floating card, so you sit in the middle of what's left below it.
 */
export function makeProjection(from: LatLon, width: number, height: number, rangeMeters: number, top = 0, margin = 28): Projection {
  const center = { x: width / 2, y: top + (height - top) / 2 };
  const pxPerMeter = Math.max(1, Math.min(width, height - top) / 2 - margin) / rangeMeters;
  const lonScale = METERS_PER_DEG_LON_AT_EQUATOR * Math.cos((from.lat * Math.PI) / 180);
  return {
    width,
    height,
    top,
    center,
    pxPerMeter,
    toXY: (p) => ({
      x: center.x + (p.lon - from.lon) * lonScale * pxPerMeter,
      y: center.y - (p.lat - from.lat) * METERS_PER_DEG_LAT * pxPerMeter,
    }),
  };
}

/** Zoom so the farthest shown spot sits comfortably inside the map, within 2–10 km. */
export function mapRange(distances: number[], min = 2000, max = 10000): number {
  const farthest = Math.max(0, ...distances);
  return Math.min(max, Math.max(min, farthest * 1.25));
}

/**
 * SVG path for a line or polygon, dropping points that land within `minStep` px of the last
 * kept one (a field edge can have hundreds of points that all fall on the same pixel).
 * Null if the shape is too small to see or entirely off screen.
 */
export function shapePath(points: LatLon[], proj: Projection, closed: boolean, minStep = 1.5): string | null {
  if (points.length < 2) return null;
  let d = '';
  let last: Point | null = null;
  let kept = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  points.forEach((pt, i) => {
    const p = proj.toXY(pt);
    const isLast = i === points.length - 1;
    if (last && !isLast && Math.abs(p.x - last.x) < minStep && Math.abs(p.y - last.y) < minStep) return;
    d += `${kept === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    kept++;
    last = p;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });
  if (maxX < 0 || maxY < 0 || minX > proj.width || minY > proj.height) return null;
  if (closed && (kept < 3 || (maxX - minX < 2 && maxY - minY < 2))) return null;
  return closed ? `${d}Z` : d;
}

/** Where a ray from the centre toward `bearing` meets the map's edge, `inset` px inside it. */
export function edgePoint(proj: Projection, bearing: number, inset: number): Point {
  const a = (bearing * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const halfW = proj.width / 2 - inset;
  const halfH = (proj.height - proj.top) / 2 - inset;
  const t = Math.min(Math.abs(dx) > 1e-9 ? halfW / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-9 ? halfH / Math.abs(dy) : Infinity);
  return { x: proj.center.x + dx * t, y: proj.center.y + dy * t };
}

export type LabelInput = LatLon & { id: string; name: string; rank: number };
export type PlacedLabel = Point & { id: string; name: string; fontSize: number };

const FONT_SIZE_BY_RANK = [15, 13, 12, 11];

// Where to try a name relative to its place, in px: on it, then just above, then just below.
const LABEL_NUDGES = [0, -22, 30];

/**
 * Places settlement names, most important first, nudging a name up or down if it would cover
 * a name already placed or you in the middle, and dropping it if nothing fits or it runs off the map.
 * `rank`: 0 city, 1 town, 2 village, 3 hamlet.
 */
export function layoutLabels(labels: LabelInput[], proj: Projection): PlacedLabel[] {
  const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [
    { x0: proj.center.x - 18, y0: proj.center.y - 18, x1: proj.center.x + 18, y1: proj.center.y + 18 },
  ];
  const placed: PlacedLabel[] = [];
  for (const label of [...labels].sort((a, b) => a.rank - b.rank)) {
    const fontSize = FONT_SIZE_BY_RANK[Math.min(label.rank, FONT_SIZE_BY_RANK.length - 1)];
    const at = proj.toXY(label);
    const halfW = (label.name.length * fontSize * 0.55) / 2 + 3;
    for (const nudge of LABEL_NUDGES) {
      const y = at.y + nudge;
      const box = { x0: at.x - halfW, y0: y - fontSize, x1: at.x + halfW, y1: y + 4 };
      if (box.x0 < 4 || box.x1 > proj.width - 4 || box.y0 < proj.top + 4 || box.y1 > proj.height - 4) continue;
      if (boxes.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
      boxes.push(box);
      placed.push({ id: label.id, name: label.name, fontSize, x: at.x, y });
      break;
    }
  }
  return placed;
}
