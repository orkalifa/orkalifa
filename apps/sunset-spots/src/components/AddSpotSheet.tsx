import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_NAME } from '../lib/myspots';
import { colors, fonts } from '../theme';

type Props = {
  visible: boolean;
  /** What's being saved: where you are, a point on the map, or a sunset you were at. */
  subtitle: string;
  onSave: (name: string) => void;
  onClose: () => void;
};

/** Name a place and keep it as your own spot ("העץ הבודד"). */
export function AddSpotSheet({ visible, subtitle, onSave, onClose }: Props) {
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
          <Text style={styles.title}>איך לקרוא למקום?</Text>
          <Text style={styles.body}>{`${subtitle} · נשמר רק בטלפון הזה`}</Text>
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
    gap: 12,
  },
  handle: { alignSelf: 'center', width: 38, height: 4.5, borderRadius: 3, backgroundColor: colors.lineStrong },
  title: { fontFamily: fonts.bold, fontSize: 21, color: colors.ink, textAlign: 'right' },
  body: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.muted, textAlign: 'right' },
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
  secondary: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  pressed: { opacity: 0.85 },
});
