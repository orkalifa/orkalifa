import { memo, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, Path, Pattern, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { LatLon } from '../lib/geo';
import { edgePoint, layoutLabels, makeProjection, mapRange, shapePath, type Projection } from '../lib/mapview';
import type { AreaKind, MapLayers } from '../lib/osm';
import type { ScoredSpot } from '../lib/score';
import { colors, fonts } from '../theme';
import { ICON_PATHS, PIN_PATH } from './SpotPin';

const LABELLED = 3;

// Warm, Waze-like ground colours, matching the mockup (ideas/mockups/sunset-app/).
const MAP = {
  ground: '#FCEBD5',
  field: '#F6D6AC',
  fieldStripe: '#EFC797',
  green: '#D9DCA6',
  water: '#BFDCDD',
  town: '#F3CDAE',
  townEdge: '#EBAE80',
  roadEdge: '#E7B48A',
  label: '#8A5A3E',
};

const AREA_ORDER: AreaKind[] = ['field', 'green', 'water', 'town'];

type Props = {
  from: LatLon;
  sunsetBearing: number;
  spots: ScoredSpot[];
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
      .map((r) => ({ id: r.id, major: r.major, d: shapePath(r.points, proj, false) }))
      .filter((r): r is { id: string; major: boolean; d: string } => r.d !== null)
      // Minor streets first so main roads sit on top at junctions.
      .sort((a, b) => Number(a.major) - Number(b.major));
    return { areas, roads, labels: layoutLabels(layers.places, proj), scale: scaleBar(proj) };
  }, [lat, lon, width, height, top, range, layers]);

  const areaFill: Record<AreaKind, string> = {
    field: 'url(#fieldStripes)',
    green: MAP.green,
    water: MAP.water,
    town: MAP.town,
  };

  return (
    <G>
      <Defs>
        <Pattern id="fieldStripes" patternUnits="userSpaceOnUse" width={12} height={12} patternTransform="rotate(-18)">
          <Rect x={0} y={0} width={12} height={12} fill={MAP.field} />
          <Line x1={0} y1={6} x2={12} y2={6} stroke={MAP.fieldStripe} strokeWidth={2.5} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={MAP.ground} />
      {shapes.areas.map((a) => (
        <Path
          key={a.id}
          d={a.d}
          fill={areaFill[a.kind]}
          stroke={a.kind === 'town' ? MAP.townEdge : 'none'}
          strokeWidth={a.kind === 'town' ? 1 : 0}
          strokeLinejoin="round"
        />
      ))}
      {shapes.roads.map((r) => (
        <Path key={`${r.id}-c`} d={r.d} fill="none" stroke={MAP.roadEdge} strokeWidth={r.major ? 8 : 5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {shapes.roads.map((r) => (
        <Path key={r.id} d={r.d} fill="none" stroke={colors.white} strokeWidth={r.major ? 5 : 3} strokeLinecap="round" strokeLinejoin="round" />
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
      <G>
        {/* Bottom right: the compass button sits bottom left. */}
        <Rect x={width - 14 - shapes.scale.px} y={height - 30} width={shapes.scale.px} height={5} rx={2.5} fill={colors.white} stroke={MAP.label} strokeWidth={1} />
        <SvgText x={width - 14} y={height - 36} fontSize={11} fontFamily={fonts.medium} fill={MAP.label} textAnchor="end">
          {shapes.scale.label}
        </SvgText>
      </G>
    </G>
  );
});

/** Sunset beam, the sun at the map's edge, the spot pins and you. Cheap, redrawn as the spots re-rank. */
function Overlay({ proj, sunsetBearing, spots }: { proj: Projection; sunsetBearing: number; spots: ScoredSpot[] }) {
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
          <G key={spot.id}>
            <Ellipse cx={p.x} cy={p.y} rx={9} ry={3.5} fill={colors.ink} opacity={0.18} />
            <G transform={`translate(${p.x - w / 2} ${p.y - h}) scale(${w / 40})`}>
              <Path d={PIN_PATH} fill={rank === 0 ? colors.orange : '#EE9A62'} stroke={colors.white} strokeWidth={3} />
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

const SCALE_STEPS_M = [100, 200, 500, 1000, 2000, 5000];

/** The longest round distance that fits in about a quarter of the map's width. */
function scaleBar(proj: Projection): { px: number; label: string } {
  const max = proj.width * 0.28;
  const meters = [...SCALE_STEPS_M].reverse().find((m) => m * proj.pxPerMeter <= max) ?? SCALE_STEPS_M[0];
  return { px: meters * proj.pxPerMeter, label: meters < 1000 ? `${meters} מ'` : `${meters / 1000} ק"מ` };
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: MAP.ground },
});
