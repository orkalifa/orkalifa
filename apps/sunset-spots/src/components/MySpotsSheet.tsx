import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { distanceMeters, formatDistance, type LatLon } from '../lib/geo';
import type { MySpot } from '../lib/myspots';
import { formatDay, type Visit } from '../lib/visits';
import { colors, fonts } from '../theme';
import { PressableScale } from './motion';
import { ICON_PATHS } from './SpotPin';

type Props = {
  visible: boolean;
  from: LatLon;
  /** False until the phone has a real fix (not last time's location). */
  canSaveHere: boolean;
  spots: MySpot[];
  visits: Visit[];
  onSaveHere: () => void;
  onSaveVisit: (visit: Visit) => void;
  onOpenSpot: (id: string) => void;
  onClearVisits: () => void;
  onClose: () => void;
};

/** Everything about your own places, kept off the main screen: save, open, and sunsets you didn't save. */
export function MySpotsSheet({ visible, from, canSaveHere, spots, visits, onSaveHere, onSaveVisit, onOpenSpot, onClearVisits, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const nearestFirst = [...spots].sort((a, b) => distanceMeters(from, a) - distanceMeters(from, b));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="סגירה" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>המקומות שלי</Text>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Pressable
              onPress={canSaveHere ? onSaveHere : undefined}
              style={({ pressed }) => [styles.primary, !canSaveHere && styles.primaryWaiting, pressed && canSaveHere && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSaveHere }}
            >
              <Text style={styles.primaryText}>{canSaveHere ? '★ לשמור את המקום שאני בו' : 'מחכה למיקום מדויק…'}</Text>
            </Pressable>
            <Text style={styles.tip}>או לחיצה ארוכה על המפה, כדי לשמור כל נקודה אחרת.</Text>

            {nearestFirst.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => onOpenSpot(s.id)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Star />
                <Text style={styles.rowName} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={styles.rowMeta}>{formatDistance(distanceMeters(from, s))}</Text>
              </Pressable>
            ))}

            {visits.length > 0 && (
              <View style={styles.visits}>
                <View style={styles.visitsHeader}>
                  <Text style={styles.sectionTitle}>שקיעות שהיית בהן</Text>
                  <Pressable onPress={onClearVisits} hitSlop={8} accessibilityRole="button" accessibilityLabel="ניקוי השקיעות שהיית בהן">
                    <Text style={styles.clear}>ניקוי</Text>
                  </Pressable>
                </View>
                {visits.map((v) => (
                  <View key={v.at} style={styles.visitRow}>
                    <Text style={styles.visitText} numberOfLines={1}>
                      {`${formatDay(v.at)}${v.place ? ` · ${v.place}` : ''} · ${formatDistance(distanceMeters(from, v))}`}
                    </Text>
                    <Pressable onPress={() => onSaveVisit(v)} style={styles.saveSmall} accessibilityRole="button">
                      <Text style={styles.saveSmallText}>שמירה</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Star() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d={ICON_PATHS.mine} fill={colors.gold} stroke={colors.goldText} strokeWidth={1.2} strokeLinejoin="round" />
    </Svg>
  );
}

/** Round button over the map, next to the compass. */
export function MySpotsButton({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={styles.fab} accessibilityRole="button" accessibilityLabel="המקומות שלי">
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d={ICON_PATHS.mine} fill="none" stroke="#FBD687" strokeWidth={2} strokeLinejoin="round" />
      </Svg>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20, 13, 9, 0.48)' },
  scrim: { flex: 1 },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    gap: 12,
  },
  handle: { alignSelf: 'center', width: 38, height: 4.5, borderRadius: 3, backgroundColor: colors.lineStrong },
  title: { fontFamily: fonts.bold, fontSize: 21, color: colors.ink, textAlign: 'right', paddingHorizontal: 20 },
  body: { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
  primary: { minHeight: 52, borderRadius: 16, backgroundColor: colors.obsidian, alignItems: 'center', justifyContent: 'center' },
  primaryWaiting: { backgroundColor: colors.obsidianSoft, opacity: 0.6 },
  primaryText: { fontFamily: fonts.semibold, fontSize: 16, color: '#FFF7ED' },
  tip: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, textAlign: 'center', marginBottom: 4 },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowName: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, textAlign: 'right' },
  rowMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  visits: { gap: 6, marginTop: 8 },
  visitsHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, textAlign: 'right' },
  clear: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.mutedSoft },
  visitRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, minHeight: 40 },
  visitText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft, textAlign: 'right' },
  saveSmall: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.lineStrong },
  saveSmallText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
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
  pressed: { opacity: 0.85 },
});
