import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { bearingDegrees, distanceMeters, type LatLon } from '../lib/geo';
import type { Road } from '../lib/osm';
import type { ScoredSpot } from '../lib/score';
import { colors, fonts } from '../theme';
import { ICON_PATHS, PIN_PATH } from './SpotPin';

const HEIGHT = 300;
const MIN_RANGE_M = 2000;
const MAX_RANGE_M = 10000;
const LABELLED = 3;

type Props = { from: LatLon; sunsetBearing: number; spots: ScoredSpot[]; roads?: Road[] };

/**
 * A north-up, playful map: you in the middle, real roads in white, sunset spots at their true
 * bearing and distance, zoomed to fit the shown spots (2–10 km). Stands in for the Mapbox map until that lands,
 * in the same warm style.
 */
export function SpotMap({ from, sunsetBearing, spots, roads = [] }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const cx = width / 2;
  const cy = HEIGHT / 2 + 10;
  const radius = Math.min(cx, HEIGHT / 2) - 22;
  const farthest = Math.max(0, ...spots.map((s) => s.distance));
  const range = Math.min(MAX_RANGE_M, Math.max(MIN_RANGE_M, farthest * 1.3));
  const rings = [range / 3, (2 * range) / 3, range];
  const toScreen = (bearing: number, meters: number) => {
    const r = (radius * meters) / range;
    const a = (bearing * Math.PI) / 180;
    return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
  };

  const beamLeft = toScreen(sunsetBearing - 12, range * 1.4);
  const beamRight = toScreen(sunsetBearing + 12, range * 1.4);
  const sun = toScreen(sunsetBearing, range);
  const roadPath = (road: Road) =>
    road.points
      .map((pt, i) => {
        const p = toScreen(bearingDegrees(from, pt), distanceMeters(from, pt));
        return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      })
      .join(' ');
  const roadPaths = roads.map((r) => ({ id: r.id, major: r.major, d: roadPath(r) }));
  // Draw far spots first so near ones sit on top; the best spot always last.
  const drawn = [...spots].reverse();

  return (
    <View style={styles.box} onLayout={onLayout} accessibilityLabel="מפת המקומות סביבך">
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <RadialGradient id="mapBeam" cx={cx} cy={cy} r={radius * 1.2} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={colors.gold} stopOpacity="0.55" />
              <Stop offset="1" stopColor={colors.orange} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={HEIGHT} fill="#FCEBD5" />
          {[...rings].reverse().map((m, i) => (
            <Circle key={m} cx={cx} cy={cy} r={(radius * m) / range} fill={['#FAE8CF', '#F8E3C6', '#F6DDBD'][i]} opacity={0.5 + i * 0.2} />
          ))}
          {roadPaths.map((r) => (
            <Path key={`${r.id}-c`} d={r.d} fill="none" stroke="#E7B48A" strokeWidth={r.major ? 8 : 5} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {roadPaths.map((r) => (
            <Path key={r.id} d={r.d} fill="none" stroke={colors.white} strokeWidth={r.major ? 5 : 3} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          <Path d={`M ${cx} ${cy} L ${beamLeft.x} ${beamLeft.y} L ${beamRight.x} ${beamRight.y} Z`} fill="url(#mapBeam)" />
          {rings.map((m) => (
            <SvgText key={`l${m}`} x={cx} y={cy - (radius * m) / range + 13} fontSize={10} fontFamily={fonts.medium} fill={colors.muted} textAnchor="middle">
              {m < 1000 ? `${Math.round(m / 100) * 100} מ'` : `${(m / 1000).toFixed(m < 3000 ? 1 : 0)} ק"מ`}
            </SvgText>
          ))}
          <Circle cx={sun.x} cy={sun.y} r={11} fill="#F7A23A" stroke={colors.white} strokeWidth={3} />
          <SvgText x={cx} y={16} fontSize={11} fontFamily={fonts.semibold} fill={colors.orangeText} textAnchor="middle">
            צ
          </SvgText>

          {drawn.map((spot) => {
            const rank = spots.indexOf(spot);
            const p = toScreen(bearingDegrees(from, spot), spot.distance);
            const w = rank === 0 ? 34 : 26;
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

          <Circle cx={cx} cy={cy} r={10} fill={colors.white} />
          <Circle cx={cx} cy={cy} r={6} fill={colors.ink} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: HEIGHT, borderRadius: 24, overflow: 'hidden', backgroundColor: '#FCEBD5' },
});
