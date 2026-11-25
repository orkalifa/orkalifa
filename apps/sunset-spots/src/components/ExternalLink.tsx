import { Linking, Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';

/**
 * Small text link that opens an external page. The touch area is at least 44 px tall.
 * On web, react-native-web's Linking.openURL opens a new tab (window.open with 'noopener').
 */
export function ExternalLink({
  url,
  label,
  style,
  textStyle,
}: {
  url: string;
  label: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable
      onPress={() => {
        Linking.openURL(url).catch(() => undefined);
      }}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.touch, style, pressed && styles.pressed]}
    >
      <Text style={[styles.text, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  pressed: { opacity: 0.6 },
  text: { fontFamily: fonts.semibold, fontSize: 12, color: colors.orangeText, textDecorationLine: 'underline' },
});
