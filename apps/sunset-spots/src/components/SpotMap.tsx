import { memo, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { LatLon } from '../lib/geo';
import { edgePoint, layoutLabels, makeProjection, mapRange, shapePath, type Projection } from '../lib/mapview';
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
  { edge: 7, fill: 4.5 },
  { edge: 0, fill: 3 },
  { edge: 0, fill: 2 },
];

// Warm, Waze-like ground colours, matching the mockup (ideas/mockups/sunset-app/).
const MAP = {
  ground: '#FCEBD5',
  // Fields barely set off from the ground: there are so many that anything stronger turns into a grid of tiles.
  field: '#F9E4C9',
  green: '#E2E2B4',
  water: '#BFDCDD',
  town: '#F3CDAE',
  roadEdge: '#E7B48A',
  label: '#8A5A3E',
};

const AREA_ORDER: AreaKind[] = ['field', 'green', 'water', 'town'];

type Props = {
  from: LatLon;
  sunsetBearing: number;
  spots: ShownSpot[];
  layers: MapLayers;
  height: number;
  /** Height covered by the card floating over the top of the map. */
  top?: number;
};

/**
 * The main map: north-up, you in the middle, real fields, built-up areas, roads and settlement
 * names from OpenStreetMap, the sunset beam, and the spots as pins, zoomed to fit them (2–10 km).
 * Stands in for the Mapbox map until that lands, in the same warm style.
 */
export function SpotMap({ from, sunsetBearing, spots, layers, height, top = 0 }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const range = mapRange(spots.map((s) => s.distance));

  return (
    <View style={[styles.box, { height }]} onLayout={onLayout} accessibilityLabel="מפת המקומות סביבך">
      {width > 0 && (
        <Svg width={width} height={height}>
          <BaseLayers lat={from.lat} lon={from.lon} width={width} height={height} top={top} range={range} layers={layers} />
          <Overlay proj={makeProjection(from, width, height, range, top)} sunsetBearing={sunsetBearing} spots={spots} />
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
        .map((a) => ({ id: a.id, kind, d: shapePath(a.points, proj, true) }))
        .filter((a): a is { id: string; kind: AreaKind; d: string } => a.d !== null),
    );
    const roads = layers.roads
      .filter((r) => r.rank < 3 || range <= STREETS_MAX_RANGE_M)
      .map((r) => ({ id: r.id, rank: r.rank, d: shapePath(r.points, proj, false) }))
      .filter((r): r is { id: string; rank: number; d: string } => r.d !== null)
      // Small roads first so bigger ones sit on top at junctions.
      .sort((a, b) => b.rank - a.rank);
    return { areas, roads, labels: layoutLabels(layers.places, proj) };
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
      {shapes.labels.map((l) => (
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
    </G>
  );
});

/** Sunset beam, the sun at the map's edge, the spot pins and you. Cheap, redrawn as the spots re-rank. */
function Overlay({ proj, sunsetBearing, spots }: { proj: Projection; sunsetBearing: number; spots: ShownSpot[] }) {
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

      {drawn.map((spot) => {
        const rank = spots.indexOf(spot);
        const p = proj.toXY(spot);
        const w = rank === 0 ? 38 : 28;
        const h = w * 1.25;
        return (
          <G key={spot.id} opacity={spot.reach.opacity}>
            <Ellipse cx={p.x} cy={p.y} rx={9} ry={3.5} fill={colors.ink} opacity={0.18} />
            <G transform={`translate(${p.x - w / 2} ${p.y - h}) scale(${w / 40})`}>
              <Path d={PIN_PATH} fill={spot.reach.color} stroke={colors.white} strokeWidth={3} />
              <G transform="translate(10 9) scale(0.8333)">
                <Path d={ICON_PATHS[spot.kind]} fill="none" stroke={colors.white} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </G>
            </G>
            {rank < LABELLED && (
              <G>
                <Circle cx={p.x + w / 2} cy={p.y - h + 4} r={8} fill={colors.white} />
                <SvgText x={p.x + w / 2} y={p.y - h + 8} fontSize={11} fontFamily={fonts.bold} fill={colors.ink} textAnchor="middle">
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
