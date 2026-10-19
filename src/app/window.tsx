import DateTimePicker from '@react-native-community/datetimepicker';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Switch, View } from 'react-native';

import { BackLink } from '@/components/back-link';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  DEFAULT_WINDOW,
  getRemindersEnabled,
  getSettings,
  saveRemindersEnabled,
  saveSettings,
} from '@/data';
import { useTheme } from '@/hooks/use-theme';
import {
  cancelWindowReminder,
  getReminderPermission,
  requestReminderPermission,
  scheduleWindowReminder,
} from '@/notifications/reminders';
import { dateFromMinutes } from '@/utils/format';

const LENGTH_PRESETS = [10, 15, 20, 30, 45, 60];

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

  const lengths = Array.from(new Set([...LENGTH_PRESETS, lengthMinutes])).sort((a, b) => a - b);

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
        Your worry window is a short time each day when you look at what you&apos;ve parked.
        Worries stay locked the rest of the day.
      </ThemedText>

      {loaded && (
        <>
          <ThemedText type="smallBold" accessibilityRole="header">
            Opens at
          </ThemedText>
          <View style={styles.picker}>
            <DateTimePicker
              value={dateFromMinutes(startMinutes)}
              mode="time"
              display="spinner"
              onChange={(_event, date) => {
                if (date) setStartMinutes(date.getHours() * 60 + date.getMinutes());
              }}
              accessibilityLabel="Time your worry window opens"
            />
          </View>

          <ThemedText type="smallBold" accessibilityRole="header">
            Stays open for
          </ThemedText>
          <View style={styles.chips}>
            {lengths.map((m) => {
              const selected = m === lengthMinutes;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="button"
                  accessibilityLabel={`${m} minutes`}
                  accessibilityState={{ selected }}
                  onPress={() => setLengthMinutes(m)}
                  style={[
                    styles.chip,
                    { backgroundColor: selected ? theme.accent : theme.backgroundElement },
                  ]}>
                  <ThemedText type="smallBold" themeColor={selected ? 'accentText' : 'text'}>
                    {m} min
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

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
  picker: { alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 22,
    justifyContent: 'center',
  },
  switchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  switchText: { flex: 1, gap: Spacing.one },
});
