import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { formatClock } from '../lib/sun';
import { colors, fonts } from '../theme';
import { PressableScale } from './motion';

type Props = {
  now: Date;
  goldenHour: Date;
  sunset: Date;
  blueHour: Date;
  blueHourEnd: Date;
  isTomorrow: boolean;
  /** Opens the sunset reminder sheet; no bell without it. */
  onRemind?: () => void;
};

/**
 * Tonight's light for photographers: golden hour (warm, soft light, sun from +6° to -4°),
 * the sunset itself, then the blue hour (deep blue sky, -4° to -6°). In Israel the blue hour
 * lasts only ~10 minutes, so it's worth knowing exactly when.
 */
export function TwilightCard({ now, goldenHour, sunset, blueHour, blueHourEnd, isTomorrow, onRemind }: Props) {
  const t = now.getTime();
  const inGolden = !isTomorrow && t >= goldenHour.getTime() && t < blueHour.getTime();
  const inBlue = !isTomorrow && t >= blueHour.getTime() && t < blueHourEnd.getTime();

  return (
    <View style={styles.card} accessibilityLabel={`שעת הזהב ${formatClock(goldenHour)} עד ${formatClock(blueHour)}, שקיעה ${formatClock(sunset)}, השעה הכחולה ${formatClock(blueHour)} עד ${formatClock(blueHourEnd)}`}>
      <View style={styles.row}>
        <Slot label="שעת הזהב" value={`${formatClock(goldenHour)}–${formatClock(blueHour)}`} color={colors.goldText} now={inGolden} />
        <Slot label="שקיעה" value={formatClock(sunset)} color={colors.orangeText} />
        <Slot label="השעה הכחולה" value={`${formatClock(blueHour)}–${formatClock(blueHourEnd)}`} color="#3C5A8A" now={inBlue} />
      </View>
      <Svg width="100%" height={6} viewBox="0 0 100 6" preserveAspectRatio="none">
        <Defs>
          {/* Right to left, like the text: gold, then the sunset's orange, then blue. */}
          <LinearGradient id="twilight" x1="1" y1="0" x2="0" y2="0">
            <Stop offset="0" stopColor="#F5C451" />
            <Stop offset="0.5" stopColor="#E55B24" />
            <Stop offset="0.78" stopColor="#8E4A6B" />
            <Stop offset="1" stopColor="#2E4D80" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={6} rx={3} fill="url(#twilight)" />
      </Svg>
      {isTomorrow && <Text style={styles.note}>הזמנים של מחר</Text>}
      {onRemind && <BellButton onPress={onRemind} />}
    </View>
  );
}

/**
 * Small bell, no text: opens the reminder sheet. It sits on the card's top-left corner (a badge),
 * so the three time slots keep their full width on narrow phones. 44 px touch target.
 */
function BellButton({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={styles.bell} accessibilityRole="button" accessibilityLabel="תזכורת לשעת הזהב">
      <View style={styles.bellDot}>
        <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
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

function Slot({ label, value, color, now = false }: { label: string; value: string; color: string; now?: boolean }) {
  return (
    <View style={styles.slot}>
      <Text style={[styles.label, { color }]}>
        {label}
        {now ? ' · עכשיו' : ''}
      </Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 8 },
  slot: { alignItems: 'center', flex: 1, gap: 2 },
  label: { fontFamily: fonts.semibold, fontSize: 12 },
  value: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  bell: { position: 'absolute', top: -14, left: -10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bellDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  note: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted, textAlign: 'center' },
});
