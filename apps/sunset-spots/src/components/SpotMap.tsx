import { memo, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { LatLon } from '../lib/geo';
import { edgePoint, layoutLabels, makeProjection, shapePath, type Box, type PlacedLabel, type Projection } from '../lib/mapview';
import type { AreaKind, MapLayers } from '../lib/tiles';
import type { ShownSpot } from '../lib/travel';
import { colors, fonts } from '../theme';
import { ICON_PATHS, PIN_PATH } from './SpotPin';

const LABELLED = 3;
/** Streets only when zoomed in: further out a town's streets merge into one white blob. */
const STREETS_MAX_RANGE_M = 3500;
/**
 * Road look by rank (0 main roads … 3 streets): main roads chunky and toy-like with an outline,
 * shrinking down to a thin white line, so towns don't turn into a white tangle.
 */
const ROAD_STYLE = [
  { edge: 9, fill: 6 },
  { edge: 0, fill: 4.5 },
  { edge: 0, fill: 3 },
  { edge: 0, fill: 2 },
];

// Warm, Waze-like ground colours, matching the mockup (ideas/mockups/sunset-app/).
// Kept light and close together on purpose: the map is a calm backdrop for the pins and the sunset,
// so land use is a hint, not a pattern, and nothing on it is darker than it needs to be.
const MAP = {
  ground: '#FCEBD5',
  field: '#F9E4C9',
  green: '#E6E6BE',
  water: '#C9E2E2',
  town: '#F7DCC4',
  roadEdge: '#EFC9A6',
  label: '#9E6E50',
};
/** Areas smaller than this (px across) are dropped: scattered specks are noise at this scale. */
const MIN_AREA_PX = 8;
/** Place names on the map at most. */
const MAX_LABELS = 5;

const AREA_ORDER: AreaKind[] = ['field', 'green', 'water', 'town'];

type Props = {
  from: LatLon;
  sunsetBearing: number;
  spots: ShownSpot[];
  layers: MapLayers;
  /** How far the map shows around you, from mapRange(); the map tiles are fetched for the same range. */
  range: number;
  height: number;
  /** Height covered by the card floating over the top of the map. */
  top?: number;
};

/** Pin size in px: the best spot's pin is bigger. Its tip is the spot. */
const pinSize = (rank: number) => {
  const w = rank === 0 ? 38 : 28;
  return { w, h: w * 1.25 };
};

/**
 * The main map: north-up, you in the middle, real fields, built-up areas, roads and settlement
 * names from OpenStreetMap, the sunset beam, and the spots as pins, zoomed to fit them (2–10 km).
 * Stands in for the Mapbox map until that lands, in the same warm style.
 */
export function SpotMap({ from, sunsetBearing, spots, layers, range, height, top = 0 }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const { lat, lon } = from;

  // Names keep clear of the pins and the sun. The screen re-renders every second for the countdown,
  // so the layout is redone only when the places, the view or the pins actually move.
  const pinKey = spots.map((s) => `${s.lat},${s.lon}`).join(';');
  const bearingKey = Math.round(sunsetBearing);
  const labels = useMemo(() => {
    if (width === 0) return [];
    const proj = makeProjection({ lat, lon }, width, height, range, top);
    const pins: Box[] = (pinKey ? pinKey.split(';') : []).map((pair, rank) => {
      const [pLat, pLon] = pair.split(',').map(Number);
      const p = proj.toXY({ lat: pLat, lon: pLon });
      const { w, h } = pinSize(rank);
      return { x0: p.x - w / 2, y0: p.y - h - 4, x1: p.x + w / 2 + 8, y1: p.y };
    });
    const sun = edgePoint(proj, bearingKey, 24);
    const sunBox: Box = { x0: sun.x - 20, y0: sun.y - 20, x1: sun.x + 20, y1: sun.y + 20 };
    return layoutLabels(layers.places, proj, MAX_LABELS, [...pins, sunBox]);
  }, [layers.places, lat, lon, width, height, range, top, pinKey, bearingKey]);

  return (
    <View style={[styles.box, { height }]} onLayout={onLayout} accessibilityLabel="מפת המקומות סביבך">
      {width > 0 && (
        <Svg width={width} height={height}>
          <BaseLayers lat={lat} lon={lon} width={width} height={height} top={top} range={range} layers={layers} />
          <Overlay proj={makeProjection(from, width, height, range, top)} sunsetBearing={sunsetBearing} spots={spots} labels={labels} />
        </Svg>
      )}
    </View>
  );
}

/** Ground, land use, roads and names: heavy to build, and only changes when you move or the zoom changes. */
const BaseLayers = memo(function BaseLayers({
  lat,
  lon,
  width,
  height,
  top,
  range,
  layers,
}: {
  lat: number;
  lon: number;
  width: number;
  height: number;
  top: number;
  range: number;
  layers: MapLayers;
}) {
  const shapes = useMemo(() => {
    const proj = makeProjection({ lat, lon }, width, height, range, top);
    const areas = AREA_ORDER.flatMap((kind) =>
      layers.areas
        .filter((a) => a.kind === kind)
        .map((a) => ({ id: a.id, kind, d: shapePath(a.points, proj, true, 0.5, MIN_AREA_PX) }))
        .filter((a): a is { id: string; kind: AreaKind; d: string } => a.d !== null),
    );
    const roads = layers.roads
      .filter((r) => r.rank < 3 || range <= STREETS_MAX_RANGE_M)
      .map((r) => ({ id: r.id, rank: r.rank, d: shapePath(r.points, proj, false) }))
      .filter((r): r is { id: string; rank: number; d: string } => r.d !== null)
      // Small roads first so bigger ones sit on top at junctions.
      .sort((a, b) => b.rank - a.rank);
    return { areas, roads };
  }, [lat, lon, width, height, top, range, layers]);

  const areaFill: Record<AreaKind, string> = {
    field: MAP.field,
    green: MAP.green,
    water: MAP.water,
    town: MAP.town,
  };

  return (
    <G>
      <Rect x={0} y={0} width={width} height={height} fill={MAP.ground} />
      {shapes.areas.map((a) => (
        // No outlines: areas arrive cut at tile edges, and an outline would trace those cuts.
        <Path key={a.id} d={a.d} fill={areaFill[a.kind]} />
      ))}
      {shapes.roads.map((r) =>
        ROAD_STYLE[r.rank].edge ? (
          <Path key={`${r.id}-c`} d={r.d} fill="none" stroke={MAP.roadEdge} strokeWidth={ROAD_STYLE[r.rank].edge} strokeLinecap="round" strokeLinejoin="round" />
        ) : null,
      )}
      {shapes.roads.map((r) => (
        <Path key={r.id} d={r.d} fill="none" stroke={colors.white} strokeWidth={ROAD_STYLE[r.rank].fill} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </G>
  );
});

/** Sunset beam, the sun at the map's edge, place names, the spot pins and you. Cheap, redrawn as the spots re-rank. */
function Overlay({ proj, sunsetBearing, spots, labels }: { proj: Projection; sunsetBearing: number; spots: ShownSpot[]; labels: PlacedLabel[] }) {
  const { center } = proj;
  const far = Math.hypot(proj.width, proj.height);
  const ray = (bearing: number) => {
    const a = (bearing * Math.PI) / 180;
    return { x: center.x + far * Math.sin(a), y: center.y - far * Math.cos(a) };
  };
  const beamLeft = ray(sunsetBearing - 12);
  const beamRight = ray(sunsetBearing + 12);
  const sun = edgePoint(proj, sunsetBearing, 24);
  // Far spots first so near ones sit on top; the best spot always last.
  const drawn = [...spots].reverse();

  return (
    <G>
      <Defs>
        <RadialGradient id="mapBeam" cx={center.x} cy={center.y} r={far / 2} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.gold} stopOpacity="0.5" />
          <Stop offset="1" stopColor={colors.orange} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Path d={`M ${center.x} ${center.y} L ${beamLeft.x} ${beamLeft.y} L ${beamRight.x} ${beamRight.y} Z`} fill="url(#mapBeam)" />
      <Circle cx={sun.x} cy={sun.y} r={20} fill={colors.gold} opacity={0.35} />
      <Circle cx={sun.x} cy={sun.y} r={12} fill="#F7A23A" stroke={colors.white} strokeWidth={3} />

      {labels.map((l) => (
        <G key={l.id}>
          {/* A halo in the ground colour keeps names readable over roads (react-native-svg has no paint-order). */}
          <SvgText x={l.x} y={l.y} fontSize={l.fontSize} fontFamily={fonts.semibold} fill={MAP.ground} stroke={MAP.ground} strokeWidth={4} strokeLinejoin="round" textAnchor="middle">
            {l.name}
          </SvgText>
          <SvgText x={l.x} y={l.y} fontSize={l.fontSize} fontFamily={fonts.semibold} fill={MAP.label} textAnchor="middle">
            {l.name}
          </SvgText>
        </G>
      ))}

      {drawn.map((spot) => {
        const rank = spots.indexOf(spot);
        const p = proj.toXY(spot);
        const { w, h } = pinSize(rank);
        return (
          <G key={spot.id} opacity={spot.reach.opacity}>
            <G transform={`translate(${p.x - w / 2} ${p.y - h}) scale(${w / 40})`}>
              <Path d={PIN_PATH} fill={spot.reach.color} stroke={colors.white} strokeWidth={3} />
              <G transform="translate(10 9) scale(0.8333)">
                <Path d={ICON_PATHS[spot.kind]} fill="none" stroke={colors.white} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </G>
            </G>
            {rank < LABELLED && (
              <G>
                <Circle cx={p.x + w / 2} cy={p.y - h + 4} r={8} fill={colors.white} />
                <SvgText x={p.x + w / 2} y={p.y - h + 8} fontSize={11} fontFamily={fonts.bold} fill={colors.orangeText} textAnchor="middle">
                  {`${rank + 1}`}
                </SvgText>
              </G>
            )}
          </G>
        );
      })}

      <Circle cx={center.x} cy={center.y} r={18} fill={colors.orange} opacity={0.15} />
      <Circle cx={center.x} cy={center.y} r={10} fill={colors.white} />
      <Circle cx={center.x} cy={center.y} r={6} fill={colors.ink} />
    </G>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: MAP.ground },
});
