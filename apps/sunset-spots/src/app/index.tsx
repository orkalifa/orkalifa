import { useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { AddSpotSheet } from '../components/AddSpotSheet';
import { CompassButton, CompassSheet } from '../components/CompassSheet';
import { SpotDetailSheet } from '../components/SpotDetailSheet';
import { SpotList } from '../components/SpotList';
import { SpotMap } from '../components/SpotMap';
import { TwilightCard } from '../components/TwilightCard';
import { useHorizons } from '../hooks/useHorizons';
import { useLocation } from '../hooks/useLocation';
import { useMapLayers } from '../hooks/useMapLayers';
import { useMySpots } from '../hooks/useMySpots';
import { useNow } from '../hooks/useNow';
import { usePlaceName } from '../hooks/usePlaceName';
import { useSpots } from '../hooks/useSpots';
import { distanceMeters } from '../lib/geo';
import { mapRange } from '../lib/mapview';
import { isMine, toSpot } from '../lib/myspots';
import type { Spot } from '../lib/osm';
import { rankSpots, scoreSpot } from '../lib/score';
import { parseSharedSpot } from '../lib/share';
import { shareSpot } from '../lib/shareSpot';
import { bearingToHebrew, formatClock, formatCountdown, getSunsetInfo } from '../lib/sun';
import { withReach, type ShownSpot } from '../lib/travel';
import { colors, fonts, getSkyPhase } from '../theme';

/** Share of the screen height the map takes; the bottom sheet rises up cleanly over its lower edge. */
const MAP_SHARE = 0.6;
/**
 * How much the view counts against comfort (access and seating) when ranking spots.
 * One sensible mix instead of a setting: opening the app should be enough.
 */
const VIEW_WEIGHT = 0.4;
/** Space the floating sunset HUD takes over the top of the map, below the status bar. */
const HUD_SPACE = 112;
/** Your own saved spots show up when they're this close, even if they aren't in the top six. */
const MY_SPOTS_RADIUS_M = 25000;

export default function SunsetScreen() {
  const { state, retry } = useLocation();
  const now = useNow();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const coords = state.status === 'loading' ? null : state.coords;
  const spots = useSpots(coords);
  const mySpots = useMySpots();
  // A shared link (?spot=…&ll=…) opens straight on that spot's card.
  const shared = parseSharedSpot(useLocalSearchParams());
  const place = usePlaceName(state.status === 'ready' ? state.coords : null);
  const info = coords ? getSunsetInfo(coords.latitude, coords.longitude, now) : null;
  const lat = coords?.latitude;
  const lon = coords?.longitude;
  // Memoised: the terrain check refetches whenever this list changes.
  const pool = useMemo<Spot[] | null>(() => {
    if (spots.state.status !== 'ready' || lat === undefined || lon === undefined) return null;
    const mine = mySpots.spots.map(toSpot).filter((s) => distanceMeters(s, { lat, lon }) <= MY_SPOTS_RADIUS_M);
    return [...spots.state.spots, ...mine];
  }, [spots.state, mySpots.spots, lat, lon]);
  const horizons = useHorizons(pool, coords, info?.bearing ?? null);
  const [compassOpen, setCompassOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(() => shared?.id ?? null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  let ranked: ShownSpot[] | null = null;
  if (coords && info && pool) {
    const scored = rankSpots(pool, { lat: coords.latitude, lon: coords.longitude }, info.bearing, VIEW_WEIGHT, horizons.horizons);
    const top = scored.slice(0, 6);
    const moreOfMine = scored.filter((s) => isMine(s) && !top.includes(s));
    ranked = withReach([...top, ...moreOfMine], 'car', now, info.goldenHour, info.sunset);
  }

  // A shared spot that isn't in your list (far away, or someone else's own place) is scored from here.
  let sharedShown: ShownSpot | null = null;
  if (shared && coords && info && !ranked?.some((s) => s.id === shared.id)) {
    const ownedHere = mySpots.spots.some((s) => s.id === shared.id);
    const spot: Spot = {
      ...shared,
      // Someone else's own place isn't "yours" here.
      kind: shared.kind === 'mine' && !ownedHere ? 'viewpoint' : shared.kind,
      tags: {},
      nearby: [],
    };
    const scored = scoreSpot(spot, { lat: coords.latitude, lon: coords.longitude }, info.bearing, VIEW_WEIGHT, horizons.horizons[spot.id]);
    sharedShown = withReach([scored], 'car', now, info.goldenHour, info.sunset)[0];
  }

  const selectedSpot: ShownSpot | null =
    ranked?.find((s) => s.id === selectedSpotId) ?? (sharedShown?.id === selectedSpotId ? sharedShown : null);
  const selectedIsMine = !!selectedSpot && mySpots.spots.some((s) => s.id === selectedSpot.id);

  const closeSpot = () => {
    setSelectedSpotId(null);
    setShareNote(null);
    // Drop the shared link from the address bar, so a reload doesn't open it again. Not a navigation:
    // that would remount the screen and look up your location all over again.
    if (shared && Platform.OS === 'web') globalThis.history?.replaceState(null, '', globalThis.location.pathname);
  };

  // The map's zoom: it fits the shown spots, or a close-up until they're in. The tiles are fetched for the same range.
  const range = mapRange((ranked ?? []).map((s) => s.distance));
  const map = useMapLayers(coords, range);

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

  const phase = getSkyPhase(now, info.goldenHour, info.sunset, info.isTomorrow);
  const direction = bearingToHebrew(info.bearing);
  const sunsetClock = formatClock(info.sunset);
  const inTimeCount = ranked ? ranked.filter((s) => s.reach.inTime).length : 0;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
        <View>
          <SpotMap
            from={{ lat: latitude, lon: longitude }}
            sunsetBearing={info.bearing}
            spots={ranked ?? []}
            layers={map.layers}
            range={range}
            height={Math.round(windowHeight * MAP_SHARE)}
            top={insets.top + HUD_SPACE}
            selectedId={selectedSpotId}
            onSelectSpot={(spot) => setSelectedSpotId(spot.id)}
          />

          {/* Sculpted Deep-Espresso Sunset HUD */}
          <View style={[styles.hud, { top: insets.top + 10 }]}>
            <View style={styles.hudTop}>
              <View style={styles.hudRight}>
                <View style={styles.sunIconBox}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Path d="M3 17.5h18" stroke="rgba(255,235,210,0.45)" strokeWidth={1.8} strokeLinecap="round" />
                    <Path d="M7 17.5a5 5 0 0 1 10 0" fill={phase.accent} />
                    <Path d="M12 7V4.5M5.8 11.2 4.2 9.6M18.2 11.2l1.6-1.6" stroke={phase.accent} strokeWidth={1.8} strokeLinecap="round" />
                  </Svg>
                </View>
                <View style={styles.hudTimeCol}>
                  <Text style={styles.hudLabel} numberOfLines={1}>
                    {info.isTomorrow ? 'השקיעה מחר' : 'השקיעה היום'}
                    {place ? ` · ${place}` : ''}
                  </Text>
                  <Text style={styles.hudTime}>{sunsetClock}</Text>
                </View>
              </View>

              <View style={[styles.countdownPill, { backgroundColor: phase.badgeBg }]}>
                <View style={[styles.countdownDot, { backgroundColor: phase.accent }]} />
                <View style={styles.countdownTextWrap}>
                  <Text style={styles.countdownCaption}>בעוד</Text>
                  <Text style={[styles.countdownValue, { color: phase.badgeText }]}>
                    {formatCountdown(info.sunset.getTime() - now.getTime())}
                  </Text>
                </View>
              </View>
            </View>

            {/* Thin golden-hour progress hairline */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(phase.progress * 100)}%`, backgroundColor: phase.accent }]} />
            </View>

            {/* Compact golden hour & bearing ribbon (replaces bulky stat boxes) */}
            <View style={styles.hudFooter}>
              <Text style={styles.hudMeta}>{`זהב ${formatClock(info.goldenHour)} · כיוון ${direction}`}</Text>
              <Text style={[styles.hudPhase, { color: phase.accent }]}>{phase.label}</Text>
            </View>
          </View>

          {/* Compass FAB positioned cleanly above the rising sheet curve */}
          <View style={styles.fab}>
            <CompassButton onPress={() => setCompassOpen(true)} />
          </View>
        </View>

        {/* Layered Rounded Bottom Sheet */}
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {map.error && spots.state.status !== 'error' && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                {map.layers.roads.length ? 'חלק מהמפה לא נטען.' : 'המפה (כבישים, שדות ויישובים) לא נטענה.'}
              </Text>
              <Text style={styles.errorDetail} selectable>
                {map.error}
              </Text>
              <Pressable onPress={map.retry} style={styles.button} accessibilityRole="button">
                <Text style={styles.buttonText}>לנסות שוב</Text>
              </Pressable>
            </View>
          )}

          {state.status === 'fallback' && (
            <View style={styles.noticeCompact}>
              <Text style={[styles.noticeText, styles.noticeCompactText]}>
                {state.reason === 'denied'
                  ? 'אין הרשאת מיקום · מוצגת תל אביב'
                  : 'לא נמצא מיקום · מוצגת תל אביב'}
              </Text>
              <Pressable onPress={retry} style={styles.compactBtn} accessibilityRole="button">
                <Text style={styles.compactBtnText}>נסה שוב</Text>
              </Pressable>
            </View>
          )}

          <TwilightCard
            now={now}
            goldenHour={info.goldenHour}
            sunset={info.sunset}
            blueHour={info.blueHour}
            blueHourEnd={info.blueHourEnd}
            isTomorrow={info.isTomorrow}
          />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>מקומות לשקיעה סביבך</Text>
              {ranked && ranked.length > 0 && (
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryPillText}>
                    {inTimeCount > 0 ? `${inTimeCount} בזמן הערב` : `${ranked.length} מקומות`}
                  </Text>
                </View>
              )}
            </View>

            {spots.state.status === 'loading' && (
              <View style={styles.loadingCard}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Circle cx={12} cy={12} r={9} stroke={colors.lineStrong} strokeWidth={2.5} />
                  <Path d="M12 3a9 9 0 0 1 9 9" stroke={colors.orange} strokeWidth={2.5} strokeLinecap="round" />
                </Svg>
                <Text style={styles.muted}>מחפש נקודות תצפית וספסלים סביבך…</Text>
              </View>
            )}

            {spots.state.status === 'error' && (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>לא הצלחנו לטעון מקומות מהמפה.</Text>
                <Text style={styles.errorDetail} selectable>
                  {spots.state.message}
                </Text>
                <Pressable
                  onPress={() => {
                    spots.retry();
                    map.retry();
                  }}
                  style={styles.button}
                  accessibilityRole="button"
                >
                  <Text style={styles.buttonText}>לנסות שוב</Text>
                </Pressable>
              </View>
            )}

            {ranked && (
              <SpotList
                spots={ranked}
                selectedId={selectedSpotId}
                onSelectSpot={(spot) => setSelectedSpotId(spot.id)}
                now={now}
                goldenHour={info.goldenHour}
              />
            )}

            {spots.state.status === 'ready' && (
              <Pressable
                onPress={() => setAddOpen(true)}
                style={({ pressed }) => [styles.addCard, pressed && { opacity: 0.8 }]}
                accessibilityRole="button"
              >
                <Text style={styles.addTitle}>★ לשמור את המקום הזה</Text>
                <Text style={styles.addBody}>מקום טוב לשקיעה שלא מופיע פה? שומרים את המיקום הנוכחי בלחיצה.</Text>
              </Pressable>
            )}

            {spots.state.status === 'ready' && horizons.status === 'idle' && (
              <Text style={styles.soon}>בודק את קו האופק לכיוון השקיעה…</Text>
            )}
            {spots.state.status === 'ready' && horizons.status === 'error' && (
              <Text style={styles.soon}>בדיקת קו האופק לא הצליחה, אז הדירוג מבוסס על סוג המקום.</Text>
            )}
          </View>

          <Text style={styles.attribution}>
            מפה: OpenFreeMap © OpenMapTiles · נתונים: © OpenStreetMap contributors · גובה: Open-Meteo
          </Text>
        </View>
      </ScrollView>

      <CompassSheet
        visible={compassOpen}
        bearing={info.bearing}
        sunsetClock={sunsetClock}
        onClose={() => setCompassOpen(false)}
      />

      <AddSpotSheet
        visible={addOpen}
        canSave={state.status === 'ready'}
        onClose={() => setAddOpen(false)}
        onSave={(name) => {
          const saved = mySpots.add(name, latitude, longitude);
          setAddOpen(false);
          setSelectedSpotId(saved.id);
        }}
      />

      <SpotDetailSheet
        spot={selectedSpot}
        now={now}
        sunset={info.sunset}
        goldenHour={info.goldenHour}
        bearing={info.bearing}
        onClose={closeSpot}
        onShare={() => {
          if (!selectedSpot) return;
          const { id, kind, lat: sLat, lon: sLon, name } = selectedSpot;
          shareSpot({ id, kind, lat: sLat, lon: sLon, name }, sunsetClock, info.isTomorrow).then((result) =>
            setShareNote(
              result === 'copied' ? 'הקישור הועתק. אפשר להדביק אותו בוואטסאפ.' : result === 'failed' ? 'השיתוף לא הצליח. נסו שוב.' : null,
            ),
          );
        }}
        shareNote={shareNote}
        onDelete={
          selectedIsMine
            ? () => {
                mySpots.remove(selectedSpot.id);
                closeSpot();
              }
            : undefined
        }
        // iOS can't present a modal while another is still sliding away, so wait for the spot sheet to close.
        onOpenCompass={() => setTimeout(() => setCompassOpen(true), 400)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sheet },
  center: { alignItems: 'center', justifyContent: 'center' },
  hud: {
    position: 'absolute',
    left: 12,
    right: 12,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(26, 18, 14, 0.92)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.obsidianBorder,
    gap: 10,
    shadowColor: '#1A120E',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  hudTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  hudRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  sunIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 224, 185, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 224, 185, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudTimeCol: { alignItems: 'flex-end', flexShrink: 1 },
  hudLabel: { fontFamily: fonts.regular, fontSize: 12, color: '#C8B29F', textAlign: 'right' },
  hudTime: { fontFamily: fonts.bold, fontSize: 28, color: '#FFF8F0', lineHeight: 32 },
  countdownPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  countdownDot: { width: 7, height: 7, borderRadius: 3.5 },
  countdownTextWrap: { alignItems: 'flex-start' },
  countdownCaption: { fontFamily: fonts.regular, fontSize: 10.5, color: 'rgba(255, 236, 212, 0.72)' },
  countdownValue: { fontFamily: fonts.bold, fontSize: 16 },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 236, 212, 0.12)',
    overflow: 'hidden',
    alignItems: 'flex-end',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  hudFooter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hudMeta: { fontFamily: fonts.medium, fontSize: 12, color: '#D8C2AE' },
  hudPhase: { fontFamily: fonts.semibold, fontSize: 11.5 },
  fab: { position: 'absolute', left: 14, bottom: 38 },
  sheet: {
    marginTop: -24,
    paddingTop: 10,
    paddingHorizontal: 16,
    gap: 16,
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#1A120E',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: colors.lineStrong,
    marginBottom: 2,
  },
  section: { gap: 12 },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink, textAlign: 'right' },
  summaryPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.sandSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  summaryPillText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  loadingCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  notice: {
    padding: 14,
    backgroundColor: colors.sandSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    gap: 10,
    alignItems: 'flex-end',
  },
  noticeCompact: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 13,
    backgroundColor: colors.sandSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  noticeCompactText: { flex: 1, fontSize: 13 },
  compactBtn: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.obsidian,
    justifyContent: 'center',
  },
  compactBtnText: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#FFF7ED' },
  noticeText: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft, textAlign: 'right' },
  // Technical reason in English (server and HTTP status), so a screenshot tells us what failed.
  errorDetail: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, textAlign: 'left', alignSelf: 'stretch' },
  button: { minHeight: 42, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: colors.obsidian, borderRadius: 12 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 14, color: '#FFF7ED' },
  muted: { fontFamily: fonts.regular, fontSize: 14.5, color: colors.muted, textAlign: 'center' },
  addCard: {
    padding: 14,
    gap: 4,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    backgroundColor: colors.sandSoft,
    alignItems: 'flex-end',
  },
  addTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, textAlign: 'right' },
  addBody: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'right' },
  soon: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, textAlign: 'center' },
  attribution: { fontFamily: fonts.regular, fontSize: 11, color: colors.mutedSoft, textAlign: 'center', paddingTop: 4 },
});
