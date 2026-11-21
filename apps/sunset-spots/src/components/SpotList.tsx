import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { formatDistance } from '../lib/geo';
import type { SpotKind } from '../lib/osm';
import type { ScoredSpot } from '../lib/score';
import { travelMinutes, type ShownSpot } from '../lib/travel';
import { colors, fonts } from '../theme';
import { SpotPin } from './SpotPin';

const KIND_LABEL: Record<SpotKind, string> = {
  viewpoint: 'נקודת תצפית',
  peak: 'פסגה',
  picnic: 'פינת פיקניק',
  bench: 'ספסל',
  shelter: 'סככה',
};

function openWaze(spot: ScoredSpot) {
  Linking.openURL(`https://waze.com/ul?ll=${spot.lat},${spot.lon}&navigate=yes`);
}

function reachLabel(spot: ShownSpot, driveMin: number, now?: Date, goldenHour?: Date): string {
  if (!spot.reach.inTime) return 'לא מספיקים היום';
  if (now && goldenHour && now.getTime() + driveMin * 60000 <= goldenHour.getTime()) {
    return `מגיעים לשעת הזהב · כ־${driveMin} דק'`;
  }
  return `מגיעים לשקיעה · כ־${driveMin} דק'`;
}

export function SpotList({
  spots,
  selectedId = null,
  onSelectSpot,
  now,
  goldenHour,
}: {
  spots: ShownSpot[];
  selectedId?: string | null;
  onSelectSpot?: (spot: ShownSpot) => void;
  now?: Date;
  goldenHour?: Date;
}) {
  if (spots.length === 0) {
    return <Text style={styles.empty}>{'לא נמצאו מקומות מסומנים בטווח של 10 ק"מ.'}</Text>;
  }

  const [best, ...rest] = spots;
  const bestDrive = Math.max(1, Math.round(travelMinutes(best.distance, 'car')));
  const bestTitle = best.name ?? KIND_LABEL[best.kind];

  return (
    <View style={styles.list}>
      {/* #1 Featured Hero Pick */}
      <Pressable
        onPress={() => onSelectSpot?.(best)}
        style={({ pressed }) => [
          styles.heroCard,
          selectedId === best.id && styles.cardSelected,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`המקום המומלץ: ${bestTitle}, ציון ${best.score}`}
      >
        <View style={styles.heroTopStrip}>
          <View style={styles.topPickPill}>
            <Text style={styles.topPickText}>★ הבחירה להערב</Text>
          </View>
          <View style={styles.reachPill}>
            <View style={[styles.reachDot, { backgroundColor: best.reach.color }]} />
            <Text style={styles.reachText}>{reachLabel(best, bestDrive, now, goldenHour)}</Text>
          </View>
        </View>

        <View style={styles.heroMain}>
          <SpotPin kind={best.kind} color={best.reach.color} opacity={best.reach.opacity} size={32} shadow />

          <View style={styles.body}>
            <Text style={styles.heroName} numberOfLines={1}>
              {bestTitle}
            </Text>
            <Text style={styles.heroMeta} numberOfLines={1}>
              {`${KIND_LABEL[best.kind]} · ${formatDistance(best.distance)} ממך`}
            </Text>
          </View>

          <MiniScoreRing score={best.score} color={best.reach.color} />
        </View>

        {best.reasons.length > 0 && (
          <View style={styles.chipsRow}>
            {best.reasons.slice(0, 3).map((reason) => (
              <View key={reason} style={styles.heroChip}>
                <Text style={styles.heroChipText}>{reason}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.heroActions}>
          <Pressable
            onPress={() => openWaze(best)}
            style={({ pressed }) => [styles.heroWazeBtn, pressed && styles.pressed]}
            accessibilityRole="link"
            accessibilityLabel={`ניווט ב־Waze אל ${bestTitle}`}
          >
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <Path d="M3 11l18-8-8 18-2-8-8-2z" stroke="#FFF8F0" strokeWidth={2.2} strokeLinejoin="round" />
            </Svg>
            <Text style={styles.heroWazeText}>נווט ב־Waze</Text>
          </Pressable>

          <Pressable
            onPress={() => onSelectSpot?.(best)}
            style={({ pressed }) => [styles.detailsBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`פרטים נוספים על ${bestTitle}`}
          >
            <Text style={styles.detailsBtnText}>פרטים וציון</Text>
          </Pressable>
        </View>
      </Pressable>

      {/* Spots #2..#6 */}
      {rest.map((spot, idx) => {
        const rank = idx + 2;
        const driveMin = Math.max(1, Math.round(travelMinutes(spot.distance, 'car')));
        const title = spot.name ?? KIND_LABEL[spot.kind];
        return (
          <Pressable
            key={spot.id}
            onPress={() => onSelectSpot?.(spot)}
            style={({ pressed }) => [
              styles.row,
              selectedId === spot.id && styles.cardSelected,
              !spot.reach.inTime && styles.rowLate,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`מקום ${rank}: ${title}, ציון ${spot.score}`}
          >
            <View style={styles.pinCol}>
              <SpotPin kind={spot.kind} color={spot.reach.color} opacity={spot.reach.opacity} size={27} />
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>{rank}</Text>
              </View>
            </View>

            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {`${formatDistance(spot.distance)} · כ־${driveMin} דק'${spot.reasons.length ? ` · ${spot.reasons.slice(0, 2).join(' · ')}` : ''}`}
              </Text>
            </View>

            <View style={styles.scorePill}>
              <Text style={styles.scorePillText} accessibilityLabel={`ציון ${spot.score}`}>
                {spot.score}
              </Text>
            </View>

            <Pressable
              onPress={() => openWaze(spot)}
              style={({ pressed }) => [styles.wazeCircle, pressed && styles.pressed]}
              accessibilityRole="link"
              accessibilityLabel={`ניווט ב־Waze אל ${title}`}
              hitSlop={6}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M3 11l18-8-8 18-2-8-8-2z" stroke={colors.ink} strokeWidth={2.1} strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </Pressable>
        );
      })}
    </View>
  );
}

function MiniScoreRing({ score, color }: { score: number; color: string }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circ;
  return (
    <Svg width={46} height={46} viewBox="0 0 46 46" accessibilityLabel={`ציון ${score}`}>
      <Circle cx={23} cy={23} r={r} fill="none" stroke="#F3E2CE" strokeWidth={4} />
      <Circle
        cx={23}
        cy={23}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform="rotate(-90 23 23)"
      />
      <SvgText x={23} y={27.5} textAnchor="middle" fontSize={14} fontFamily={fonts.bold} fill={colors.ink}>
        {`${score}`}
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  heroCard: {
    padding: 15,
    borderRadius: 22,
    backgroundColor: '#FFF9F0',
    borderWidth: 1.5,
    borderColor: '#F0CFA3',
    gap: 12,
    shadowColor: '#8A4A18',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  heroTopStrip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topPickPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.obsidian,
  },
  topPickText: { fontFamily: fonts.semibold, fontSize: 11.5, color: '#FBD687' },
  reachPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  reachDot: { width: 7, height: 7, borderRadius: 3.5 },
  reachText: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft },
  heroMain: { flexDirection: 'row-reverse', alignItems: 'center', gap: 11 },
  heroName: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, textAlign: 'right' },
  heroMeta: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, textAlign: 'right' },
  chipsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  heroChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#EEDBC4',
  },
  heroChipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft },
  heroActions: { flexDirection: 'row-reverse', gap: 8, paddingTop: 2 },
  heroWazeBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: colors.obsidian,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  heroWazeText: { fontFamily: fonts.semibold, fontSize: 14, color: '#FFF8F0' },
  detailsBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsBtnText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowLate: { opacity: 0.72 },
  cardSelected: { borderColor: colors.orange, borderWidth: 1.5 },
  pinCol: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  rankBadge: {
    position: 'absolute',
    top: -3,
    right: -4,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: colors.sandSoft,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.inkSoft },
  body: { flex: 1, gap: 2, alignItems: 'flex-end' },
  name: { fontFamily: fonts.semibold, fontSize: 15.5, color: colors.ink, textAlign: 'right' },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'right' },
  scorePill: {
    minWidth: 38,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: colors.sandSoft,
    alignItems: 'center',
  },
  scorePillText: { fontFamily: fonts.bold, fontSize: 15, color: colors.orangeText },
  wazeCircle: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.sheet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center', paddingVertical: 12 },
});
