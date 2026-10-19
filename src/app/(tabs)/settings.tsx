import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { Button } from '@/components/button';
import { useOnboarding } from '@/components/onboarding-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { DISCLAIMER } from '@/constants/copy';
import { deleteAllData, getSettings, type WindowSettings } from '@/data';
import { syncFollowUpReminders } from '@/notifications/followups';
import { cancelWindowReminder } from '@/notifications/reminders';
import { formatClock } from '@/utils/format';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { reset } = useOnboarding();
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

  async function wipe() {
    try {
      await deleteAllData(db);
      await cancelWindowReminder();
      await syncFollowUpReminders(db);
      // Start fresh: the walkthrough shows again.
      reset();
    } catch {
      Alert.alert("Couldn't delete everything", 'Please try again.');
    }
  }

  function confirmWipe() {
    Alert.alert(
      'Delete all data?',
      'This permanently deletes every worry, your record, and your settings from this phone. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: () => void wipe() },
      ],
    );
  }

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
        Your data
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Everything you write stays on this phone. Nothing is sent anywhere. You can delete a single
        worry from the Parking Lot or Record tab, or delete everything here.
      </ThemedText>
      <Button label="Delete all data" variant="secondary" onPress={confirmWipe} />

      <ThemedText type="smallBold" accessibilityRole="header">
        About this app
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {DISCLAIMER}
      </ThemedText>
      <Button label="Crisis resources" variant="secondary" onPress={() => router.push('/crisis')} />
      <ThemedText type="small" themeColor="textSecondary">
        Version {Constants.expoConfig?.version ?? 'unknown'}
      </ThemedText>
    </Screen>
  );
}
