import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { useColorScheme, View } from 'react-native';

import { CrisisButton } from '@/components/crisis-button';
import { migrate } from '@/data';
import { NotificationRouter } from '@/notifications/notification-router';
import { configureNotifications } from '@/notifications/reminders';

configureNotifications();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Suspense fallback={null}>
        <SQLiteProvider databaseName="worry-parking-lot.db" onInit={migrate} useSuspense>
          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen
                name="crisis"
                options={{ headerShown: true, title: 'Crisis resources', headerBackTitle: 'Back' }}
              />
            </Stack>
            <CrisisButton />
            <NotificationRouter />
          </View>
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}
