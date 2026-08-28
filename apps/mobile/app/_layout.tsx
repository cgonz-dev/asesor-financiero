import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { MobileAppProvider, useMobileApp } from '../src/application/mobile-app-provider';
import { getRootRouteAccess } from '../src/navigation/root-route-access';
import { colors } from '../src/ui/theme';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, []);

  if (fontError !== null) {
    throw fontError;
  }

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.accentCyan} size="large" />
      </View>
    );
  }

  return (
    <MobileAppProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </MobileAppProvider>
  );
}

export function RootNavigator() {
  const { session } = useMobileApp();
  const access = getRootRouteAccess(session.status);

  return (
    <Stack
      screenOptions={{
        animation: 'fade_from_bottom',
        contentStyle: { backgroundColor: colors.background },
        gestureEnabled: true,
        headerShown: false,
      }}
    >
      <Stack.Protected guard={access.sessionGate}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={access.application}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="households/create"
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />
        <Stack.Screen
          name="households/invite"
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />
        <Stack.Screen
          name="invitations/accept"
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});
