import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CREDIT_ITEMS,
  CREDIT_URLS,
  CREDITS_TITLE,
  FOOTER_MAP_LINE,
  FOOTER_WEATHER_LABEL,
  FOOTER_WEATHER_PREFIX,
} from '../lib/credits';
import { colors, fonts } from '../theme';
import { ExternalLink } from './ExternalLink';

/** Plain-language credits and licences, opened from the footer. */
export function CreditsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {CREDITS_TITLE}
          </Text>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="סגירה">
            <Text style={styles.closeText}>סגירה</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {CREDIT_ITEMS.map((item) => (
            <View key={item.text} style={styles.item}>
              <Text style={styles.text}>{item.text}</Text>
              {item.links?.map((link) => (
                <ExternalLink key={link.url} url={link.url} label={link.label} style={styles.link} />
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/** Footer credits: the map and weather/elevation attribution, and a button that opens the full sheet. */
export function CreditsFooter() {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.footer}>
      <Text style={styles.line}>{FOOTER_MAP_LINE}</Text>

      <View style={styles.weatherRow}>
        <Text style={styles.line}>{FOOTER_WEATHER_PREFIX}</Text>
        <ExternalLink url={CREDIT_URLS.openMeteo} label={FOOTER_WEATHER_LABEL} />
      </View>

      <Pressable onPress={() => setOpen(true)} style={styles.creditsBtn} accessibilityRole="button" accessibilityLabel={CREDITS_TITLE}>
        <Text style={styles.creditsBtnText}>{CREDITS_TITLE}</Text>
      </Pressable>

      <CreditsSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sheet },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, textAlign: 'right' },
  closeBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  closeText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.orangeText },
  body: { paddingHorizontal: 20, paddingBottom: 32, gap: 18 },
  item: { gap: 6, alignItems: 'stretch' },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.inkSoft, textAlign: 'right', writingDirection: 'rtl' },
  link: { alignSelf: 'flex-end', paddingHorizontal: 0 },

  footer: { paddingTop: 4, paddingHorizontal: 16, alignItems: 'center', gap: 2 },
  line: { fontFamily: fonts.regular, fontSize: 11, color: colors.mutedSoft, textAlign: 'center', writingDirection: 'rtl' },
  weatherRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' },
  creditsBtn: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
  creditsBtnText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.orangeText, textDecorationLine: 'underline' },
});
