import { Modal, type ModalProps } from 'react-native';

/**
 * The one Modal every sheet uses. On Android a Modal is its own window, and by default that window
 * stops at the system bars: the status bar keeps showing the screen behind (no scrim over it) and the
 * gesture-navigation bar shows a strip of the screen behind under the sheet (U15, U12). Making the
 * window translucent under both bars draws it edge to edge like the app itself, so each sheet keeps
 * its own bottom/top inset padding (useSafeAreaInsets or SafeAreaView) and its colour reaches the
 * screen edge. iOS and web ignore both props.
 */
export function SheetModal(props: ModalProps) {
  return <Modal {...props} statusBarTranslucent navigationBarTranslucent />;
}
