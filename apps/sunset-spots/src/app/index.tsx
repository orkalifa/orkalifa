import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompassButton, CompassSheet } from '../components/CompassSheet';
import { BALANCE_OPTIONS, BalancePicker, SpotList, type BalanceKey } from '../components/SpotList';
import { SpotMap } from '../components/SpotMap';
import { useHorizons } from '../hooks/useHorizons';
import { useLocation } from '../hooks/useLocation';
import { useMapLayers } from '../hooks/useMapLayers';
import { useNow } from '../hooks/useNow';
import { usePlaceName } from '../hooks/usePlaceName';
import { useSpots } from '../hooks/useSpots';
import { rankSpots } from '../lib/score';
import { bearingToHebrew, formatClock, formatCountdown, getSunsetInfo } from '../lib/sun';
import { colors, fonts } from '../theme';

/** Share of the screen height the map takes; the list of spots scrolls up underneath. */
const MAP_SHARE = 0.62;
/** Space the sunset card takes over the top of the map, below the status bar. */
const CARD_SPACE = 100;

export default function SunsetScreen() {
  const { state, retry } = useLocation();
  const now = useNow();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const coords = state.status === 'loading' ? null : state.coords;
  const spots = useSpots(coords);
  const layers = useMapLayers(coords);
  const place = usePlaceName(state.status === 'ready' ? state.coords : null);
  const info = coords ? getSunsetInfo(coords.latitude, coords.longitude, now) : null;
  const horizons = useHorizons(spots.state.status === 'ready' ? spots.state.spots : null, coords, info?.bearing ?? null);
  const [balance, setBalance] = useState<BalanceKey>('balanced');
  const [compassOpen, setCompassOpen] = useState(false);

  if (state.status === 'loading') {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.muted}>מחפש את המיקום שלך…</Text>
      </SafeAreaView>
    );
  }

  const { latitude, longitude } = state.coords;
  if (!info) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.muted}>במקום הזה השמש לא שוקעת היום.</Text>
      </SafeAreaView>
    );
  }

  const ranked =
    spots.state.status === 'ready'
      ? rankSpots(
          spots.state.spots,
          { lat: latitude, lon: longitude },
          info.bearing,
          BALANCE_OPTIONS.find((o) => o.key === balance)!.weight,
          horizons.horizons,
        ).slice(0, 6)
      : null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View>
          <SpotMap
            from={{ lat: latitude, lon: longitude }}
            sunsetBearing={info.bearing}
            spots={ranked ?? []}
            layers={layers}
            height={Math.round(windowHeight * MAP_SHARE)}
            top={insets.top + CARD_SPACE}
          />

          <View style={[styles.card, { top: insets.top + 10 }]}>
            <View style={styles.cardColumn}>
              <Text style={styles.label} numberOfLines={1}>
                {info.isTomorrow ? 'השקיעה מחר' : 'השקיעה היום'}
                {place && ` · ${place}`}
              </Text>
              <Text style={styles.time}>{formatClock(info.sunset)}</Text>
            </View>
            <View style={[styles.cardColumn, styles.alignStart]}>
              <Text style={styles.label}>בעוד</Text>
              <Text style={styles.countdown}>{formatCountdown(info.sunset.getTime() - now.getTime())}</Text>
            </View>
          </View>

          <View style={styles.fab}>
            <CompassButton onPress={() => setCompassOpen(true)} />
          </View>
        </View>

        <View style={styles.content}>
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
            {ranked && <SpotList spots={ranked} />}
            {spots.state.status === 'ready' && horizons.status === 'idle' && (
              <Text style={styles.soon}>בודק את קו האופק לכיוון השקיעה…</Text>
            )}
            {spots.state.status === 'ready' && horizons.status === 'error' && (
              <Text style={styles.soon}>בדיקת קו האופק לא הצליחה, אז הדירוג מבוסס על סוג המקום.</Text>
            )}
          </View>

          <Text style={styles.soon}>נתוני מפה ומקומות: © OpenStreetMap contributors · נתוני גובה: Open-Meteo (Copernicus DEM)</Text>
        </View>
      </ScrollView>

      <CompassSheet visible={compassOpen} bearing={info.bearing} onClose={() => setCompassOpen(false)} />
    </View>
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
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 20,
    shadowColor: colors.orangeText,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardColumn: { alignItems: 'flex-end', gap: 2, flexShrink: 1 },
  alignStart: { alignItems: 'flex-start' },
  fab: { position: 'absolute', left: 12, bottom: 14 },
  label: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'right' },
  time: { fontFamily: fonts.bold, fontSize: 30, color: colors.ink },
  countdown: { fontFamily: fonts.semibold, fontSize: 22, color: colors.orangeText },
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
