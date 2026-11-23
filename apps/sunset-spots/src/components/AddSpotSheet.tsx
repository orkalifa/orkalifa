import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_NAME } from '../lib/myspots';
import { colors, fonts } from '../theme';

type Props = {
  visible: boolean;
  /** False when the app doesn't know where you are (no permission), so there's nothing to save. */
  canSave: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
};

/** Save the place you're standing at as your own spot ("העץ הבודד"). */
export function AddSpotSheet({ visible, canSave, onSave, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');

  const close = () => {
    setName('');
    onClose();
  };
  const save = () => {
    onSave(name);
    setName('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={close} accessibilityLabel="סגירה" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>שמירת המקום שלי</Text>
          {canSave ? (
            <>
              <Text style={styles.body}>
                המקום נשמר לפי המיקום שלך עכשיו, רק בטלפון הזה. הוא יופיע ברשימה עם כוכב, ואפשר לשתף אותו בקישור.
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="למשל: העץ הבודד"
                placeholderTextColor={colors.mutedSoft}
                maxLength={MAX_NAME}
                style={styles.input}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={save}
                accessibilityLabel="שם המקום"
              />
              <Pressable onPress={save} style={({ pressed }) => [styles.primary, pressed && styles.pressed]} accessibilityRole="button">
                <Text style={styles.primaryText}>★ שמירה</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.body}>
              כדי לשמור מקום, האפליקציה צריכה את המיקום שלך. אפשר לאשר גישה למיקום בהגדרות הדפדפן או הטלפון, ולנסות שוב.
            </Text>
          )}
          <Pressable onPress={close} style={styles.secondary} accessibilityRole="button">
            <Text style={styles.secondaryText}>ביטול</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20, 13, 9, 0.48)' },
  scrim: { flex: 1 },
  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 14,
  },
  handle: { alignSelf: 'center', width: 38, height: 4.5, borderRadius: 3, backgroundColor: colors.lineStrong },
  title: { fontFamily: fonts.bold, fontSize: 21, color: colors.ink, textAlign: 'right' },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.inkSoft, textAlign: 'right' },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
    textAlign: 'right',
  },
  primary: { minHeight: 52, borderRadius: 16, backgroundColor: colors.obsidian, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: fonts.semibold, fontSize: 16, color: '#FFF7ED' },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  pressed: { opacity: 0.85 },
});
