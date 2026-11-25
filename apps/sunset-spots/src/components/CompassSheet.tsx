import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SheetModal } from './SheetModal';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHeading } from '../hooks/useHeading';
import { angleBetween, bearingToHebrew } from '../lib/sun';
import { colors, fonts } from '../theme';
import { PressableScale } from './motion';
import { SunCompass } from './SunCompass';

const ALIGNED_DEGREES = 8;
// Close to critically damped: glides into each new reading without overshooting, settles in ~0.3 s.
// A spring keeps its speed when the target moves, so a stream of readings becomes one smooth turn.
const SPRING = { mass: 1, stiffness: 160, damping: 24 };

/** Full-screen twilight compass that turns with the phone. The heading sensor only runs while it's open. */
export function CompassSheet({
  visible,
  bearing,
  sunsetClock,
  onClose,
}: {
  visible: boolean;
  bearing: number;
  sunsetClock?: string;
  onClose: () => void;
}) {
  return (
    <SheetModal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible && <CompassBody bearing={bearing} sunsetClock={sunsetClock} onClose={onClose} />}
    </SheetModal>
  );
}

function CompassBody({ bearing, sunsetClock, onClose }: { bearing: number; sunsetClock?: string; onClose: () => void }) {
  const rotation = useSharedValue(0);
  // Unwrapped heading (can pass 360) so 359° → 1° turns 2°, not all the way round.
  const turned = useRef(0);
  const [live, setLive] = useState(false);
  const [aligned, setAligned] = useState(false);

  useHeading(Platform.OS !== 'web', (heading) => {
    turned.current += ((((heading - turned.current) % 360) + 540) % 360) - 180;
    rotation.set(withSpring(-turned.current, SPRING));
    // Same value → React skips the render, so this only re-renders when these flip.
    setLive(true);
    setAligned(Math.abs(angleBetween(heading, bearing)) <= ALIGNED_DEGREES);
  });

  const direction = bearingToHebrew(bearing);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} style={styles.closeIconBtn} accessibilityRole="button" accessibilityLabel="חזרה למפה" hitSlop={8}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M6 6l12 12M18 6L6 18" stroke="#FFF4E6" strokeWidth={2.4} strokeLinecap="round" />
          </Svg>
        </Pressable>

        <View style={styles.metaPill}>
          <View style={styles.metaDot} />
          <Text style={styles.metaText}>{sunsetClock ? `שקיעה ב־${sunsetClock} · ${direction}` : `השקיעה ב${direction}`}</Text>
        </View>
      </View>

      <View style={styles.center}>
        <Text style={styles.title}>לאן להסתכל</Text>
        <Text style={styles.subtitle}>{`השמש תרד לכיוון ${direction} (${Math.round(bearing)}°)`}</Text>

        <View style={styles.compass}>
          <SunCompass bearing={bearing} rotation={rotation} live={live} aligned={aligned} size={316} />
        </View>

        <View style={[styles.hintPill, aligned && styles.hintPillAligned]}>
          <Text style={[styles.hint, aligned && styles.hintAligned]}>
            {!live
              ? 'המצפן פועל בטלפון · כאן הוא מוצג כשהצפון למעלה'
              : aligned
                ? 'בול לכיוון השקיעה!'
                : 'סובבו את הטלפון עד שהשמש תגיע לסימן שלמעלה'}
          </Text>
        </View>
      </View>

      <Pressable onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]} accessibilityRole="button">
        <Text style={styles.closeText}>חזרה למפה</Text>
      </Pressable>
    </SafeAreaView>
  );
}

/** Dark-espresso floating compass button, matching the top HUD chrome. */
export function CompassButton({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      style={styles.fab}
      accessibilityRole="button"
      accessibilityLabel="פתיחת המצפן"
      hitSlop={8}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={9.5} fill="none" stroke="rgba(255, 236, 212, 0.72)" strokeWidth={1.8} />
        <Path d="M12 5l3 7h-6z" fill="#FF7736" />
        <Path d="M12 19l-3-7h6z" fill="#EEDAC4" />
      </Svg>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#150E0B',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 234, 209, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 234, 209, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 234, 209, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 234, 209, 0.14)',
  },
  metaDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F7A934' },
  metaText: { fontFamily: fonts.medium, fontSize: 13, color: '#FBEBD6' },
  center: { alignItems: 'center', gap: 10 },
  title: { fontFamily: fonts.bold, fontSize: 28, color: '#FFF7ED' },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: '#BFA795', textAlign: 'center' },
  compass: { alignItems: 'center', marginVertical: 14 },
  hintPill: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 234, 209, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 234, 209, 0.14)',
  },
  hintPillAligned: {
    backgroundColor: 'rgba(247, 179, 52, 0.2)',
    borderColor: '#F7B334',
  },
  hint: { fontFamily: fonts.medium, fontSize: 14, color: '#EAD5C0', textAlign: 'center' },
  hintAligned: { color: '#FFE099', fontFamily: fonts.bold },
  close: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 234, 209, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 234, 209, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontFamily: fonts.semibold, fontSize: 15, color: '#FFF6EB' },
  fab: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.obsidian,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 224, 185, 0.22)',
    shadowColor: '#1A120E',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});
