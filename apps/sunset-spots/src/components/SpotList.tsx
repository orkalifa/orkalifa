import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDistance } from '../lib/geo';
import type { SpotKind } from '../lib/osm';
import type { ScoredSpot } from '../lib/score';
import { colors, fonts } from '../theme';

const KIND_LABEL: Record<SpotKind, string> = {
  viewpoint: 'נקודת תצפית',
  peak: 'פסגה',
  picnic: 'פינת פיקניק',
  bench: 'ספסל',
  shelter: 'סככה',
};

export const BALANCE_OPTIONS = [
  { key: 'comfort', label: 'נוחות', weight: 0.15 },
  { key: 'balanced', label: 'מאוזן', weight: 0.4 },
  { key: 'view', label: 'נוף', weight: 0.8 },
] as const;

export type BalanceKey = (typeof BALANCE_OPTIONS)[number]['key'];

function openWaze(spot: ScoredSpot) {
  Linking.openURL(`https://waze.com/ul?ll=${spot.lat},${spot.lon}&navigate=yes`);
}

export function BalancePicker({ value, onChange }: { value: BalanceKey; onChange: (k: BalanceKey) => void }) {
  return (
    <View style={styles.segments} accessibilityRole="radiogroup" accessibilityLabel="מה חשוב לך הערב?">
      {BALANCE_OPTIONS.map((o) => {
        const selected = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SpotList({ spots }: { spots: ScoredSpot[] }) {
  if (spots.length === 0) {
    return <Text style={styles.empty}>{'לא נמצאו מקומות מסומנים בטווח של 10 ק"מ.'}</Text>;
  }
  return (
    <View style={styles.list}>
      {spots.map((spot, i) => (
        <View key={spot.id} style={[styles.row, i === 0 && styles.rowTop]}>
          <View style={[styles.rank, i === 0 && styles.rankTop]}>
            <Text style={[styles.rankText, i === 0 && styles.rankTextTop]}>{i + 1}</Text>
          </View>
          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1}>
              {spot.name ?? KIND_LABEL[spot.kind]}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {[formatDistance(spot.distance), ...spot.reasons].join(' · ')}
            </Text>
          </View>
          <Text style={styles.score} accessibilityLabel={`ציון ${spot.score}`}>
            {spot.score}
          </Text>
          <Pressable onPress={() => openWaze(spot)} style={styles.waze} accessibilityRole="link" accessibilityLabel={`ניווט ב־Waze אל ${spot.name ?? KIND_LABEL[spot.kind]}`}>
            <Text style={styles.wazeText}>Waze</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row-reverse', backgroundColor: colors.sand, borderRadius: 16, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segmentSelected: { backgroundColor: colors.ink },
  segmentText: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkSoft },
  segmentTextSelected: { color: colors.ground },
  list: { gap: 8 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, backgroundColor: colors.surface },
  rowTop: { backgroundColor: '#FDEBDA' },
  rank: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center' },
  rankTop: { backgroundColor: colors.orange },
  rankText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  rankTextTop: { color: colors.white },
  body: { flex: 1, gap: 2, alignItems: 'flex-end' },
  name: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, textAlign: 'right' },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'right' },
  score: { fontFamily: fonts.bold, fontSize: 20, color: colors.orangeText, minWidth: 30, textAlign: 'center' },
  waze: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, justifyContent: 'center' },
  wazeText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center' },
});
