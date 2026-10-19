import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { DISCLAIMER } from '@/constants/copy';
import { getSettings, type WindowSettings } from '@/data';
import { formatClock } from '@/utils/format';

/** Placeholder. Data deletion arrives in build step 9. */
export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<WindowSettings | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSettings(db).then((s) => {
        if (active) setSettings(s);
      });
      return () => {
        active = false;
      };
    }, [db]),
  );

  return (
    <Screen>
      <ThemedText type="subtitle">Settings</ThemedText>

      <ThemedText type="smallBold" accessibilityRole="header">
        Worry window
      </ThemedText>
      {settings && (
        <ThemedText themeColor="textSecondary">
          Opens at {formatClock(settings.startMinutes)} for {settings.lengthMinutes} minutes.
        </ThemedText>
      )}
      <Button label="Change worry window" variant="secondary" onPress={() => router.push('/window')} />

      <ThemedText type="smallBold" accessibilityRole="header">
        About this app
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {DISCLAIMER}
      </ThemedText>
    </Screen>
  );
}
