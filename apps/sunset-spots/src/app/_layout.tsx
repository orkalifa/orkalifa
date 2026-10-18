import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
  useFonts,
} from '@expo-google-fonts/rubik';
import { colors } from '../theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold, Rubik_700Bold });
  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }} />
    </>
  );
}
