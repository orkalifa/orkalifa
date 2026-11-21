import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { formatDistance } from '../lib/geo';
import type { SpotKind } from '../lib/osm';
import { bearingToHebrew, formatClock } from '../lib/sun';
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

type Props = {
  spot: ShownSpot | null;
  now: Date;
  sunset: Date;
  goldenHour: Date;
  bearing: number;
  onClose: () => void;
  onOpenCompass: () => void;
};

function openWaze(spot: ShownSpot) {
  Linking.openURL(`https://waze.com/ul?ll=${spot.lat},${spot.lon}&navigate=yes`);
}

/** Slide-up detail sheet for a selected spot: bespoke horizon mood art, 3 score rings, ETA and navigation. */
export function SpotDetailSheet({ spot, now, sunset, goldenHour, bearing, onClose, onOpenCompass }: Props) {
  const insets = useSafeAreaInsets();
  if (!spot) return null;

  const driveMin = Math.max(1, Math.round(travelMinutes(spot.distance, 'car')));
  const arrival = new Date(now.getTime() + driveMin * 60000);
  const minsBeforeSunset = Math.round((sunset.getTime() - arrival.getTime()) / 60000);
  const beforeGolden = arrival.getTime() <= goldenHour.getTime();
  const title = spot.name ?? KIND_LABEL[spot.kind];
  const sceneMode = spot.reasons.includes('אופק ים')
    ? 'sea'
    : spot.reasons.includes('האופק חסום חלקית')
      ? 'ridge'
      : 'open';

  const arrivalText = !spot.reach.inTime
    ? `הגעה משוערת ב־${formatClock(arrival)} · אחרי השקיעה`
    : beforeGolden
      ? `תגיעו ב־${formatClock(arrival)} · עוד לפני שעת הזהב`
      : `תגיעו ב־${formatClock(arrival)} · ${minsBeforeSunset} דק' לפני השקיעה`;

  return (
    <Modal visible={!!spot} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="סגירת פרטי מקום" />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.heroWrap}>
            <HorizonArt mode={sceneMode} accent={spot.reach.color} />

            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="סגירה" hitSlop={8}>
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path d="M6 6l12 12M18 6L6 18" stroke={colors.white} strokeWidth={2.4} strokeLinecap="round" />
              </Svg>
            </Pressable>

            <View style={styles.heroBadge}>
              <View style={[styles.reachDot, { backgroundColor: spot.reach.color }]} />
              <Text style={styles.heroBadgeText}>{arrivalText}</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Text style={styles.kindTag}>{KIND_LABEL[spot.kind]}</Text>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subline}>
                  {`${formatDistance(spot.distance)} ממך · כ־${driveMin} דק' נסיעה · שקיעה ב${bearingToHebrew(bearing)}`}
                </Text>
              </View>
              <View style={styles.pinBadge}>
                <SpotPin kind={spot.kind} color={spot.reach.color} opacity={spot.reach.opacity} size={34} shadow />
              </View>
            </View>

            <View style={styles.ringsCard}>
              <ScoreRing label="נוף" value={spot.view} color={colors.orange} />
              <View style={styles.ringDivider} />
              <ScoreRing label="נגישות" value={spot.access} color={colors.gold} />
              <View style={styles.ringDivider} />
              <ScoreRing label="נעימות" value={spot.pleasant} color={colors.sage} />
            </View>

            {spot.reasons.length > 0 && (
              <View style={styles.tagsWrap}>
                {spot.reasons.map((r) => (
                  <View key={r} style={styles.tag}>
                    <Text style={styles.tagText}>{r}</Text>
                  </View>
                ))}
                <View style={styles.tagSoft}>
                  <Text style={styles.tagSoftText}>{`ציון כללי ${spot.score}`}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={() => openWaze(spot)}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              accessibilityRole="link"
              accessibilityLabel={`ניווט ב־Waze אל ${title}`}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M3 11l18-8-8 18-2-8-8-2z" stroke={colors.white} strokeWidth={2.2} strokeLinejoin="round" />
              </Svg>
              <Text style={styles.primaryBtnText}>ניווט ב־Waze</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onClose();
                onOpenCompass();
              }}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="פתיחת המצפן לכיוון השקיעה"
            >
              <Svg width={19} height={19} viewBox="0 0 24 24">
                <Circle cx={12} cy={12} r={9.5} fill="none" stroke={colors.ink} strokeWidth={2} />
                <Path d="M12 5.5l2.8 6.5h-5.6z" fill={colors.orange} />
                <Path d="M12 18.5l-2.8-6.5h5.6z" fill={colors.inkSoft} />
              </Svg>
              <Text style={styles.secondaryBtnText}>מצפן</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ScoreRing({ label, value, color }: { label: string; value: number; color: string }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * circ;
  return (
    <View style={styles.ringItem}>
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Circle cx={32} cy={32} r={r} fill="none" stroke={colors.sand} strokeWidth={5.5} />
        <Circle
          cx={32}
          cy={32}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5.5}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 32 32)"
        />
        <SvgText x={32} y={37} textAnchor="middle" fontSize={16} fontFamily={fonts.bold} fill={colors.ink}>
          {`${value}`}
        </SvgText>
      </Svg>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

function HorizonArt({ mode, accent }: { mode: 'sea' | 'ridge' | 'open'; accent: string }) {
  return (
    <Svg width="100%" height={156} viewBox="0 0 400 156" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="detailSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#26181A" />
          <Stop offset="0.45" stopColor="#8C3D28" />
          <Stop offset="0.82" stopColor="#E6833E" />
          <Stop offset="1" stopColor="#F9CA7A" />
        </LinearGradient>
        <RadialGradient id="detailSun" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFF5D6" stopOpacity="1" />
          <Stop offset="0.45" stopColor={accent} stopOpacity="0.65" />
          <Stop offset="1" stopColor="#E6833E" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect width={400} height={156} fill="url(#detailSky)" />
      <Circle cx={118} cy={104} r={76} fill="url(#detailSun)" />
      <Circle cx={118} cy={104} r={22} fill="#FFF2CA" />

      {mode === 'sea' && (
        <>
          <Rect x={0} y={108} width={400} height={48} fill="#2A2128" />
          <Path d="M84 114h68M94 122h48M104 130h28M110 138h16" stroke="#F8C26D" strokeWidth={2.5} strokeLinecap="round" opacity={0.75} />
          <Path d="M0 134 C110 124 240 144 400 128 V156 H0 Z" fill="#1A120E" opacity={0.85} />
        </>
      )}

      {mode === 'ridge' && (
        <>
          <Path d="M0 112 C60 88 125 94 185 106 C250 118 320 82 400 96 V156 H0 Z" fill="#46251D" opacity={0.85} />
          <Path d="M0 126 C95 112 215 134 400 114 V156 H0 Z" fill="#1F1410" />
        </>
      )}

      {mode === 'open' && (
        <>
          <Path d="M0 110 C120 104 260 112 400 105 V156 H0 Z" fill="#5C2D1E" opacity={0.7} />
          <Path d="M0 122 C110 116 250 126 400 118 V156 H0 Z" fill="#231510" />
          {/* Distant olive/lone tree silhouette echoing the Spotlight inspiration */}
          <Rect x={294} y={96} width={4} height={24} rx={2} fill="#231510" />
          <Circle cx={296} cy={92} r={14} fill="#231510" />
          <Circle cx={286} cy={96} r={9} fill="#231510" />
          <Circle cx={307} cy={96} r={9} fill="#231510" />
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20, 13, 9, 0.48)' },
  scrim: { flex: 1 },
  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '84%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  heroWrap: { height: 156, position: 'relative', backgroundColor: colors.obsidian },
  closeBtn: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(26, 18, 14, 0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(26, 18, 14, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 224, 185, 0.2)',
  },
  reachDot: { width: 8, height: 8, borderRadius: 4 },
  heroBadgeText: { fontFamily: fonts.medium, fontSize: 12, color: '#FFF6EB' },
  body: { padding: 20, gap: 18 },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, alignItems: 'flex-end', gap: 3 },
  kindTag: { fontFamily: fonts.semibold, fontSize: 12, color: colors.orangeText },
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.ink, textAlign: 'right' },
  subline: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'right' },
  pinBadge: { paddingLeft: 4 },
  ringsCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
  },
  ringItem: { alignItems: 'center', gap: 4, flex: 1 },
  ringLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft },
  ringDivider: { width: 1, height: 42, backgroundColor: colors.line },
  tagsWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.sandSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tagText: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft },
  tagSoft: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.orangeSoft,
  },
  tagSoftText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.orangeText },
  actions: {
    flexDirection: 'row-reverse',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.sheet,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: colors.obsidian,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { fontFamily: fonts.semibold, fontSize: 16, color: '#FFF7ED' },
  secondaryBtn: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  secondaryBtnText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
});
