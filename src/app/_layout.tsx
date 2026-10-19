import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { Appearance, View } from 'react-native';

import { CrisisButton } from '@/components/crisis-button';
import { OnboardingProvider, useOnboarding } from '@/components/onboarding-state';
import { Night } from '@/constants/theme';
import { migrate } from '@/data';
import { NotificationRouter } from '@/notifications/notification-router';
import { configureNotifications } from '@/notifications/reminders';

configureNotifications();
// The night lot is the whole look of the app, so system pieces (alerts, keyboard, time picker)
// are drawn dark too. There is deliberately no in-app appearance switch.
Appearance.setColorScheme('dark');

const NavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Night.accent,
    background: Night.background,
    card: Night.background,
    text: Night.text,
    border: Night.border,
    notification: Night.accent,
  },
};

/**
 * First launch shows only the walkthrough. The crisis screen is never behind that gate,
 * and the crisis button is rendered above everything, including the walkthrough.
 */
function RootStack() {
  const { onboarded } = useOnboarding();
  if (onboarded === null) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Night.background } }}>
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="park" />
        <Stack.Screen name="review" />
        <Stack.Screen name="followup" />
        <Stack.Screen name="window" />
        <Stack.Screen name="open-box" />
        <Stack.Screen name="shop" />
        <Stack.Screen name="box-odds" />
      </Stack.Protected>
      <Stack.Screen
        name="crisis"
        options={{ headerShown: true, title: 'Crisis resources', headerBackTitle: 'Back' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={NavigationTheme}>
      <StatusBar style="light" />
      <Suspense fallback={null}>
        <SQLiteProvider databaseName="worry-parking-lot.db" onInit={migrate} useSuspense>
          <OnboardingProvider>
            <View style={{ flex: 1, backgroundColor: Night.background }}>
              {/* First in the tree so VoiceOver reaches it first; it still draws on top. */}
              <CrisisButton />
              <RootStack />
              <NotificationRouter />
            </View>
          </OnboardingProvider>
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}
