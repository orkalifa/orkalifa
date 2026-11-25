import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SheetModal } from './SheetModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addToCalendar, webEnv } from '../lib/addToCalendar';
import { buildIcs } from '../lib/ics';
import { createSheetSession, DEFAULT_PREFS, googleEventFor, parsePrefs, PREFS_KEY, serializePrefs, toIcsEvents, type ReminderPrefs } from '../lib/reminderPlan';
import { reminderTimes, type LeadMinutes, type ReminderDays } from '../lib/reminders';
import { count } from '../lib/stats';
import { colors, fonts } from '../theme';
import { PressableScale } from './motion';

type Props = { visible: boolean; lat: number; lon: number; onClose: () => void };

const DAY_OPTIONS: { value: ReminderDays; label: string }[] = [
  { value: 1, label: 'היום' },
  { value: 14, label: 'כל יום (שבועיים)' },
];
const LEAD_OPTIONS: LeadMinutes[] = [15, 30, 60];

/**
 * Sunset reminder (F1c): pick "today" or "every day" and how early, then add it to the calendar.
 * The location is used here, on the phone, only to compute the times. What leaves the device:
 * the .ics file holds times and a generic Hebrew title (no coordinates, no place name) and goes
 * from the page to the phone; the Google link sends Google the next evening's times and that
 * same title, nothing else.
 */
export function ReminderSheet({ visible, lat, lon, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_PREFS);
  const [status, setStatus] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(() => webEnv() === null);
  // Stable across renders; its methods guard against late async results (see createSheetSession).
  const [session] = useState(createSheetSession);
  // Each opening starts with no result line (adjusting state during render, not in an effect).
  const [shownFor, setShownFor] = useState(visible);
  if (shownFor !== visible) {
    setShownFor(visible);
    if (visible) setStatus(null);
  }

  // Last choices, read each time the sheet opens. Dropped if the user already tapped a chip,
  // or if the sheet closed or unmounted before the read finished.
  useEffect(() => {
    if (!visible) return;
    const id = session.open();
    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => {
        if (session.acceptStored(id)) setPrefs(parsePrefs(raw));
      })
      .catch(() => {});
    return () => session.close();
  }, [visible, session]);

  const choose = (next: ReminderPrefs) => {
    session.touch();
    setPrefs(next);
    setStatus(null);
    AsyncStorage.setItem(PREFS_KEY, serializePrefs(next)).catch(() => {});
  };

  const addFile = async () => {
    const id = session.current();
    const from = new Date();
    const times = reminderTimes({ lat, lon, from, days: prefs.days, leadMinutes: prefs.lead });
    const ics = buildIcs(toIcsEvents(times, prefs.lead), { now: from });
    if (!ics) {
      setStatus('אין שעת זהב בימים הקרובים');
      return;
    }
    const result = await addToCalendar(ics);
    // Closed (or closed and reopened, or unmounted) while the file was being delivered: drop it.
    if (!session.isCurrent(id)) return;
    if (result === 'downloaded' || result === 'shared') count('reminder-added');
    if (result === 'unsupported') setUnsupported(true);
    setStatus(
      result === 'downloaded' ? 'הקובץ ירד. פותחים אותו כדי להוסיף ליומן' : result === 'failed' ? 'לא הצלחנו ליצור את הקובץ' : null,
    );
  };

  const openGoogle = () => {
    const [next] = reminderTimes({ lat, lon, from: new Date(), days: 1, leadMinutes: prefs.lead });
    const url = googleEventFor(next);
    if (!url) {
      setStatus('אין שעת זהב בימים הקרובים');
      return;
    }
    Linking.openURL(url)
      .then(() => count('reminder-added'))
      .catch(() => {});
  };

  return (
    <SheetModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="סגירה" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">
            תזכורת לשקיעה
          </Text>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>מתי</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {DAY_OPTIONS.map((o) => (
                <Chip key={o.value} label={o.label} selected={prefs.days === o.value} onPress={() => choose({ ...prefs, days: o.value })} />
              ))}
            </View>

            <Text style={styles.sectionTitle}>להזכיר</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {LEAD_OPTIONS.map((m) => (
                <Chip key={m} label={`${m} דק'`} selected={prefs.lead === m} onPress={() => choose({ ...prefs, lead: m })} />
              ))}
            </View>
            <Text style={styles.tip}>לפני שעת הזהב</Text>

            {!unsupported && (
              <>
                <PressableScale onPress={addFile} style={styles.primary} accessibilityRole="button">
                  <Text style={styles.primaryText}>הוספה ליומן</Text>
                </PressableScale>
                <Text style={styles.tip}>באייפון: אחרי ההורדה, לוחצים ״הוסף הכול״</Text>
              </>
            )}
            {status && (
              <Text style={styles.status} accessibilityLiveRegion="polite">
                {status}
              </Text>
            )}

            <Pressable
              onPress={openGoogle}
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
              accessibilityRole="link"
            >
              <Text style={styles.linkText}>הוספה ליומן Google (השקיעה הקרובה)</Text>
            </Pressable>
            <Text style={styles.note}>ביומן Google ההתראה לפי הגדרת ברירת המחדל שלך</Text>
          </ScrollView>
        </View>
      </View>
    </SheetModal>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      aria-checked={selected}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
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
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, textAlign: 'right', writingDirection: 'rtl' },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  chipText: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.inkSoft, writingDirection: 'rtl' },
  chipTextOn: { fontFamily: fonts.semibold, color: colors.goldText },
  primary: {
    minHeight: 52,
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: colors.obsidian,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: fonts.semibold, fontSize: 16, color: '#FFF7ED' },
  tip: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, textAlign: 'right', writingDirection: 'rtl' },
  status: { fontFamily: fonts.medium, fontSize: 13, color: colors.sage, textAlign: 'center', writingDirection: 'rtl' },
  link: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-end', marginTop: 4 },
  linkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.orangeText, textDecorationLine: 'underline', writingDirection: 'rtl' },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedSoft, textAlign: 'right', writingDirection: 'rtl' },
  pressed: { opacity: 0.6 },
});
