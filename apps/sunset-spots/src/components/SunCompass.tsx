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
  const ring = size * 0.39;
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <View style={{ width: size, height: size }} accessibilityLabel="מצפן שמראה את כיוון השקיעה">
      <Animated.View style={[{ width: size, height: size }, spin]}>
        <Dial bearing={bearing} aligned={aligned} size={size} />
      </Animated.View>

      {live && (
        <Svg width={size} height={size} style={{ position: 'absolute' }} pointerEvents="none">
          <Path
            d={`M ${c} ${c - ring - 6} l -8 -14 h 16 z`}
            fill={aligned ? '#FFBA49' : '#FFF4E6'}
          />
        </Svg>
      )}
    </View>
  );
}

/** Precision twilight solar dial. Only redrawn when the bearing or alignment changes. */
const Dial = memo(function Dial({ bearing, aligned, size }: { bearing: number; aligned: boolean; size: number }) {
  const c = size / 2;
  const ring = size * 0.39;
  const point = (b: number, r: number) => {
    const a = (b * Math.PI) / 180;
    return { x: c + r * Math.sin(a), y: c - r * Math.cos(a) };
  };

  const beamLeft = point(bearing - 13, ring);
  const beamRight = point(bearing + 13, ring);
  const sun = point(bearing, ring);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id="dialFace" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#2B1E17" />
          <Stop offset="1" stopColor="#1B120E" />
        </RadialGradient>
        <RadialGradient id="beam" cx={c} cy={c} r={ring} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#F5A623" stopOpacity="0.06" />
          <Stop offset="0.6" stopColor="#F5A623" stopOpacity="0.28" />
          <Stop offset="1" stopColor="#FF7A30" stopOpacity="0.65" />
        </RadialGradient>
        <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFF5D6" stopOpacity="1" />
          <Stop offset="0.38" stopColor="#F7B334" stopOpacity="0.85" />
          <Stop offset="0.72" stopColor={colors.orange} stopOpacity="0.3" />
          <Stop offset="1" stopColor={colors.orange} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Outer atmospheric halo when aligned */}
      {aligned && <Circle cx={c} cy={c} r={ring + 10} fill="none" stroke="#F7B334" strokeWidth={2} opacity={0.45} />}

      {/* Dial body */}
      <Circle
        cx={c}
        cy={c}
        r={ring}
        fill="url(#dialFace)"
        stroke={aligned ? '#F7B334' : 'rgba(255, 224, 185, 0.22)'}
        strokeWidth={aligned ? 3 : 1.5}
      />

      {/* Inner precision rings */}
      <Circle cx={c} cy={c} r={ring * 0.68} fill="none" stroke="rgba(255, 224, 185, 0.08)" strokeWidth={1} />
      <Circle cx={c} cy={c} r={ring * 0.34} fill="none" stroke="rgba(255, 224, 185, 0.08)" strokeWidth={1} />

      {/* 72 precision ticks (every 5°) */}
      {Array.from({ length: 72 }, (_, i) => {
        const b = i * 5;
        const cardinal = b % 90 === 0;
        const medium = b % 30 === 0;
        const outer = point(b, ring - 4);
        const inner = point(b, ring - (cardinal ? 16 : medium ? 11 : 7));
        return (
          <Line
            key={b}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke={cardinal ? (b === 0 ? '#FF6B35' : '#FCECD8') : medium ? 'rgba(252, 236, 216, 0.45)' : 'rgba(252, 236, 216, 0.18)'}
            strokeWidth={cardinal ? 2.4 : medium ? 1.5 : 1}
            strokeLinecap="round"
          />
        );
      })}

      {/* Cardinal letters */}
      {CARDINALS.map(({ label, bearing: b }) => {
        const p = point(b, ring - 32);
        return (
          <SvgText
            key={label}
            x={p.x}
            y={p.y + 6}
            fontSize={16}
            fontFamily={fonts.bold}
            fill={b === 0 ? '#FF7842' : '#E8D5C1'}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        );
      })}

      {/* Sunset light cone */}
      <Path d={`M ${c} ${c} L ${beamLeft.x} ${beamLeft.y} A ${ring} ${ring} 0 0 1 ${beamRight.x} ${beamRight.y} Z`} fill="url(#beam)" />

      {/* Glowing sun on the bezel */}
      <Circle cx={sun.x} cy={sun.y} r={34} fill="url(#sunGlow)" />
      <Circle cx={sun.x} cy={sun.y} r={12.5} fill="#FF732E" stroke="#FFF4DC" strokeWidth={2.5} />

      {/* Center pivot */}
      <Circle cx={c} cy={c} r={10} fill="#2B1E17" stroke="rgba(255, 224, 185, 0.4)" strokeWidth={1.5} />
      <Circle cx={c} cy={c} r={4.5} fill="#FFF3E2" />
    </Svg>
  );
});
