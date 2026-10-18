import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BALANCE_OPTIONS, BalancePicker, SpotList, type BalanceKey } from '../components/SpotList';
import { SunCompass } from '../components/SunCompass';
import { useHeading } from '../hooks/useHeading';
import { useLocation } from '../hooks/useLocation';
import { useNow } from '../hooks/useNow';
import { useSpots } from '../hooks/useSpots';
import { rankSpots } from '../lib/score';
import { angleBetween, bearingToHebrew, formatClock, formatCountdown, getSunsetInfo } from '../lib/sun';
import { colors, fonts } from '../theme';

const ALIGNED_DEGREES = 8;

export default function SunsetScreen() {
  const { state, retry } = useLocation();
  const now = useNow();
  const heading = useHeading(Platform.OS !== 'web');
  const spots = useSpots(state.status === 'loading' ? null : state.coords);
  const [balance, setBalance] = useState<BalanceKey>('balanced');

  if (state.status === 'loading') {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.muted}>מחפש את המיקום שלך…</Text>
      </SafeAreaView>
    );
  }

  const { latitude, longitude } = state.coords;
  const info = getSunsetInfo(latitude, longitude, now);
  if (!info) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.muted}>במקום הזה השמש לא שוקעת היום.</Text>
      </SafeAreaView>
    );
  }

  const offset = heading === null ? null : angleBetween(heading, info.bearing);
  const aligned = offset !== null && Math.abs(offset) <= ALIGNED_DEGREES;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardColumn}>
            <Text style={styles.label}>{info.isTomorrow ? 'השקיעה מחר' : 'השקיעה היום'}</Text>
            <Text style={styles.time}>{formatClock(info.sunset)}</Text>
          </View>
          <View style={[styles.cardColumn, styles.alignStart]}>
            <Text style={styles.label}>בעוד</Text>
            <Text style={styles.countdown}>{formatCountdown(info.sunset.getTime() - now.getTime())}</Text>
          </View>
        </View>

        <View style={styles.compass}>
          <SunCompass bearing={info.bearing} heading={heading} aligned={aligned} />
        </View>

        <Text style={[styles.hint, aligned && styles.hintAligned]}>
          {heading === null
            ? 'המצפן פועל בטלפון. כאן הוא מוצג כשהצפון למעלה.'
            : aligned
              ? 'הטלפון מכוון בדיוק לכיוון השקיעה'
              : 'סובבו את הטלפון עד שהשמש תגיע לסימן שלמעלה'}
        </Text>

        <View style={styles.facts}>
          <Fact label="כיוון השקיעה" value={bearingToHebrew(info.bearing)} detail={`${Math.round(info.bearing)}° מהצפון`} />
          <Fact label="שעת הזהב מתחילה" value={formatClock(info.goldenHour)} />
        </View>

        {state.status === 'fallback' && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {state.reason === 'denied'
                ? 'אין הרשאת מיקום, אז מוצגת השקיעה בתל אביב.'
                : 'לא הצלחנו למצוא את המיקום, אז מוצגת השקיעה בתל אביב.'}
            </Text>
            <Pressable onPress={retry} style={styles.button} accessibilityRole="button">
              <Text style={styles.buttonText}>לנסות שוב</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>מקומות לשקיעה סביבך</Text>
          <BalancePicker value={balance} onChange={setBalance} />
          {spots.state.status === 'loading' && <Text style={styles.muted}>מחפש מקומות…</Text>}
          {spots.state.status === 'error' && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>לא הצלחנו לטעון מקומות מהמפה.</Text>
              <Pressable onPress={spots.retry} style={styles.button} accessibilityRole="button">
                <Text style={styles.buttonText}>לנסות שוב</Text>
              </Pressable>
            </View>
          )}
          {spots.state.status === 'ready' && (
            <SpotList
              spots={rankSpots(
                spots.state.spots,
                { lat: latitude, lon: longitude },
                info.bearing,
                BALANCE_OPTIONS.find((o) => o.key === balance)!.weight,
              ).slice(0, 6)}
            />
          )}
        </View>

        <Text style={styles.soon}>נתוני מקומות: © OpenStreetMap contributors</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Fact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
      {detail && <Text style={styles.label}>{detail}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 20, alignItems: 'stretch' },
  card: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    backgroundColor: colors.surface,
    borderRadius: 22,
    shadowColor: colors.orangeText,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardColumn: { alignItems: 'flex-end', gap: 2 },
  alignStart: { alignItems: 'flex-start' },
  label: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'right' },
  time: { fontFamily: fonts.bold, fontSize: 34, color: colors.ink },
  countdown: { fontFamily: fonts.semibold, fontSize: 22, color: colors.orangeText },
  compass: { alignItems: 'center' },
  hint: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkSoft, textAlign: 'center' },
  hintAligned: { color: colors.orangeText, fontFamily: fonts.bold },
  facts: { flexDirection: 'row-reverse', gap: 12 },
  fact: { flex: 1, padding: 14, backgroundColor: colors.surface, borderRadius: 18, gap: 4, alignItems: 'flex-end' },
  factValue: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, textAlign: 'right' },
  notice: { padding: 14, backgroundColor: colors.sand, borderRadius: 18, gap: 10, alignItems: 'flex-end' },
  noticeText: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft, textAlign: 'right' },
  button: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', backgroundColor: colors.ink, borderRadius: 14 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ground },
  muted: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, textAlign: 'center' },
  section: { gap: 12 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink, textAlign: 'right' },
  soon: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center' },
});
