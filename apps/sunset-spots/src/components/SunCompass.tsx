import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme';

type Props = {
  /** Compass bearing of the sunset, degrees from north. */
  bearing: number;
  /** Device heading, or null to draw the dial north-up. */
  heading: number | null;
  aligned: boolean;
  size?: number;
};

const CARDINALS = [
  { label: 'צ', bearing: 0 },
  { label: 'מז', bearing: 90 },
  { label: 'ד', bearing: 180 },
  { label: 'מע', bearing: 270 },
];

/** How long the dial takes to catch up with a new compass reading: enough to hide sensor steps, short enough to feel live. */
const SMOOTH_MS = 250;

export function SunCompass({ bearing, heading, aligned, size = 300 }: Props) {
  const c = size / 2;
  const ring = size * 0.38;

  // The dial is drawn north-up and the whole view turns by -heading, animated so it glides
  // between sensor readings. `turned` is unwrapped (it can pass 360) so 359° → 1° is a 2° turn, not a spin.
  const [rotation] = useState(() => new Animated.Value(0));
  const turned = useRef(0);
  useEffect(() => {
    if (heading === null) return;
    const delta = ((((heading - turned.current) % 360) + 540) % 360) - 180;
    turned.current += delta;
    Animated.timing(rotation, {
      toValue: -turned.current,
      duration: SMOOTH_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [heading, rotation]);
  const [spin] = useState(() => rotation.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'], extrapolate: 'extend' }));

  const point = (b: number, r: number) => {
    const a = (b * Math.PI) / 180;
    return { x: c + r * Math.sin(a), y: c - r * Math.cos(a) };
  };

  const beamLeft = point(bearing - 11, ring);
  const beamRight = point(bearing + 11, ring);
  const sun = point(bearing, ring);

  return (
    <View style={{ width: size, height: size }} accessibilityLabel="מצפן שמראה את כיוון השקיעה">
      <Animated.View style={{ width: size, height: size, transform: [{ rotate: spin }] }}>
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
      </Animated.View>

      {heading !== null && (
        <Svg width={size} height={size} style={{ position: 'absolute' }} pointerEvents="none">
          <Path d={`M ${c} ${c - ring - 18} l -9 -14 h 18 z`} fill={colors.ink} />
        </Svg>
      )}
    </View>
  );
}
