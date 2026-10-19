import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { useColorScheme, View } from 'react-native';

import { CrisisButton } from '@/components/crisis-button';
import { OnboardingProvider, useOnboarding } from '@/components/onboarding-state';
import { migrate } from '@/data';
import { NotificationRouter } from '@/notifications/notification-router';
import { configureNotifications } from '@/notifications/reminders';

configureNotifications();

/**
 * First launch shows only the walkthrough. The crisis screen is never behind that gate,
 * and the crisis button is rendered above everything, including the walkthrough.
 */
function RootStack() {
  const { onboarded } = useOnboarding();
  if (onboarded === null) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="park" />
        <Stack.Screen name="review" />
        <Stack.Screen name="followup" />
        <Stack.Screen name="window" />
      </Stack.Protected>
      <Stack.Screen
        name="crisis"
        options={{ headerShown: true, title: 'Crisis resources', headerBackTitle: 'Back' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Suspense fallback={null}>
        <SQLiteProvider databaseName="worry-parking-lot.db" onInit={migrate} useSuspense>
          <OnboardingProvider>
            <View style={{ flex: 1 }}>
              <RootStack />
              <CrisisButton />
              <NotificationRouter />
            </View>
          </OnboardingProvider>
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}
