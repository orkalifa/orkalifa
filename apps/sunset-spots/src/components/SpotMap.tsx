import { memo, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { LatLon } from '../lib/geo';
import { edgePoint, layoutLabels, makeProjection, shapePath, type Box, type PlacedLabel, type Projection } from '../lib/mapview';
import type { AreaKind, MapLayers } from '../lib/tiles';
import type { ShownSpot } from '../lib/travel';
import { CREDIT_URLS, MAP_CREDIT_LABEL } from '../lib/credits';
import { colors, fonts } from '../theme';
import { ExternalLink } from './ExternalLink';
import { ICON_PATHS, PIN_PATH } from './SpotPin';

const LABELLED = 3;
/** Streets only when zoomed in: further out a town's streets merge into one white blob. */
const STREETS_MAX_RANGE_M = 3500;
/**
 * Road look by rank (0 main roads … 3 streets): main roads chunky and toy-like with a warm outline,
 * shrinking down to a thin white line, so towns stay crisp and playful.
 */
const ROAD_STYLE = [
  { edge: 9.5, fill: 6.2 },
  { edge: 6.2, fill: 4.4 },
  { edge: 0, fill: 3 },
  { edge: 0, fill: 2 },
];

// Sunlit Mediterranean atlas tones: calm, warm backdrop where the chunky white roads,
// golden sunset glow and spot pins pop effortlessly.
const MAP = {
  ground: '#FBF0DF',
  field: '#F6E5CC',
  green: '#DDE3B8',
  water: '#C0DCE0',
  town: '#F2DAC1',
  roadEdge: '#E8BE96',
  label: '#8D5F43',
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
  /** Height covered by the HUD floating over the top of the map. */
  top?: number;
  selectedId?: string | null;
  onSelectSpot?: (spot: ShownSpot) => void;
  /** Long-press on the map: the place under your finger. */
  onLongPressPoint?: (point: LatLon) => void;
};

/** Pin size in px: the best spot's pin is bigger. Its tip is the spot. */
const pinSize = (rank: number, selected: boolean) => {
  const base = rank === 0 ? 40 : 30;
  const w = selected ? base + 5 : base;
  return { w, h: w * 1.25 };
};

/**
 * The main map: north-up, you in the middle, real fields, built-up areas, chunky white roads and
 * settlement names from OpenFreeMap, sunlit horizon wash, sunset beam, and tappable spot pins.
 */
export function SpotMap({ from, sunsetBearing, spots, layers, range, height, top = 0, selectedId = null, onSelectSpot, onLongPressPoint }: Props) {
  const [width, setWidth] = useState(0);
  const boxRef = useRef<ComponentRef<typeof Pressable>>(null);
  const onLongPress = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    // Measured now, not on layout: the map scrolls with the sheet.
    boxRef.current?.measureInWindow((x, y) => {
      const proj = makeProjection(from, width, height, range, top);
      onLongPressPoint?.(proj.toLatLon({ x: pageX - x, y: pageY - y }));
    });
  };
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
      const { w, h } = pinSize(rank, false);
      return { x0: p.x - w / 2, y0: p.y - h - 4, x1: p.x + w / 2 + 8, y1: p.y };
    });
    const sun = edgePoint(proj, bearingKey, 26);
    const sunBox: Box = { x0: sun.x - 22, y0: sun.y - 22, x1: sun.x + 22, y1: sun.y + 22 };
    return layoutLabels(layers.places, proj, MAX_LABELS, [...pins, sunBox]);
  }, [layers.places, lat, lon, width, height, range, top, pinKey, bearingKey]);

  return (
    <Pressable
      ref={boxRef}
      style={[styles.box, { height }]}
      onLayout={onLayout}
      onLongPress={onLongPressPoint ? onLongPress : undefined}
      delayLongPress={450}
      accessibilityLabel="מפת המקומות סביבך. לחיצה ארוכה שומרת נקודה."
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          <BaseLayers lat={lat} lon={lon} width={width} height={height} top={top} range={range} layers={layers} />
          <Overlay
            proj={makeProjection(from, width, height, range, top)}
            sunsetBearing={sunsetBearing}
            spots={spots}
            labels={labels}
            selectedId={selectedId}
            onSelectSpot={onSelectSpot}
          />
        </Svg>
      )}
      {/* ODbL: the map credit stays visible by default. Kept above the sheet, which overlaps the map's bottom edge. */}
      <ExternalLink
        url={CREDIT_URLS.osmCopyright}
        label={MAP_CREDIT_LABEL}
        style={styles.credit}
        textStyle={styles.creditText}
      />
    </Pressable>
  );
}

/** Ground, land use, and chunky white roads: heavy to build, only changes when you move or zoom. */
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

/** Sunlit horizon wash, sunset beam, sun disc, place names, tappable spot pins and you. */
function Overlay({
  proj,
  sunsetBearing,
  spots,
  labels,
  selectedId,
  onSelectSpot,
}: {
  proj: Projection;
  sunsetBearing: number;
  spots: ShownSpot[];
  labels: PlacedLabel[];
  selectedId: string | null;
  onSelectSpot?: (spot: ShownSpot) => void;
}) {
  const { center, width, height } = proj;
  const far = Math.hypot(width, height);
  const ray = (bearing: number) => {
    const a = (bearing * Math.PI) / 180;
    return { x: center.x + far * Math.sin(a), y: center.y - far * Math.cos(a) };
  };
  const beamLeft = ray(sunsetBearing - 11);
  const beamRight = ray(sunsetBearing + 11);
  const sun = edgePoint(proj, sunsetBearing, 26);
  // Far spots first so near ones sit on top; the best or selected spot always on top.
  const drawn = [...spots].reverse().sort((a, b) => {
    if (a.id === selectedId) return 1;
    if (b.id === selectedId) return -1;
    return 0;
  });

  return (
    <G>
      <Defs>
        <RadialGradient id="horizonWash" cx={sun.x} cy={sun.y} r={Math.max(width, height) * 0.58} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FF9E40" stopOpacity="0.24" />
          <Stop offset="0.45" stopColor="#F5B44A" stopOpacity="0.09" />
          <Stop offset="1" stopColor="#F5B44A" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="mapBeam" cx={center.x} cy={center.y} r={far * 0.52} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#F2A92C" stopOpacity="0.42" />
          <Stop offset="0.65" stopColor="#E55B24" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#E55B24" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="mapSunGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFF5D4" stopOpacity="0.95" />
          <Stop offset="0.45" stopColor="#F5A623" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#E55B24" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1A120E" stopOpacity="0" />
          <Stop offset="1" stopColor="#1A120E" stopOpacity="0.14" />
        </LinearGradient>
      </Defs>

      {/* Soft warm sunset wash across the horizon edge of the map */}
      <Rect x={0} y={0} width={width} height={height} fill="url(#horizonWash)" />

      {/* Focused sunset light cone from your location */}
      <Path d={`M ${center.x} ${center.y} L ${beamLeft.x} ${beamLeft.y} L ${beamRight.x} ${beamRight.y} Z`} fill="url(#mapBeam)" />

      {/* Radiant sun disc at the horizon edge */}
      <Circle cx={sun.x} cy={sun.y} r={28} fill="url(#mapSunGlow)" />
      <Circle cx={sun.x} cy={sun.y} r={12.5} fill="#F59326" stroke={colors.white} strokeWidth={3} />
      <Circle cx={sun.x} cy={sun.y} r={5} fill="#FFF3C8" />

      {/* Settlement labels with crisp cream halo */}
      {labels.map((l) => (
        <G key={l.id}>
          <SvgText x={l.x} y={l.y} fontSize={l.fontSize} fontFamily={fonts.semibold} fill={MAP.ground} stroke={MAP.ground} strokeWidth={4.5} strokeLinejoin="round" textAnchor="middle">
            {l.name}
          </SvgText>
          <SvgText x={l.x} y={l.y} fontSize={l.fontSize} fontFamily={fonts.semibold} fill={MAP.label} textAnchor="middle">
            {l.name}
          </SvgText>
        </G>
      ))}

      {/* Subtle depth scrim where the rounded bottom sheet meets the map */}
      <Rect x={0} y={height - 46} width={width} height={46} fill="url(#bottomFade)" />

      {/* Tappable spot pins with grounded shadow ellipses */}
      {drawn.map((spot) => {
        const rank = spots.indexOf(spot);
        const selected = spot.id === selectedId;
        const p = proj.toXY(spot);
        const { w, h } = pinSize(rank, selected);
        return (
          <G key={spot.id} opacity={spot.reach.opacity} onPress={onSelectSpot ? () => onSelectSpot(spot) : undefined}>
            {selected && <Circle cx={p.x} cy={p.y - h * 0.55} r={w * 0.72} fill={spot.reach.color} opacity={0.22} />}
            <Ellipse cx={p.x} cy={p.y + 1} rx={w * 0.25} ry={3.2} fill="#2A1A12" opacity={0.2} />
            <G transform={`translate(${p.x - w / 2} ${p.y - h}) scale(${w / 40})`}>
              <Path d={PIN_PATH} fill={spot.reach.color} stroke={colors.white} strokeWidth={selected ? 3.6 : 3} />
              <G transform="translate(10 9) scale(0.8333)">
                <Path d={ICON_PATHS[spot.kind]} fill="none" stroke={colors.white} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </G>
            </G>
            {rank < LABELLED && (
              <G>
                <Circle
                  cx={p.x + w / 2 - 1}
                  cy={p.y - h + 5}
                  r={rank === 0 ? 9.5 : 8}
                  fill={rank === 0 ? colors.obsidian : colors.white}
                  stroke={rank === 0 ? colors.white : colors.line}
                  strokeWidth={rank === 0 ? 1.8 : 1}
                />
                <SvgText
                  x={p.x + w / 2 - 1}
                  y={p.y - h + (rank === 0 ? 9 : 8.8)}
                  fontSize={rank === 0 ? 11 : 10.5}
                  fontFamily={fonts.bold}
                  fill={rank === 0 ? '#FBD687' : colors.ink}
                  textAnchor="middle"
                >
                  {`${rank + 1}`}
                </SvgText>
              </G>
            )}
          </G>
        );
      })}

      {/* Your current location dot */}
      <Circle cx={center.x} cy={center.y} r={19} fill={colors.obsidian} opacity={0.1} />
      <Circle cx={center.x} cy={center.y} r={10.5} fill={colors.white} />
      <Circle cx={center.x} cy={center.y} r={6} fill={colors.obsidian} />
    </G>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: MAP.ground },
  credit: {
    position: 'absolute',
    end: 4,
    bottom: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(252, 248, 242, 0.7)',
  },
  creditText: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted, textDecorationLine: 'none' },
});
