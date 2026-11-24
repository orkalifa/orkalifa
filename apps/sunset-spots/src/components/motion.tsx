import { useEffect, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cubicBezier,
  Easing,
  type CSSAnimationProperties,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { motion, staggerDelay } from '../theme';

const enterEasing = Easing.bezier(...motion.ease);
// We decide ourselves what reduced motion drops (movement), so the opacity fade itself always runs.
const NEVER = ReduceMotion.Never;

type EntranceOptions = {
  /** Start slightly smaller and settle to full size. */
  scaleFrom?: number;
  /** On web, also go from a small blur to sharp (native has no text blur without a new dependency). */
  blur?: boolean;
};

const isWeb = Platform.OS === 'web';
const cssEase = cubicBezier(...motion.ease);

/**
 * Web: a real CSS animation, so it runs on the browser's compositor and keeps its stagger even while the
 * page's main thread is busy (decoding map tiles at startup freezes JS-driven timing for ~1 s).
 * It replays when the element remounts, which `Enter`/`Settle` do by keying on the trigger.
 */
function webEntrance(delay: number, scaleFrom: number, blur: boolean, reduced: boolean): CSSAnimationProperties<ViewStyle> {
  if (reduced) {
    return {
      animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
      animationDuration: motion.micro,
      animationFillMode: 'backwards',
    };
  }
  const from: ViewStyle = { opacity: 0, transform: [{ translateY: motion.rise }, { scale: scaleFrom }] };
  const to: ViewStyle = { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] };
  return {
    animationName: blur
      ? { from: { ...from, filter: `blur(${motion.settleBlur}px)` }, to: { ...to, filter: 'blur(0px)' } }
      : { from, to },
    animationDuration: motion.enter,
    animationDelay: delay,
    animationTimingFunction: cssEase,
    animationFillMode: 'backwards',
  };
}

/**
 * Native: fade + short rise (optionally scale) on the UI thread, replayed only when `trigger` changes.
 * With reduced motion it's a quick opacity fade and nothing moves.
 */
function useNativeEntrance(trigger: string | number, delay: number, scaleFrom: number, reduced: boolean) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (isWeb) return;
    progress.value = 0;
    progress.value = reduced
      ? withTiming(1, { duration: motion.micro, reduceMotion: NEVER })
      : withDelay(delay, withTiming(1, { duration: motion.enter, easing: enterEasing, reduceMotion: NEVER }), NEVER);
  }, [trigger, delay, reduced, progress]);

  return useAnimatedStyle(() => {
    const p = progress.value;
    if (reduced) return { opacity: p };
    return { opacity: p, transform: [{ translateY: (1 - p) * motion.rise }, { scale: scaleFrom + (1 - scaleFrom) * p }] };
  });
}


/** A view that plays its entrance on mount and again whenever `trigger` changes. */
export function Settle({
  trigger,
  delay = 0,
  options,
  style,
  children,
}: {
  trigger: string | number;
  delay?: number;
  options?: EntranceOptions;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { scaleFrom = 1, blur = false } = options ?? {};
  const reduced = useReducedMotion();
  const native = useNativeEntrance(trigger, delay, scaleFrom, reduced);
  // On web the CSS animation restarts by remounting; native replays through the effect above.
  if (isWeb) {
    return (
      <Animated.View key={String(trigger)} style={[style, webEntrance(delay, scaleFrom, blur, reduced)]}>
        {children}
      </Animated.View>
    );
  }
  return <Animated.View style={[style, native]}>{children}</Animated.View>;
}

/** One item of a staggered group: enters `index` steps after the first, whenever `trigger` changes. */
export function Enter({
  trigger,
  index = 0,
  style,
  children,
}: {
  trigger: string | number;
  index?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <Settle trigger={trigger} delay={staggerDelay(index)} style={style}>
      {children}
    </Settle>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> };

/** A Pressable that shrinks a touch and dims while held, then eases back. Reduced motion: dims only. */
export function PressableScale({ style, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const reduced = useReducedMotion();
  // Keep the caller's own opacity (e.g. a dimmed "too late" row) and dim relative to it.
  const base = StyleSheet.flatten(style)?.opacity ?? 1;
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const pressIn = (e: GestureResponderEvent) => {
    if (!reduced) scale.value = withTiming(motion.pressScale, { duration: motion.press, reduceMotion: NEVER });
    opacity.value = withTiming(motion.pressOpacity, { duration: motion.micro, reduceMotion: NEVER });
    onPressIn?.(e);
  };
  const pressOut = (e: GestureResponderEvent) => {
    scale.value = withTiming(1, { duration: motion.press, reduceMotion: NEVER });
    opacity.value = withTiming(1, { duration: motion.micro, reduceMotion: NEVER });
    onPressOut?.(e);
  };

  const animated = useAnimatedStyle(() => ({ opacity: base * opacity.value, transform: [{ scale: scale.value }] }));
  return <AnimatedPressable {...rest} onPressIn={pressIn} onPressOut={pressOut} style={[style, animated]} />;
}
