import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TRAVEL_MODES, type TravelMode } from '../lib/travel';
import { colors } from '../theme';

const ICON: Record<TravelMode, string> = { car: '🚗', bike: '🚲', walk: '🚶' };
const LABEL: Record<TravelMode, string> = { car: 'ברכב', bike: 'באופניים', walk: 'ברגל' };

/** Three small icons on the map: how you're getting there decides which spots you'll make in time. */
export function TravelModePicker({ value, onChange }: { value: TravelMode; onChange: (mode: TravelMode) => void }) {
  return (
    <View style={styles.pill} accessibilityRole="radiogroup" accessibilityLabel="איך מגיעים?">
      {TRAVEL_MODES.map((mode) => {
        const selected = mode === value;
        return (
          <Pressable
            key={mode}
            onPress={() => onChange(mode)}
            style={[styles.option, selected && styles.selected]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={LABEL[mode]}
            hitSlop={4}
          >
            <Text style={styles.icon}>{ICON[mode]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row-reverse',
    padding: 4,
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: 28,
    shadowColor: colors.orangeText,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  option: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: colors.sand, borderWidth: 2, borderColor: colors.orange },
  icon: { fontSize: 22 },
});
