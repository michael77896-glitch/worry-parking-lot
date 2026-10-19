import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { useOnboarding } from '@/components/onboarding-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DISCLAIMER } from '@/constants/copy';
import { Radius, Spacing } from '@/constants/theme';
import { deleteAllData, getSettings, type WindowSettings } from '@/data';
import { useOpeningPrefs } from '@/hooks/use-opening-prefs';
import { useTheme } from '@/hooks/use-theme';
import { syncFollowUpReminders } from '@/notifications/followups';
import { cancelWindowReminder } from '@/notifications/reminders';
import { formatClock } from '@/utils/format';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { reset } = useOnboarding();
  const theme = useTheme();
  const prefs = useOpeningPrefs();
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

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="headline" accessibilityRole="header">
          Worry window
        </ThemedText>
        {settings && (
          <ThemedText themeColor="textSecondary">
            The gate opens at {formatClock(settings.startMinutes)} for {settings.lengthMinutes}{' '}
            minutes.
          </ThemedText>
        )}
        <Button label="Change worry window" variant="secondary" onPress={() => router.push('/window')} />
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="headline" accessibilityRole="header">
          Opening boxes
        </ThemedText>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <ThemedText type="smallBold">Sound effects</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Soft sounds as a box opens. They follow your iPhone&apos;s silent switch.
            </ThemedText>
          </View>
          <Switch
            value={prefs.sound}
            onValueChange={prefs.setSound}
            accessibilityLabel="Sound effects"
            trackColor={{ true: theme.accent }}
          />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <ThemedText type="smallBold">Quick opening</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Skip the shaking and the spinning reel, and go straight to what&apos;s inside.
            </ThemedText>
          </View>
          <Switch
            value={prefs.quick}
            onValueChange={prefs.setQuick}
            accessibilityLabel="Quick opening"
            trackColor={{ true: theme.accent }}
          />
        </View>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="headline" accessibilityRole="header">
          Your data
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Everything you write stays on this phone. Nothing is sent anywhere. You can delete a
          single worry from the Lot or Record tab, or delete everything here.
        </ThemedText>
        <Button label="Delete all data" variant="secondary" onPress={confirmWipe} />
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="headline" accessibilityRole="header">
          About this app
        </ThemedText>
        <ThemedText themeColor="textSecondary">{DISCLAIMER}</ThemedText>
        <Button label="Crisis resources" variant="secondary" onPress={() => router.push('/crisis')} />
        <ThemedText type="small" themeColor="textSecondary">
          Version {Constants.expoConfig?.version ?? 'unknown'}
        </ThemedText>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.card, padding: Spacing.four, gap: Spacing.three },
  switchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  switchText: { flex: 1, gap: Spacing.one },
});
