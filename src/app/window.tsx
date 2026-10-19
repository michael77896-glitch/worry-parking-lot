import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';

import { BackLink } from '@/components/back-link';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { WindowPicker } from '@/components/window-picker';
import { Spacing } from '@/constants/theme';
import {
  DEFAULT_WINDOW,
  getRemindersEnabled,
  getSettings,
  saveRemindersEnabled,
  saveSettings,
} from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { syncFollowUpReminders } from '@/notifications/followups';
import {
  cancelWindowReminder,
  getReminderPermission,
  requestReminderPermission,
  scheduleWindowReminder,
} from '@/notifications/reminders';

export default function WorryWindowScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [startMinutes, setStartMinutes] = useState(DEFAULT_WINDOW.startMinutes);
  const [lengthMinutes, setLengthMinutes] = useState(DEFAULT_WINDOW.lengthMinutes);
  const [wantReminders, setWantReminders] = useState(false);
  const [notificationsBlocked, setNotificationsBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [settings, enabled, permission] = await Promise.all([
        getSettings(db),
        getRemindersEnabled(db),
        getReminderPermission(),
      ]);
      if (!active) return;
      setStartMinutes(settings.startMinutes);
      setLengthMinutes(settings.lengthMinutes);
      setWantReminders(enabled && permission === 'granted');
      setNotificationsBlocked(permission === 'denied');
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [db]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveSettings(db, { startMinutes, lengthMinutes });

      let remindersOn = false;
      if (wantReminders) {
        // iPhone shows its own permission prompt here, the first time only.
        const permission = await getReminderPermission();
        const allowed =
          permission === 'granted' || (permission === 'undetermined' && (await requestReminderPermission()));
        if (allowed) {
          await scheduleWindowReminder(startMinutes);
          remindersOn = true;
        } else {
          setNotificationsBlocked(true);
          setWantReminders(false);
        }
      }
      if (!remindersOn) await cancelWindowReminder();
      await saveRemindersEnabled(db, remindersOn);
      await syncFollowUpReminders(db);

      setMessage(
        wantReminders && !remindersOn
          ? "Saved. Reminders are off because notifications aren't allowed for this app."
          : 'Saved.',
      );
    } catch {
      Alert.alert("Couldn't save", 'Your changes were not saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <BackLink />
      <ThemedText type="subtitle">Worry window</ThemedText>
      <ThemedText themeColor="textSecondary">
        Your worry window is when the gate opens each day, and you can visit your cars and read what
        you parked. The gate stays closed the rest of the day.
      </ThemedText>

      {loaded && (
        <>
          <WindowPicker
            startMinutes={startMinutes}
            lengthMinutes={lengthMinutes}
            onStartChange={setStartMinutes}
            onLengthChange={setLengthMinutes}
          />

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <ThemedText type="smallBold">Daily reminder</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                A notification when your window opens. It&apos;s scheduled on your phone, nothing is
                sent anywhere, and it never includes what you wrote. Your iPhone will ask for
                permission the first time.
              </ThemedText>
            </View>
            <Switch
              value={wantReminders}
              onValueChange={setWantReminders}
              disabled={notificationsBlocked}
              accessibilityLabel="Daily reminder"
              trackColor={{ true: theme.accent }}
            />
          </View>

          {notificationsBlocked && (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Notifications are turned off for this app in iPhone Settings. You can allow them
                there if you want reminders.
              </ThemedText>
              <Button label="Open iPhone Settings" variant="secondary" onPress={() => Linking.openSettings()} />
            </>
          )}

          <Button label={saving ? 'Saving…' : 'Save'} onPress={save} />
          {message && (
            <ThemedText accessibilityLiveRegion="polite" themeColor="textSecondary">
              {message}
            </ThemedText>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  switchText: { flex: 1, gap: Spacing.one },
});
