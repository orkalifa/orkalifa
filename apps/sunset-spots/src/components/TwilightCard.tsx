import { memo, useEffect, useState } from 'react';
import { I18nManager, Image, StyleSheet, Text, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type CSSAnimationProperties,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { formatClock } from '../lib/sun';
import { colors, fonts, hairline, motion } from '../theme';
import { PressableScale } from './motion';
import {
  DAY_INK,
  GRAIN_BOX,
  HORIZON_Y,
  NIGHT_INK,
  PALETTE,
  SKY_VEIL_MAX,
  SUN_R,
  SUN_TOP_Y,
  VIEW_H,
  VIEW_W,
  X_DARK,
  X_START,
  alignToSide,
  computeScene,
  grainOpacity,
  physicalLeft,
  physicalRight,
  rayPaths,
  type LayoutDir,
} from './twilightScene';

type Props = {
  now: Date;
  /** Start of the evening: golden hour, sun at +6°. Shown on the right. */
  start: Date;
  sunset: Date;
  /** Darkness: civil dusk, sun at -6°. Shown on the left. */
  dark: Date;
  isTomorrow: boolean;
  /** Opens the sunset reminder sheet; no bell without it. */
  onRemind?: () => void;
};

// Greyscale grain, 1024x240 (the sky's aspect), from assets/drafts/textures/wave-01.png (see U11a commit).
const GRAIN = require('../../assets/images/grain-wave.jpg');
const RAYS = rayPaths();
const MINUTE = 60_000;
const MARKER = 22;
const NEVER = ReduceMotion.Never;
const slideEasing = Easing.bezier(...motion.ease);

/** The now-marker's soft glow breathes on the UI thread (a CSS animation: no JS per frame). */
const BREATHE: CSSAnimationProperties<ViewStyle> = {
  animationName: {
    from: { opacity: 0.18, transform: [{ scale: 0.7 }] },
    to: { opacity: 0.5, transform: [{ scale: 0.95 }] },
  },
  animationDuration: 2800,
  animationIterationCount: 'infinite',
  animationDirection: 'alternate',
  animationTimingFunction: 'ease-in-out',
};

/**
 * Tonight's evening as a tiny sunset horizon: the horizon line is the timeline, running right
 * (start of the sunset) to left (darkness). The hero sun sets exactly at the thin sunset tick, a
 * small sun marker slides along the line at the current time, and the sky darkens until the first
 * stars. One SVG, redrawn once a minute; the marker's slide is one reanimated shared value.
 */
export function TwilightCard({ now, start, sunset, dark, isTomorrow, onRemind }: Props) {
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();
  // The SVG is always drawn left-to-right; overlays use these to land on the same physical side.
  const dir: LayoutDir = {
    isRTL: I18nManager.isRTL,
    swapsLeftRight: I18nManager.doLeftAndRightSwapInRTL ?? true,
  };

  const minute = Math.floor(now.getTime() / MINUTE) * MINUTE;
  const scene = computeScene(minute, start.getTime(), sunset.getTime(), dark.getTime(), isTomorrow);
  const k = (width || VIEW_W) / VIEW_W;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = reduced ? scene.p : withTiming(scene.p, { duration: 900, easing: slideEasing, reduceMotion: NEVER });
  }, [scene.p, reduced, progress]);
  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (X_START - progress.value * (X_START - X_DARK)) * k - MARKER / 2 }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };

  const startClock = formatClock(start);
  const sunsetClock = formatClock(sunset);
  const darkClock = formatClock(dark);
  const captionCenter = Math.min(Math.max(scene.sunsetX, 110), 248) * k;
  const ink = scene.night ? NIGHT_INK : DAY_INK;

  return (
    <View style={styles.card} onLayout={onLayout}>
      <View
        style={StyleSheet.absoluteFill}
        accessible
        accessibilityLabel={`תחילת השקיעה ${startClock}, שקיעה ${sunsetClock}, חושך ${darkClock}${isTomorrow ? ', הזמנים של מחר' : ''}`}
      >
        <TwilightScene
          minute={minute}
          start={start.getTime()}
          sunset={sunset.getTime()}
          dark={dark.getTime()}
          isTomorrow={isTomorrow}
        />

        {/* Grain over the sky only: it never sits under any text. */}
        <Image
          source={GRAIN}
          resizeMode="cover"
          accessible={false}
          pointerEvents="none"
          style={[
            styles.grain,
            { top: GRAIN_BOX.top * k, height: (GRAIN_BOX.bottom - GRAIN_BOX.top) * k, opacity: grainOpacity(scene.dusk) },
          ]}
        />

        {!isTomorrow && (
          <Animated.View
            pointerEvents="none"
            style={[styles.marker, { top: HORIZON_Y * k - MARKER / 2 }, physicalLeft(0, dir), markerStyle]}
          >
            <Animated.View style={[styles.markerGlow, reduced ? styles.markerGlowStill : BREATHE]} />
            <Svg width={MARKER} height={MARKER} viewBox="0 0 22 22">
              <Path d="M5 11 A6 6 0 0 1 17 11 Z" fill={PALETTE.marker} stroke={PALETTE.markerEdge} strokeWidth={1.2} strokeLinejoin="round" />
              <Path d="M11 2.6v1.8M5 5l1.2 1.2M17 5l-1.2 1.2" stroke={PALETTE.marker} strokeWidth={1.3} strokeLinecap="round" />
            </Svg>
          </Animated.View>
        )}

        {/* Two-tone: the label in the second tone, the time in the first. */}
        <View pointerEvents="none" style={[styles.caption, { top: (HORIZON_Y + 5) * k, width: 96, ...physicalLeft(captionCenter - 48, dir) }]}>
          <Text selectable={false} style={[styles.captionText, { color: ink.soft }]}>
            {'שקיעה '}
            <Text style={[styles.captionTime, { color: ink.time }]}>{sunsetClock}</Text>
          </Text>
        </View>

        <View pointerEvents="none" style={[styles.end, physicalRight(16, dir), { alignItems: alignToSide('right', dir) }]}>
          <Text selectable={false} style={[styles.endLabel, { color: ink.soft }]}>תחילת השקיעה</Text>
          <Text selectable={false} style={[styles.endTime, styles.startTime, { color: ink.time }]}>{startClock}</Text>
        </View>
        <View pointerEvents="none" style={[styles.end, physicalLeft(16, dir), { alignItems: alignToSide('left', dir) }]}>
          <Text selectable={false} style={[styles.endLabel, { color: ink.soft }]}>חושך</Text>
          <Text selectable={false} style={[styles.endTime, styles.darkTime, { color: ink.time }]}>{darkClock}</Text>
        </View>

        {isTomorrow && (
          <View pointerEvents="none" style={[styles.tomorrow, physicalRight(12, dir)]}>
            <Text selectable={false} style={styles.tomorrowText}>הזמנים של מחר</Text>
          </View>
        )}
      </View>

      {onRemind && <BellButton onPress={onRemind} dir={dir} />}
    </View>
  );
}

type SceneProps = { minute: number; start: number; sunset: number; dark: number; isTomorrow: boolean };

/** The drawing itself. Memoized on plain numbers, so it only re-renders when the minute changes. */
const TwilightScene = memo(function TwilightScene({ minute, start, sunset, dark, isTomorrow }: SceneProps) {
  const s = computeScene(minute, start, sunset, dark, isTomorrow);
  const sunGlowY = Math.min(s.sunY, HORIZON_Y - 6);
  const hasElapsed = X_START - s.x > 1.5;

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid slice">
      <Defs>
        {/* Sky: honey where the evening starts (right) to apricot-rose toward darkness (left). */}
        <LinearGradient id="twSkyH" x1="1" y1="0" x2="0" y2="0">
          <Stop offset="0" stopColor={PALETTE.skyStart} />
          <Stop offset="0.45" stopColor={PALETTE.skyMid} />
          <Stop offset="1" stopColor={PALETTE.skyEnd} />
        </LinearGradient>
        <LinearGradient id="twSkyV" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={PALETTE.skyLow} stopOpacity={0} />
          <Stop offset="1" stopColor={PALETTE.skyLow} stopOpacity={0.55} />
        </LinearGradient>
        {/* Dusk: warm plum-umber, darkest top-left (where the evening ends). Never blue. */}
        <LinearGradient id="twDusk" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={PALETTE.duskTop} />
          <Stop offset="0.55" stopColor={PALETTE.duskMid} stopOpacity={0.9} />
          <Stop offset="1" stopColor={PALETTE.duskLow} stopOpacity={0.6} />
        </LinearGradient>
        <RadialGradient id="twBloom" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={PALETTE.markerGlow} stopOpacity={0.6} />
          <Stop offset="1" stopColor={PALETTE.markerGlow} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="twEmber" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={PALETTE.ember} stopOpacity={0.85} />
          <Stop offset="1" stopColor={PALETTE.ember} stopOpacity={0} />
        </RadialGradient>
        {/* Soft aura instead of a CSS blur (filters aren't reliable on native): opacity falloff. */}
        <RadialGradient id="twEmberCore" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={PALETTE.emberCore} stopOpacity={0.9} />
          <Stop offset="1" stopColor={PALETTE.ember} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="twAura" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={PALETTE.aura} stopOpacity={0.55} />
          <Stop offset="0.45" stopColor={PALETTE.sunAmber} stopOpacity={0.22} />
          <Stop offset="1" stopColor={PALETTE.auraEdge} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="twDisc" cx="38%" cy="32%" r="72%">
          <Stop offset="0" stopColor={PALETTE.sunCore} />
          <Stop offset="0.42" stopColor={PALETTE.sunGold} />
          <Stop offset="0.78" stopColor={PALETTE.sunAmber} />
          <Stop offset="1" stopColor={PALETTE.sunRim} />
        </RadialGradient>
        <RadialGradient id="twDiscLate" cx="40%" cy="34%" r="72%">
          <Stop offset="0" stopColor={PALETTE.sunLateCore} />
          <Stop offset="0.55" stopColor={PALETTE.sunLateMid} />
          <Stop offset="1" stopColor={PALETTE.sunLateRim} />
        </RadialGradient>
        <LinearGradient id="twCloud" x1="0.2" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor={PALETTE.cloudLight} />
          <Stop offset="1" stopColor={PALETTE.cloudBelly} />
        </LinearGradient>
        <LinearGradient id="twWater" x1="1" y1="0" x2="0" y2="0">
          <Stop offset="0" stopColor={PALETTE.waterStart} />
          <Stop offset="0.5" stopColor={PALETTE.waterMid} />
          <Stop offset="1" stopColor={PALETTE.waterEnd} />
        </LinearGradient>
        <RadialGradient id="twGlint" cx="50%" cy="0%" r="70%">
          <Stop offset="0" stopColor={PALETTE.glint} stopOpacity={0.8} />
          <Stop offset="1" stopColor={PALETTE.glint} stopOpacity={0} />
        </RadialGradient>
        {/* Soft ends instead of a mask: the line's own gradient fades out at both edges. User-space
            units: a horizontal line has a zero-height bounding box, which would hide a bbox gradient. */}
        <LinearGradient id="twHorizon" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={VIEW_W} y2={0}>
          <Stop offset="0" stopColor={PALETTE.horizon} stopOpacity={0} />
          <Stop offset="0.08" stopColor={PALETTE.horizon} stopOpacity={0.6} />
          <Stop offset="0.92" stopColor={PALETTE.horizon} stopOpacity={0.6} />
          <Stop offset="1" stopColor={PALETTE.horizon} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="twElapsed" gradientUnits="userSpaceOnUse" x1={X_START} y1={0} x2={X_DARK} y2={0}>
          <Stop offset="0" stopColor={PALETTE.elapsedStart} />
          <Stop offset="1" stopColor={PALETTE.elapsedEnd} />
        </LinearGradient>
        <ClipPath id="twSkyClip">
          <Rect x={0} y={0} width={VIEW_W} height={HORIZON_Y} />
        </ClipPath>
        <ClipPath id="twWaterClip">
          <Rect x={0} y={HORIZON_Y} width={VIEW_W} height={VIEW_H - HORIZON_Y} />
        </ClipPath>
      </Defs>

      {/* Sky, then the dusk veil that deepens with the evening. */}
      <Rect x={0} y={0} width={VIEW_W} height={HORIZON_Y} fill="url(#twSkyH)" />
      <Rect x={0} y={0} width={VIEW_W} height={HORIZON_Y} fill="url(#twSkyV)" />
      <Ellipse cx={s.sunsetX} cy={sunGlowY} rx={110} ry={58} fill="url(#twBloom)" opacity={1 - 0.75 * s.dusk} />
      <Rect x={0} y={0} width={VIEW_W} height={HORIZON_Y} fill="url(#twDusk)" opacity={SKY_VEIL_MAX * s.dusk} />

      {/* The first stars, over the darkness end. */}
      {s.stars > 0 && (
        <G opacity={s.stars} fill={PALETTE.star}>
          <Path d="M74 16 l1.5 3.8 3.8 1.5 -3.8 1.5 -1.5 3.8 -1.5 -3.8 -3.8 -1.5 3.8 -1.5z" />
          <Path d="M108 38 l1 2.5 2.5 1 -2.5 1 -1 2.5 -1 -2.5 -2.5 -1 2.5 -1z" />
          <Path d="M232 20 l.9 2.2 2.2 .9 -2.2 .9 -.9 2.2 -.9 -2.2 -2.2 -.9 2.2 -.9z" />
          <Circle cx={128} cy={13} r={1.3} />
          <Circle cx={58} cy={48} r={1.1} />
          <Circle cx={196} cy={10} r={1} />
          <Circle cx={292} cy={30} r={1.1} />
          <Circle cx={262} cy={52} r={0.9} />
        </G>
      )}

      <G clipPath="url(#twSkyClip)">
        {/* Horizon glow at the sunset point; after sunset it is the afterglow, fading toward dark. */}
        <Ellipse cx={s.sunsetX} cy={HORIZON_Y} rx={130} ry={24} fill="url(#twEmber)" opacity={s.ember} />
        <Ellipse cx={s.sunsetX} cy={HORIZON_Y} rx={84} ry={13} fill="url(#twEmberCore)" opacity={s.ember} />

        {/* Back cloud, behind the sun's upper-right shoulder. */}
        <G transform={`translate(${s.sunsetX + 2} ${SUN_TOP_Y + 9}) scale(1.35)`} opacity={0.88 - 0.3 * s.dusk}>
          <Path d={CLOUD_BACK} fill="url(#twCloud)" />
          <Path d={CLOUD_BACK} fill={PALETTE.cloudDusk} opacity={0.8 * s.dusk} />
        </G>

        {/* The hero sun: aura, tapered rays, disc (gold, deepening to red), a lit crescent. */}
        <G transform={`translate(${s.sunsetX} ${s.sunY})`}>
          <Circle r={42} fill="url(#twAura)" opacity={1 - 0.6 * s.dusk} />
          <G opacity={s.rays}>
            {RAYS.map((ray, i) => (
              <Path key={i} d={ray.d} fill={ray.long ? PALETTE.rayLong : PALETTE.rayShort} fillOpacity={ray.long ? 0.88 : 0.8} />
            ))}
          </G>
          <Circle r={SUN_R} fill="url(#twDisc)" />
          <Circle r={SUN_R} fill="url(#twDiscLate)" opacity={s.late} />
          <Circle r={SUN_R * 0.72} fill={PALETTE.sunCore} opacity={0.16} />
          <Path d="M-9.4 -7.6 A12.4 12.4 0 0 1 8.4 -8.9" fill="none" stroke={PALETTE.star} strokeOpacity={0.62} strokeWidth={1.1} strokeLinecap="round" />
          <Circle r={SUN_R} fill="none" stroke={PALETTE.sunLateRim} strokeOpacity={0.24} strokeWidth={0.7} />
        </G>

        {/* Front cloud: the sun slips behind it on the way down. A shifted copy is its shadow. */}
        <G transform={`translate(${s.sunsetX - 2} ${HORIZON_Y - 41}) scale(1.35)`}>
          <Path d={CLOUD_FRONT} fill={PALETTE.cloudShadow} opacity={0.12} transform="translate(0 1.8)" />
          <Path d={CLOUD_FRONT} fill="url(#twCloud)" />
          <Path d={CLOUD_FRONT} fill={PALETTE.cloudDusk} opacity={0.85 * s.dusk} />
          <Path d="M-6.4 8.2 C-3.8 6.4 0.1 6.6 2.4 8.9" fill="none" stroke={PALETTE.star} strokeOpacity={0.72 * (1 - s.dusk)} strokeWidth={1} strokeLinecap="round" />
        </G>
      </G>

      {/* Water, with the sun's reflection under the sunset point. */}
      <Rect x={0} y={HORIZON_Y} width={VIEW_W} height={VIEW_H - HORIZON_Y} fill="url(#twWater)" />
      <G stroke={PALETTE.cloudLight} strokeLinecap="round" fill="none">
        <Line x1={16} y1={HORIZON_Y + 5.5} x2={342} y2={HORIZON_Y + 5.5} strokeWidth={0.8} strokeOpacity={0.4} strokeDasharray={[24, 14, 8, 18, 32, 14]} />
        <Line x1={24} y1={HORIZON_Y + 12.5} x2={334} y2={HORIZON_Y + 12.5} strokeWidth={0.75} strokeOpacity={0.26} strokeDasharray={[14, 22, 28, 12, 10, 24]} strokeDashoffset={9} />
      </G>
      <G clipPath="url(#twWaterClip)" opacity={s.reflection}>
        <Ellipse cx={s.sunsetX} cy={HORIZON_Y + 1} rx={34} ry={9} fill="url(#twGlint)" />
        <G stroke={PALETTE.glint} strokeLinecap="round">
          <Line x1={s.sunsetX - 11} y1={HORIZON_Y + 3.5} x2={s.sunsetX + 11} y2={HORIZON_Y + 3.5} strokeWidth={1.6} />
          <Line x1={s.sunsetX - 7} y1={HORIZON_Y + 7.5} x2={s.sunsetX + 7.5} y2={HORIZON_Y + 7.5} strokeWidth={1.3} />
          <Line x1={s.sunsetX - 4} y1={HORIZON_Y + 11.5} x2={s.sunsetX + 3.5} y2={HORIZON_Y + 11.5} strokeWidth={1} />
        </G>
      </G>
      <Rect x={0} y={HORIZON_Y} width={VIEW_W} height={VIEW_H - HORIZON_Y} fill={PALETTE.waterVeil} opacity={s.waterVeil} />

      {/* The horizon is the timeline: a hairline, the lit stretch already passed, the end ticks. */}
      <Line x1={0} y1={HORIZON_Y} x2={VIEW_W} y2={HORIZON_Y} stroke="url(#twHorizon)" strokeWidth={0.75} />
      {hasElapsed && (
        <Line x1={X_START} y1={HORIZON_Y} x2={s.x} y2={HORIZON_Y} stroke="url(#twElapsed)" strokeWidth={1.4} strokeLinecap="round" />
      )}
      <Line x1={X_START} y1={HORIZON_Y - 2.5} x2={X_START} y2={HORIZON_Y + 2.5} stroke={PALETTE.textSoft} strokeOpacity={0.45} strokeWidth={0.75} strokeLinecap="round" />
      <Line x1={X_DARK} y1={HORIZON_Y - 2.5} x2={X_DARK} y2={HORIZON_Y + 2.5} stroke={PALETTE.textSoft} strokeOpacity={0.45} strokeWidth={0.75} strokeLinecap="round" />
      {/* The exact sunset moment: one thin tick. */}
      <Line x1={s.sunsetX} y1={HORIZON_Y - 6} x2={s.sunsetX} y2={HORIZON_Y + 6} stroke={PALETTE.tick} strokeOpacity={0.7} strokeWidth={1.1} strokeLinecap="round" />
    </Svg>
  );
});

// Cloud outlines in local units (from the chosen prototype), placed relative to the sunset point.
const CLOUD_BACK =
  'M10 -6.5 L27.5 -6.5 C31 -6.5 33.2 -8.7 33.2 -11.2 C33.2 -13.6 31.1 -15.5 28.5 -15.4 C27.5 -18.5 24.4 -20.4 20.9 -19.9 C18.2 -19.5 16.2 -17.6 15.5 -15.2 C14.3 -15.6 12.8 -15.4 11.6 -14.6 C9.2 -14.4 7.4 -12.6 7.4 -10.3 C7.4 -8.1 8.5 -6.5 10 -6.5 Z';
const CLOUD_FRONT =
  'M-26.4 19.8 L3.8 19.8 C7.2 19.8 9.4 17.6 9.4 15 C9.4 12.5 7.3 10.6 4.7 10.7 C3.6 7.5 0.4 5.7 -3.1 6.2 C-5.8 6.6 -7.9 8.4 -8.7 10.8 C-10.2 10.1 -12.1 10 -13.7 10.8 C-15.6 9.1 -18.5 9 -20.6 10.7 C-21.9 11.7 -22.6 13 -22.9 14.3 C-26 14.5 -28.6 16.2 -28.6 18 C-28.6 19.1 -27.6 19.8 -26.4 19.8 Z';

/**
 * Small bell, no text: opens the reminder sheet. Inside the card's top-left corner (the card clips
 * its rounded scene, so it can't overhang any more). 44 px touch target.
 */
function BellButton({ onPress, dir }: { onPress: () => void; dir: LayoutDir }) {
  return (
    <PressableScale onPress={onPress} style={[styles.bell, physicalLeft(4, dir)]} accessibilityRole="button" accessibilityLabel="תזכורת לשקיעה">
      <View style={styles.bellDot}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16zM10 20.5a2 2 0 0 0 4 0"
            stroke={colors.goldText}
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: VIEW_W / VIEW_H,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: PALETTE.skyMid,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hairline.color,
  },
  grain: { position: 'absolute', left: 0, right: 0, width: '100%' },
  marker: { position: 'absolute', width: MARKER, height: MARKER, alignItems: 'center', justifyContent: 'center' },
  markerGlow: {
    position: 'absolute',
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    backgroundColor: PALETTE.markerGlow,
  },
  markerGlowStill: { opacity: 0.35, transform: [{ scale: 0.85 }] },
  caption: { position: 'absolute', alignItems: 'center' },
  // Labels have no background and can't be selected (a web drag-select painted them blue).
  captionText: { fontFamily: fonts.medium, fontSize: 11, userSelect: 'none' },
  captionTime: { fontFamily: fonts.semibold, fontVariant: ['tabular-nums'] },
  end: { position: 'absolute', bottom: 9, gap: 1 },
  endLabel: { fontFamily: fonts.medium, fontSize: 11, userSelect: 'none' },
  endTime: { fontSize: 23, letterSpacing: -0.4, fontVariant: ['tabular-nums'], userSelect: 'none' },
  startTime: { fontFamily: fonts.semibold },
  darkTime: { fontFamily: fonts.regular },
  tomorrow: {
    position: 'absolute',
    top: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 248, 236, 0.78)',
  },
  tomorrowText: { fontFamily: fonts.medium, fontSize: 11, color: PALETTE.textSoft, userSelect: 'none' },
  bell: { position: 'absolute', top: 2, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bellDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 248, 236, 0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hairline.color,
  },
});
