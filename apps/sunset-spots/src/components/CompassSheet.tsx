import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHeading } from '../hooks/useHeading';
import { angleBetween, bearingToHebrew } from '../lib/sun';
import { colors, fonts } from '../theme';
import { SunCompass } from './SunCompass';

const ALIGNED_DEGREES = 8;
// Close to critically damped: glides into each new reading without overshooting, settles in ~0.3 s.
// A spring keeps its speed when the target moves, so a stream of readings becomes one smooth turn.
const SPRING = { mass: 1, stiffness: 160, damping: 24 };

/** Full-screen compass that turns with the phone. The heading sensor only runs while it's open. */
export function CompassSheet({ visible, bearing, onClose }: { visible: boolean; bearing: number; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible && <CompassBody bearing={bearing} onClose={onClose} />}
    </Modal>
  );
}

function CompassBody({ bearing, onClose }: { bearing: number; onClose: () => void }) {
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

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>לאן להסתכל</Text>
      <Text style={styles.subtitle}>{`השקיעה ב${bearingToHebrew(bearing)}`}</Text>
      <View style={styles.compass}>
        <SunCompass bearing={bearing} rotation={rotation} live={live} aligned={aligned} size={320} />
      </View>
      <Text style={[styles.hint, aligned && styles.hintAligned]}>
        {!live
          ? 'המצפן פועל בטלפון. כאן הוא מוצג כשהצפון למעלה.'
          : aligned
            ? 'הטלפון מכוון בדיוק לכיוון השקיעה'
            : 'סובבו את הטלפון עד שהשמש תגיע לסימן שלמעלה'}
      </Text>
      <Pressable onPress={onClose} style={styles.close} accessibilityRole="button">
        <Text style={styles.closeText}>חזרה למפה</Text>
      </Pressable>
    </SafeAreaView>
  );
}

/** Round floating button with a compass needle, for the map. */
export function CompassButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.fab} accessibilityRole="button" accessibilityLabel="פתיחת המצפן" hitSlop={8}>
      <Svg width={30} height={30} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={10} fill="none" stroke={colors.ink} strokeWidth={2} />
        <Path d="M12 5l3 7h-6z" fill={colors.orange} />
        <Path d="M12 19l-3-7h6z" fill={colors.inkSoft} />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.ink },
  subtitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  compass: { alignItems: 'center' },
  hint: { fontFamily: fonts.medium, fontSize: 16, color: colors.inkSoft, textAlign: 'center' },
  hintAligned: { color: colors.orangeText, fontFamily: fonts.bold },
  close: { minHeight: 48, paddingHorizontal: 28, justifyContent: 'center', backgroundColor: colors.ink, borderRadius: 16, marginTop: 8 },
  closeText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ground },
  fab: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 28,
    shadowColor: colors.orangeText,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
