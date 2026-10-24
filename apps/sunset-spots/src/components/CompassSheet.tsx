import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHeading } from '../hooks/useHeading';
import { angleBetween, bearingToHebrew } from '../lib/sun';
import { colors, fonts } from '../theme';
import { SunCompass } from './SunCompass';

const ALIGNED_DEGREES = 8;

/** Full-screen compass that turns with the phone. The heading sensor only runs while it's open. */
export function CompassSheet({ visible, bearing, onClose }: { visible: boolean; bearing: number; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible && <CompassBody bearing={bearing} onClose={onClose} />}
    </Modal>
  );
}

function CompassBody({ bearing, onClose }: { bearing: number; onClose: () => void }) {
  const heading = useHeading(Platform.OS !== 'web');
  const offset = heading === null ? null : angleBetween(heading, bearing);
  const aligned = offset !== null && Math.abs(offset) <= ALIGNED_DEGREES;

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>לאן להסתכל</Text>
      <Text style={styles.subtitle}>
        {`השקיעה ב${bearingToHebrew(bearing)} · ${Math.round(bearing)}° מהצפון`}
      </Text>
      <View style={styles.compass}>
        <SunCompass bearing={bearing} heading={heading} aligned={aligned} size={320} />
      </View>
      <Text style={[styles.hint, aligned && styles.hintAligned]}>
        {heading === null
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
    <Pressable onPress={onPress} style={styles.fab} accessibilityRole="button" accessibilityLabel="פתיחת המצפן">
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={10} fill="none" stroke={colors.ink} strokeWidth={2} />
        <Path d="M12 5l3 7h-6z" fill={colors.orange} />
        <Path d="M12 19l-3-7h6z" fill={colors.inkSoft} />
      </Svg>
      <Text style={styles.fabText}>מצפן</Text>
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
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: 24,
    shadowColor: colors.orangeText,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});
