import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { bearingDegrees, type LatLon } from '../lib/geo';
import type { ScoredSpot } from '../lib/score';
import { colors, fonts } from '../theme';
import { ICON_PATHS, PIN_PATH } from './SpotPin';

const HEIGHT = 300;
const MAX_DISTANCE_M = 10000;
const RING_KM = [2, 5, 10];
const LABELLED = 3;

type Props = { from: LatLon; sunsetBearing: number; spots: ScoredSpot[] };

/**
 * A north-up, playful "radar" map: you in the middle, sunset spots at their true bearing,
 * distance on a square-root scale so near spots don't crowd the centre. Stands in for the
 * real Mapbox map until that lands, in the same warm style.
 */
export function SpotMap({ from, sunsetBearing, spots }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const cx = width / 2;
  const cy = HEIGHT / 2 + 10;
  const radius = Math.min(cx, HEIGHT / 2) - 22;
  const toScreen = (bearing: number, meters: number) => {
    const r = radius * Math.sqrt(Math.min(meters, MAX_DISTANCE_M) / MAX_DISTANCE_M);
    const a = (bearing * Math.PI) / 180;
    return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
  };

  const beamLeft = toScreen(sunsetBearing - 12, MAX_DISTANCE_M * 1.4);
  const beamRight = toScreen(sunsetBearing + 12, MAX_DISTANCE_M * 1.4);
  const sun = toScreen(sunsetBearing, MAX_DISTANCE_M);
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
          {RING_KM.map((km, i) => {
            const r = radius * Math.sqrt((km * 1000) / MAX_DISTANCE_M);
            return (
              <G key={km}>
                <Circle cx={cx} cy={cy} r={r} fill={['#F6DDBD', '#F8E3C6', '#FAE8CF'][i]} opacity={0.9 - i * 0.2} />
                <SvgText x={cx} y={cy - r + 13} fontSize={10} fontFamily={fonts.medium} fill={colors.muted} textAnchor="middle">
                  {`${km} ק"מ`}
                </SvgText>
              </G>
            );
          }).reverse()}
          <Path d={`M ${cx} ${cy} L ${beamLeft.x} ${beamLeft.y} L ${beamRight.x} ${beamRight.y} Z`} fill="url(#mapBeam)" />
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
