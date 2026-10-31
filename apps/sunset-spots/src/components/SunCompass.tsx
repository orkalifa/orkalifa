import { memo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme';

type Props = {
  /** Compass bearing of the sunset, degrees from north. */
  bearing: number;
  /**
   * Dial rotation in degrees (minus the phone's heading, unwrapped). It's animated on the UI
   * thread, so the dial turns at the screen's frame rate without React re-rendering.
   */
  rotation: SharedValue<number>;
  /** Whether there's a live heading; without one the dial stays north-up and the pointer is hidden. */
  live: boolean;
  aligned: boolean;
  size?: number;
};

const CARDINALS = [
  { label: 'צ', bearing: 0 },
  { label: 'מז', bearing: 90 },
  { label: 'ד', bearing: 180 },
  { label: 'מע', bearing: 270 },
];

export function SunCompass({ bearing, rotation, live, aligned, size = 300 }: Props) {
  const c = size / 2;
  const ring = size * 0.38;
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <View style={{ width: size, height: size }} accessibilityLabel="מצפן שמראה את כיוון השקיעה">
      <Animated.View style={[{ width: size, height: size }, spin]}>
        <Dial bearing={bearing} aligned={aligned} size={size} />
      </Animated.View>

      {live && (
        <Svg width={size} height={size} style={{ position: 'absolute' }} pointerEvents="none">
          <Path d={`M ${c} ${c - ring - 18} l -9 -14 h 18 z`} fill={colors.ink} />
        </Svg>
      )}
    </View>
  );
}

/** The north-up dial with the sun on it. Only redrawn when the bearing or alignment changes. */
const Dial = memo(function Dial({ bearing, aligned, size }: { bearing: number; aligned: boolean; size: number }) {
  const c = size / 2;
  const ring = size * 0.38;
  const point = (b: number, r: number) => {
    const a = (b * Math.PI) / 180;
    return { x: c + r * Math.sin(a), y: c - r * Math.cos(a) };
  };

  const beamLeft = point(bearing - 11, ring);
  const beamRight = point(bearing + 11, ring);
  const sun = point(bearing, ring);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id="beam" cx={c} cy={c} r={ring} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.gold} stopOpacity="0.05" />
          <Stop offset="1" stopColor={colors.gold} stopOpacity="0.7" />
        </RadialGradient>
        <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFF2CF" stopOpacity="1" />
          <Stop offset="0.5" stopColor={colors.gold} stopOpacity="0.8" />
          <Stop offset="1" stopColor={colors.orange} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Circle cx={c} cy={c} r={ring} fill={colors.sand} stroke={aligned ? colors.orange : colors.line} strokeWidth={aligned ? 4 : 2} />

      {Array.from({ length: 36 }, (_, i) => {
        const b = i * 10;
        const major = b % 90 === 0;
        const outer = point(b, ring - 4);
        const inner = point(b, ring - (major ? 18 : 10));
        return (
          <Line key={b} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={major ? colors.inkSoft : colors.peach} strokeWidth={major ? 2.5 : 1.5} strokeLinecap="round" />
        );
      })}

      {CARDINALS.map(({ label, bearing: b }) => {
        const p = point(b, ring - 36);
        return (
          <SvgText key={label} x={p.x} y={p.y + 6} fontSize={16} fontFamily={fonts.semibold} fill={b === 0 ? colors.orangeText : colors.inkSoft} textAnchor="middle">
            {label}
          </SvgText>
        );
      })}

      <Path d={`M ${c} ${c} L ${beamLeft.x} ${beamLeft.y} A ${ring} ${ring} 0 0 1 ${beamRight.x} ${beamRight.y} Z`} fill="url(#beam)" />

      <Circle cx={sun.x} cy={sun.y} r={30} fill="url(#sunGlow)" />
      <Circle cx={sun.x} cy={sun.y} r={14} fill={colors.orange} />

      <Circle cx={c} cy={c} r={12} fill={colors.white} />
      <Circle cx={c} cy={c} r={7} fill={colors.ink} />
    </Svg>
  );
});
